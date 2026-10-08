"""
Annulation d'une facture : restauration des lots, du stock général,
annulation des promis, annulation des paiements.

Extrait de SalesService.cancel_invoice pour lisibilité et maintenabilité.
"""
import logging

from django.core.cache import cache
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from ..models import (
    Caisse,
    CouponMonnaie,
    DepotClient,
    Facture,
    FactureProduit,
    MouvementStock,
    Produit,
    Promis,
)
from .lot_allocation_service import LotAllocationService
from .realtime import notify_stock_changed
from .sale_integrity import is_invoice_period_closed
from .stock_obligation_service import StockObligationService

logger = logging.getLogger(__name__)


class SaleCanceller:
    """Annule une facture et restaure le stock."""

    @staticmethod
    @transaction.atomic
    def cancel_invoice(facture, user, motif=""):
        """
        Cancels an invoice and restores stock levels.
        Returns (success: bool, message: str).
        """
        if facture.status == Facture.Status.ANNULEE:
            return False, "Cette facture est déjà annulée."

        was_validated = facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]

        if was_validated and is_invoice_period_closed(facture):
            return False, "Impossible d'annuler cette facture : la période de caisse est déjà clôturée. Utilisez un avoir client."

        if was_validated:
            # 1. Restore physical allocations and cancel pending stock obligations
            allocations, _product_ids_with_allocations = LotAllocationService.restore_allocations(facture)
            covered_by_line = {}
            for alloc in allocations:
                covered_by_line[alloc.facture_produit_id] = (
                    covered_by_line.get(alloc.facture_produit_id, 0) + alloc.quantity
                )

            # Promis encore en attente sur des lignes historiques sans
            # allocation : leur quantité n'a jamais été déstockée, donc elle ne
            # doit pas être réintégrée en résidu.
            pending_promis_map = {
                row['produit_id']: row['total'] or 0
                for row in Promis.objects.filter(
                    facture=facture,
                    status=Promis.Status.EN_ATTENTE,
                    is_active=True,
                ).values('produit_id').annotate(total=Sum('quantite'))
            }

            # 2. Restore residual quantities for legacy lines without allocations
            old_items = list(FactureProduit.objects.filter(facture=facture).select_related('produit'))

            # Verrouiller les produits pour éviter les race conditions avec une vente concurrente
            product_ids = [item.produit_id for item in old_items if item.produit_id]
            if product_ids:
                locked_products = {
                    p.id: p
                    for p in Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id')
                }
            else:
                locked_products = {}

            restored_ids = []
            for item in old_items:
                produit = locked_products.get(item.produit_id) or item.produit
                residual_quantity = item.quantity - covered_by_line.get(item.id, 0)
                if residual_quantity > 0 and item.produit_id in pending_promis_map:
                    residual_quantity -= min(residual_quantity, pending_promis_map[item.produit_id])
                if produit and residual_quantity > 0:
                    Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + residual_quantity)
                    restored_ids.append(item.produit_id)
            notify_stock_changed(restored_ids)

            # 3. Annuler les promis/obligations restants avant le snapshot stock
            SaleCanceller._cancel_linked_promis(facture, user)

            # 4. Stock movements (traceability)
            SaleCanceller._create_cancellation_movements(facture, old_items, user)
        else:
            SaleCanceller._cancel_linked_promis(facture, user)

        # 5. Mark invoice as cancelled
        facture.status = Facture.Status.ANNULEE
        facture.date_annulation = timezone.now()
        facture.cancelled_by = user
        if motif:
            facture.notes = f"{facture.notes or ''}\n[Annulation le {facture.date_annulation.strftime('%d/%m/%Y %H:%M')}] Motif: {motif}".strip()
        facture.save(update_fields=['status', 'notes', 'date_annulation', 'cancelled_by'])

        # 5b. Notifier la caisse centralisée en temps réel (retrait immédiat de la file)
        SaleCanceller._notify_caisse_cancelled(facture)

        # 6. Restore coupons used on this invoice
        SaleCanceller._restore_coupons(facture)

        # 7. Cancel associated payments
        SaleCanceller._cancel_payments(facture, user)

        # Cache invalidation
        cache_key = f'stats_jour_{timezone.now().strftime("%Y-%m-%d")}'
        cache.delete(cache_key)

        return True, "Facture annulée avec succès."

    # ──────────────────────────────────────────────
    #  Private helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _notify_caisse_cancelled(facture):
        """Broadcast WebSocket 'cancelled' vers la caisse centralisée après commit.

        Sans cela, une facture annulée (ex: rappel pour modification) reste
        affichée/payable sur les écrans caisse jusqu'au polling de 30 s.
        """
        facture_id = facture.id
        poste_caisse_id = getattr(facture, 'poste_caisse_id', None)

        def _send():
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        'caisse_centralisee',
                        {
                            'type': 'facture_update',
                            'action': 'cancelled',
                            'facture_id': facture_id,
                            'poste_caisse_id': poste_caisse_id,
                        }
                    )
            except Exception as ws_err:
                logger.warning(f"WebSocket broadcast caisse (annulation) échoué: {ws_err}")

        transaction.on_commit(_send)

    @staticmethod
    def _create_cancellation_movements(facture, old_items, user):
        """Crée les mouvements de stock de type RETOUR pour l'annulation."""
        product_ids = [item.produit_id for item in old_items if item.quantity != 0]
        if not product_ids:
            return

        updated_products = Produit.objects.filter(id__in=product_ids)
        product_stock_map = {p.id: p.total_stock for p in updated_products}

        mouvements = []
        for item in old_items:
            if item.quantity == 0:
                continue
            mouvements.append(MouvementStock(
                produit_id=item.produit_id,
                type_mouvement=MouvementStock.TypeMouvement.RETOUR,
                quantite=item.quantity,
                stock_apres=product_stock_map.get(item.produit_id),
                user=user,
                facture=facture,
                description=f"Annulation Facture #{facture.numero_facture or facture.id}",
                date=timezone.now()
            ))
        if mouvements:
            MouvementStock.objects.bulk_create(mouvements)

    @staticmethod
    def _cancel_linked_promis(facture, user=None):
        """Annule les promis liés à cette facture."""
        linked_promis = Promis.objects.filter(facture=facture, is_active=True)
        for promis in linked_promis:
            if promis.status in (Promis.Status.EN_ATTENTE, Promis.Status.DELIVRE):
                if promis.status == Promis.Status.EN_ATTENTE:
                    StockObligationService.cancel_for_promis(promis, user=user)
                promis.status = Promis.Status.ANNULE
                promis.date_livraison = None
                promis.notes = (
                    f"{promis.notes or ''}\n"
                    f"[Annulé automatiquement - Annulation Facture #{facture.numero_facture or facture.id} "
                    f"le {timezone.now().strftime('%d/%m/%Y %H:%M')}]"
                ).strip()
                promis.save(update_fields=['status', 'date_livraison', 'notes'])

    @staticmethod
    def _restore_coupons(facture):
        """Restaure les coupons utilisés sur cette facture en ACTIF."""
        coupons = CouponMonnaie.objects.filter(
            facture_utilisation=facture, status=CouponMonnaie.Status.UTILISE
        )
        for coupon in coupons:
            coupon.status = CouponMonnaie.Status.ACTIF
            coupon.facture_utilisation = None
            coupon.date_utilisation = None
            coupon.utilise_par = None
            coupon.save(update_fields=['status', 'facture_utilisation', 'date_utilisation', 'utilise_par'])
            logger.info(f"Coupon #{coupon.numero} restauré à ACTIF (annulation facture #{facture.numero_facture or facture.id})")

    @staticmethod
    def _cancel_payments(facture, user):
        """Annule les paiements associés et gère les dépôts clients."""
        payments = Caisse.objects.filter(facture=facture, statut='completee')
        for p in payments:
            if p.mode_paiement == 'depot' and facture.client:
                DepotClient.objects.create(
                    client=facture.client,
                    type=DepotClient.Type.ANNULATION_ACHAT,
                    montant=p.montant,
                    facture=facture,
                    created_by=user,
                    notes=f"Annulation Facture {facture.numero_facture or facture.id}"
                )
        payments.update(statut='annulee')
