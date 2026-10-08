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
from rest_framework.exceptions import ValidationError

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
from ..utils.validation import (
    MAX_DECIMAL_10_2,
    MAX_DECIMAL_12_2,
    MAX_DECIMAL_5_2,
    MAX_INT32,
    parse_decimal,
    parse_int,
    validation_error_message,
)
from .lot_allocation_service import LotAllocationService
from .promotion_service import PromotionService
from .realtime import notify_stock_changed
from .sale_integrity import is_invoice_period_closed
from .stock_obligation_service import StockObligationService

logger = logging.getLogger(__name__)


def _as_value_error(exc):
    """Convertit une ValidationError DRF en ValueError (contrat des services :
    les appelants traduisent ValueError en HTTP 400)."""
    return ValueError(validation_error_message(exc))


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

        if is_invoice_period_closed(facture):
            raise ValueError("Impossible de modifier cette facture : la période de caisse est déjà clôturée. Utilisez un avoir client.")

        val_date = getattr(facture, 'date', None)
        if val_date and hasattr(val_date, 'date') and val_date.date() < timezone.now().date():
            raise ValueError("Cette vente ne peut plus être modifiée car elle date d'un jour antérieur.")

        old_total = facture.total_ttc
        new_products = data.get('produits', [])

        if not new_products:
            raise ValueError("La liste des produits est requise.")

        # 1. Restore stock (temporary)
        old_quantity_by_product, _old_product_ids, _old_product_ids_with_allocations = \
            SaleModifier._restore_stock(facture)

        # 1b. Cancel pending promis linked to this invoice (they will be recreated by the
        # frontend if the new cart still has insufficient stock). Promis already DELIVRE
        # are preserved since they were honored.
        SaleModifier._cancel_pending_promis(facture, user)

        # 2. Apply changes to facture
        # Decimal fini >= 0 dans la borne du DecimalField(12, 2) de Facture.remise ;
        # 'abc'/'NaN'/-5 → ValueError → 400 (au lieu de InvalidOperation → 500).
        try:
            facture.remise = parse_decimal(
                data.get('remise', '0'), field='remise',
                min_value=Decimal(0), max_value=MAX_DECIMAL_12_2
            )
        except ValidationError as exc:
            raise _as_value_error(exc) from exc
        if data.get('client'):
            # Un dict/liste ici lèverait TypeError dans le .save() ORM → 500.
            try:
                facture.client_id = parse_int(
                    data.get('client'), field='client', min_value=1, max_value=MAX_INT32
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
        facture.client_name_override = data.get('client_name_override', facture.client_name_override)
        facture.save()

        # 3. Create new products and allocate
        new_quantity_by_product, _new_product_ids_with_allocations = \
            SaleModifier._create_new_products(facture, new_products, user)

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
    def _cancel_pending_promis(facture, user=None):
        """Annule les promis EN_ATTENTE liés à cette facture avant modification.
        Les promis DELIVRE sont préservés (ils ont été honorés)."""
        pending_promis = Promis.objects.filter(
            facture=facture, is_active=True, status=Promis.Status.EN_ATTENTE
        )
        for promis in pending_promis:
            StockObligationService.cancel_for_promis(promis, user=user)
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
        allocations, product_ids_with_allocations = LotAllocationService.restore_allocations(facture)
        covered_by_line = {}
        for alloc in allocations:
            covered_by_line[alloc.facture_produit_id] = (
                covered_by_line.get(alloc.facture_produit_id, 0) + alloc.quantity
            )

        pending_promis_map = {
            row['produit_id']: row['total'] or 0
            for row in Promis.objects.filter(
                facture=facture,
                status=Promis.Status.EN_ATTENTE,
                is_active=True,
            ).values('produit_id').annotate(total=Sum('quantite'))
        }

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

        restored_ids = []
        for item in old_items:
            old_quantity_by_product[item.produit_id] = old_quantity_by_product.get(item.produit_id, 0) + item.quantity
            old_product_ids.add(item.produit_id)
            produit = locked_products.get(item.produit_id) or item.produit
            residual_quantity = item.quantity - covered_by_line.get(item.id, 0)
            if residual_quantity > 0 and item.produit_id in pending_promis_map:
                residual_quantity -= min(residual_quantity, pending_promis_map[item.produit_id])
            if produit and residual_quantity > 0:
                Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + residual_quantity)
                restored_ids.append(item.produit_id)
        notify_stock_changed(restored_ids)

        for item in old_items:
            item.delete()

        return old_quantity_by_product, old_product_ids, product_ids_with_allocations

    @staticmethod
    def _create_new_products(facture, new_products, user):
        """Crée les nouvelles lignes FactureProduit, les promis et les lots."""
        new_quantity_by_product = {}
        new_product_ids_with_allocations = set()
        if not all(isinstance(p, dict) for p in new_products):
            raise ValueError("Format de ligne produit invalide.")
        # Les ids sont normalisés AVANT le filtre ORM : un dict/liste dans
        # id__in lèverait TypeError → 500.
        try:
            product_ids = [
                parse_int(p.get('produit'), field='produit', min_value=1, max_value=MAX_INT32)
                for p in new_products
            ]
        except ValidationError as exc:
            raise _as_value_error(exc) from exc
        # Verrouiller les produits pour éviter les race conditions
        if product_ids:
            products_by_id = {
                p.id: p
                for p in Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id')
            }
        else:
            products_by_id = {}

        virtual_stock_by_product = {
            pid: max(0, int(product.stock or 0))
            for pid, product in products_by_id.items()
        }

        for prod_data in new_products:
            if not isinstance(prod_data, dict):
                raise ValueError("Format de ligne produit invalide.")
            try:
                produit_id = parse_int(
                    prod_data.get('produit'), field='produit',
                    min_value=1, max_value=MAX_INT32
                )
                quantity = parse_int(
                    prod_data.get('quantity', 1), field='quantity',
                    max_value=MAX_INT32
                )
                selling_price = parse_decimal(
                    prod_data.get('selling_price', '0'), field='selling_price',
                    min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                )
                discount = parse_decimal(
                    prod_data.get('discount', '0'), field='discount',
                    min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                )
                tva = parse_decimal(
                    prod_data.get('tva', '0'), field='tva',
                    min_value=Decimal(0), max_value=MAX_DECIMAL_5_2
                )
                promis_quantity = parse_int(
                    prod_data.get('promis_quantity', 0), field='promis_quantity',
                    min_value=0, max_value=MAX_INT32
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
            lot_id = prod_data.get('lot_id')
            produit = products_by_id.get(produit_id)
            if produit is None:
                # Avant : produit_id=None créait une ligne fantôme, et un id
                # inexistant finissait en IntegrityError → 500.
                raise ValueError(f"Produit introuvable (id={produit_id}).")

            is_promis = bool(prod_data.get('is_promis')) and quantity > 0
            promis_quantity = min(promis_quantity, quantity) if is_promis else 0
            promis = None
            if promis_quantity > 0:
                promis = Promis.objects.create(
                    facture=facture,
                    client=facture.client,
                    client_name=facture.client_name_override or '',
                    client_phone=prod_data.get('promis_phone', '') or '',
                    produit=produit,
                    produit_nom=produit.name,
                    quantite=promis_quantity,
                    status=Promis.Status.EN_ATTENTE,
                    created_by=user,
                )

            fp = FactureProduit.objects.create(
                facture=facture, produit_id=produit_id, quantity=quantity,
                selling_price=selling_price, discount=discount,
                tva=tva, stock_lot_id=lot_id
            )
            new_quantity_by_product[produit_id] = new_quantity_by_product.get(produit_id, 0) + quantity

            delivered_quantity = quantity - promis_quantity if quantity > 0 else quantity
            allocated_quantity = 0
            if delivered_quantity > 0:
                allocated_quantity = SaleModifier._allocate_product_lots(
                    fp, produit, delivered_quantity, lot_id, selling_price
                )

            # Le stock comptable descend de la quantité facturée totale.
            Produit.objects.filter(pk=produit_id).update(stock=F('stock') - quantity)
            notify_stock_changed([produit_id])

            pending_allocations = []
            if promis and promis_quantity > 0:
                obligation = StockObligationService.create_obligation(
                    fp,
                    promis_quantity,
                    'PROMIS',
                    promis=promis,
                    user=user,
                )
                pending_allocations.append(FactureProduitAllocation(
                    facture_produit=fp,
                    stock_obligation=obligation,
                    is_pending=True,
                    quantity=promis_quantity,
                    cost_price=obligation.cost_price,
                    selling_price=selling_price,
                ))

            if quantity > 0 and produit.use_lot_management:
                forced_quantity = quantity - allocated_quantity - promis_quantity
            elif quantity > 0:
                available_without_lot = virtual_stock_by_product.get(produit_id, 0)
                covered_without_lot = min(delivered_quantity, available_without_lot)
                virtual_stock_by_product[produit_id] = available_without_lot - covered_without_lot
                if covered_without_lot > 0:
                    FactureProduitAllocation.objects.create(
                        facture_produit=fp,
                        stock_lot=None,
                        is_pending=False,
                        quantity=covered_without_lot,
                        cost_price=StockObligationService.estimated_cost(produit),
                        selling_price=selling_price,
                    )
                forced_quantity = delivered_quantity - covered_without_lot
            else:
                forced_quantity = 0

            if forced_quantity > 0:
                obligation = StockObligationService.create_obligation(
                    fp,
                    forced_quantity,
                    'FORCE',
                    user=user,
                )
                pending_allocations.append(FactureProduitAllocation(
                    facture_produit=fp,
                    stock_obligation=obligation,
                    is_pending=True,
                    quantity=forced_quantity,
                    cost_price=obligation.cost_price,
                    selling_price=selling_price,
                ))

            if pending_allocations:
                FactureProduitAllocation.objects.bulk_create(pending_allocations)

            if allocated_quantity:
                new_product_ids_with_allocations.add(produit_id)

            # Sync FactureProduit fields from allocated lots
            SaleModifier._sync_fp_lot_info(fp, lot_id, produit, allocated_quantity > 0)

        return new_quantity_by_product, new_product_ids_with_allocations

    @staticmethod
    def _allocate_product_lots(fp, produit, quantity, lot_id, selling_price):
        """Alloue les lots pour un FactureProduit. Retourne la quantité allouée."""
        if quantity <= 0 or not produit or not produit.use_lot_management:
            return 0

        if lot_id:
            try:
                target_lot = StockLot.objects.get(id=lot_id)
            except (StockLot.DoesNotExist, ValueError, TypeError) as exc:
                # Id invalide/inexistant : ValueError métier → 400 (au lieu de 500).
                raise ValueError(f"Lot de stock introuvable ou invalide (id={lot_id}).") from exc
            allocation = LotAllocationService.allocate_specific_lot(fp, target_lot, quantity, selling_price)
            return allocation.quantity if allocation else 0
        else:
            allocations, _lots_updated, _used_lot_names = LotAllocationService.allocate_fifo(fp, quantity, selling_price)
            return sum(alloc.quantity for alloc in allocations)

    @staticmethod
    def _sync_fp_lot_info(fp, lot_id, produit, lots_allocated):
        """Synchronise les champs lot et date_expiration du FactureProduit."""
        if lot_id:
            try:
                target_lot = StockLot.objects.get(id=lot_id)
            except (StockLot.DoesNotExist, ValueError, TypeError) as exc:
                # Id invalide/inexistant : ValueError métier → 400 (au lieu de 500).
                raise ValueError(f"Lot de stock introuvable ou invalide (id={lot_id}).") from exc
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
                # Signe : delta > 0 = RETOUR (+), delta < 0 = SORTIE (-)
                quantite=delta,
                stock_apres=product_stock_map.get(pid),
                user=user,
                facture=facture,
                description=f"{'Retour' if is_return else 'Sortie'} suite modification Facture #{facture.numero_facture or facture.id}",
                date=timezone.now()
            ))
        if mouvements:
            MouvementStock.objects.bulk_create(mouvements)
