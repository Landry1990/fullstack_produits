"""
Modification d'une vente validée : restauration temporaire du stock,
application des modifications, ré-allocation des lots, recalcul des totaux.

Extrait de SalesService.modify_sale pour lisibilité et maintenabilité.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from ..models import (
    Caisse,
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    MouvementStock,
    Produit,
    Promis,
    StockLot,
)
from .lot_allocation_service import LotAllocationService
from .promotion_service import PromotionService

logger = logging.getLogger(__name__)


class SaleModifier:
    """Modifie une facture validée et ajuste le stock."""

    @staticmethod
    @transaction.atomic
    def modify_sale(facture, user, data):
        """
        Modifies a validated invoice, adjusts products, and creates payment adjustments.
        Returns (facture, old_total, difference).
        """
        if facture.status not in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
            raise ValueError("Seules les factures validées ou payées peuvent être modifiées.")

        val_date = getattr(facture, 'date', None)
        if val_date and hasattr(val_date, 'date') and val_date.date() < timezone.now().date():
            raise ValueError("Cette vente ne peut plus être modifiée car elle date d'un jour antérieur.")

        old_total = facture.total_ttc
        new_products = data.get('produits', [])

        if not new_products:
            raise ValueError("La liste des produits est requise.")

        # 1. Restore stock (temporary)
        old_quantity_by_product, _old_product_ids, old_product_ids_with_allocations = \
            SaleModifier._restore_stock(facture)

        # 1b. Cancel pending promis linked to this invoice (they will be recreated by the
        # frontend if the new cart still has insufficient stock). Promis already DELIVRE
        # are preserved since they were honored.
        SaleModifier._cancel_pending_promis(facture)

        # 2. Apply changes to facture
        facture.remise = Decimal(str(data.get('remise', '0')))
        if data.get('client'):
            facture.client_id = data.get('client')
        facture.client_name_override = data.get('client_name_override', facture.client_name_override)
        facture.save()

        # 3. Create new products and allocate
        new_quantity_by_product, new_product_ids_with_allocations = \
            SaleModifier._create_new_products(facture, new_products)

        # Sync stock from lots for products that had lot allocations
        products_to_sync = old_product_ids_with_allocations | new_product_ids_with_allocations
        for pid in products_to_sync:
            produit = Produit.objects.filter(pk=pid).first()
            if produit and produit.use_lot_management:
                produit.calculate_stock_from_lots()

        # 4. Finalize totals and adjustment
        PromotionService.apply_promotions_to_invoice(facture)
        facture.calculate_totals(save=True)
        facture.refresh_from_db()
        difference = facture.total_ttc - old_total

        SaleModifier._handle_payment_adjustment(facture, difference, user)

        # 5. Traceability: stock movements
        SaleModifier._create_modification_movements(
            facture, user, old_quantity_by_product, new_quantity_by_product
        )

        return facture, old_total, difference, old_quantity_by_product, new_quantity_by_product

    # ──────────────────────────────────────────────
    #  Private helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _cancel_pending_promis(facture):
        """Annule les promis EN_ATTENTE liés à cette facture avant modification.
        Les promis DELIVRE sont préservés (ils ont été honorés)."""
        pending_promis = Promis.objects.filter(
            facture=facture, is_active=True, status=Promis.Status.EN_ATTENTE
        )
        for promis in pending_promis:
            promis.status = Promis.Status.ANNULE
            promis.date_livraison = None
            promis.notes = (
                f"{promis.notes or ''}\n"
                f"[Annulé automatiquement - Modification Facture #{facture.numero_facture or facture.id} "
                f"le {timezone.now().strftime('%d/%m/%Y %H:%M')}]"
            ).strip()
            promis.save(update_fields=['status', 'date_livraison', 'notes'])

    @staticmethod
    def _restore_stock(facture):
        """Restaure temporairement le stock avant modification."""
        _allocations, product_ids_with_allocations = LotAllocationService.restore_allocations(facture)

        old_items = list(FactureProduit.objects.filter(facture=facture).select_related('produit'))
        old_quantity_by_product = {}
        old_product_ids = set()

        # Verrouiller les produits pour éviter les race conditions
        product_ids = [item.produit_id for item in old_items if item.produit_id]
        if product_ids:
            locked_products = {
                p.id: p
                for p in Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id')
            }
        else:
            locked_products = {}

        for item in old_items:
            old_quantity_by_product[item.produit_id] = old_quantity_by_product.get(item.produit_id, 0) + item.quantity
            old_product_ids.add(item.produit_id)
            produit = locked_products.get(item.produit_id) or item.produit
            if produit and (not produit.use_lot_management or item.produit_id not in product_ids_with_allocations):
                Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + item.quantity)

        for item in old_items:
            item.delete()

        return old_quantity_by_product, old_product_ids, product_ids_with_allocations

    @staticmethod
    def _create_new_products(facture, new_products):
        """Crée les nouvelles lignes FactureProduit et alloue les lots."""
        new_quantity_by_product = {}
        new_product_ids_with_allocations = set()
        product_ids = [p.get('produit') for p in new_products]
        # Verrouiller les produits pour éviter les race conditions
        if product_ids:
            products_by_id = {
                p.id: p
                for p in Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id')
            }
        else:
            products_by_id = {}

        for prod_data in new_products:
            produit_id = prod_data.get('produit')
            quantity = int(prod_data.get('quantity', 1))
            selling_price = prod_data.get('selling_price', '0')
            lot_id = prod_data.get('lot_id')
            produit = products_by_id.get(produit_id)

            fp = FactureProduit.objects.create(
                facture=facture, produit_id=produit_id, quantity=quantity,
                selling_price=selling_price, discount=Decimal(str(prod_data.get('discount', '0'))),
                tva=Decimal(str(prod_data.get('tva', '0'))), stock_lot_id=lot_id
            )
            new_quantity_by_product[produit_id] = new_quantity_by_product.get(produit_id, 0) + quantity

            lots_allocated = SaleModifier._allocate_product_lots(fp, produit, quantity, lot_id, selling_price)

            if lots_allocated:
                new_product_ids_with_allocations.add(produit_id)
            elif produit and not produit.use_lot_management:
                Produit.objects.filter(pk=produit_id).update(stock=F('stock') - quantity)

            # Sync FactureProduit fields from allocated lots
            SaleModifier._sync_fp_lot_info(fp, lot_id, produit, lots_allocated)

        return new_quantity_by_product, new_product_ids_with_allocations

    @staticmethod
    def _allocate_product_lots(fp, produit, quantity, lot_id, selling_price):
        """Alloue les lots pour un FactureProduit. Retourne True si des lots ont été alloués."""
        if quantity <= 0 or not produit or not produit.use_lot_management:
            return False

        if lot_id:
            target_lot = StockLot.objects.get(id=lot_id)
            LotAllocationService.allocate_specific_lot(fp, target_lot, quantity, selling_price)
            return True
        else:
            _, _, used_lot_names = LotAllocationService.allocate_fifo(fp, quantity, selling_price)
            return len(used_lot_names) > 0

    @staticmethod
    def _sync_fp_lot_info(fp, lot_id, produit, lots_allocated):
        """Synchronise les champs lot et date_expiration du FactureProduit."""
        if lot_id:
            target_lot = StockLot.objects.get(id=lot_id)
            fp.lot = target_lot.lot[:20]
            fp.date_expiration = target_lot.date_expiration
            fp.save(update_fields=['lot', 'date_expiration'])
        elif produit and produit.use_lot_management and lots_allocated:
            allocations = FactureProduitAllocation.objects.filter(facture_produit=fp).select_related('stock_lot')
            if allocations.exists():
                fp.lot = ",".join([a.stock_lot.lot for a in allocations if a.stock_lot and a.stock_lot.lot])[:20]
                exp_dates = [a.stock_lot.date_expiration for a in allocations if a.stock_lot and a.stock_lot.date_expiration]
                fp.date_expiration = min(exp_dates) if exp_dates else None
                fp.save(update_fields=['lot', 'date_expiration'])

    @staticmethod
    def _handle_payment_adjustment(facture, difference, user):
        """Crée un ajustement de paiement si nécessaire."""
        if difference == 0:
            return

        total_paye = Caisse.objects.filter(facture=facture, statut='completee').aggregate(
            total=Sum('montant')
        )['total'] or Decimal(0)

        if total_paye > 0 or facture.status == Facture.Status.PAYEE:
            paiement_adj = Caisse.objects.create(
                facture=facture, mode_paiement='especes', montant=difference,
                statut='completee', user=user,
                reference=f"Ajustement modification facture {facture.numero_facture or facture.id}"
            )
            from .payment_service import PaymentService
            PaymentService.process_payment(paiement_adj, is_created=True)

    @staticmethod
    def _create_modification_movements(facture, user, old_quantity_by_product, new_quantity_by_product):
        """Crée les mouvements de stock pour la modification."""
        all_product_ids = set(old_quantity_by_product.keys()) | set(new_quantity_by_product.keys())
        if not all_product_ids:
            return

        updated_products = Produit.objects.filter(id__in=all_product_ids)
        product_stock_map = {p.id: p.total_stock for p in updated_products}

        mouvements = []
        for pid in all_product_ids:
            old_qty = old_quantity_by_product.get(pid, 0)
            new_qty = new_quantity_by_product.get(pid, 0)
            delta = old_qty - new_qty
            if delta == 0:
                continue
            is_return = delta > 0
            mouvements.append(MouvementStock(
                produit_id=pid,
                type_mouvement=(
                    MouvementStock.TypeMouvement.RETOUR if is_return
                    else MouvementStock.TypeMouvement.SORTIE
                ),
                quantite=delta if is_return else -delta,
                stock_apres=product_stock_map.get(pid),
                user=user,
                facture=facture,
                description=f"{'Retour' if is_return else 'Sortie'} suite modification Facture #{facture.numero_facture or facture.id}",
                date=timezone.now()
            ))
        if mouvements:
            MouvementStock.objects.bulk_create(mouvements)
