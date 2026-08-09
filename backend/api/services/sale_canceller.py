"""
Annulation d'une facture : restauration des lots, du stock général,
annulation des promis, annulation des paiements.

Extrait de SalesService.cancel_invoice pour lisibilité et maintenabilité.
"""
import logging

from django.core.cache import cache
from django.db import transaction
from django.db.models import F
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

        if was_validated:
            # 1. Restore lot allocations
            _allocations, product_ids_with_allocations = LotAllocationService.restore_allocations(facture)

            # 2. Restore general stock for non-lot products
            old_items = list(FactureProduit.objects.filter(facture=facture).select_related('produit'))

            for item in old_items:
                produit = item.produit
                if produit and produit.use_lot_management and item.produit_id in product_ids_with_allocations:
                    produit.calculate_stock_from_lots()
                elif produit:
                    Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + item.quantity)

            # 3. Stock movements (traceability)
            SaleCanceller._create_cancellation_movements(facture, old_items, user)

        # 4. Cancel linked promis
        SaleCanceller._cancel_linked_promis(facture)

        # 5. Mark invoice as cancelled
        facture.status = Facture.Status.ANNULEE
        facture.date_annulation = timezone.now()
        facture.cancelled_by = user
        if motif:
            facture.notes = f"{facture.notes or ''}\n[Annulation le {facture.date_annulation.strftime('%d/%m/%Y %H:%M')}] Motif: {motif}".strip()
        facture.save(update_fields=['status', 'notes', 'date_annulation', 'cancelled_by'])

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
    def _cancel_linked_promis(facture):
        """Annule les promis liés à cette facture."""
        linked_promis = Promis.objects.filter(facture=facture, is_active=True)
        for promis in linked_promis:
            if promis.status in (Promis.Status.EN_ATTENTE, Promis.Status.DELIVRE):
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
