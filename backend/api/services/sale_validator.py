"""
Validation d'une facture : vérification stock, allocation FIFO/FEFO des lots,
déstockage, gestion fidélité, promotions.

Extrait de SalesService.validate_invoice pour lisibilité et maintenabilité.
"""
import logging
from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from ..models import (
    Caisse,
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    LoyaltySetting,
    Produit,
    Promis,
    StockLot,
)
from .lot_allocation_service import LotAllocationService
from .promotion_service import PromotionService

logger = logging.getLogger(__name__)


class SaleValidator:
    """Valide une facture : stock, lots, fidélité, promotions."""

    @staticmethod
    @transaction.atomic
    def validate_invoice(facture, validation_user, data):
        """
        Performs stock validation, FIFO/FEFO allocation, loyalty updates.
        The validation_user is the user who authorized the sale (e.g. via sudo).
        """
        if facture.status == Facture.Status.VALIDEE:
            return facture

        if facture.status not in [Facture.Status.BROUILLON, Facture.Status.PROFORMA]:
            raise ValueError(f"Impossible de valider une facture avec le statut {facture.get_status_display()}.")

        items = FactureProduit.objects.filter(facture=facture)

        # 1. Integrity check
        if facture.remise > facture.total_ht:
            raise ValueError(f"La remise globale ({facture.remise} F) ne peut pas être supérieure au total des produits ({facture.total_ht} F).")

        # 2. Verrouillage pessimiste — fetch products with FOR UPDATE
        # Empêche deux transactions concurrentes de lire le même stock
        # et de passer toutes les deux la vérification de stock.
        product_ids = [item.produit_id for item in items]
        products_map = {
            p.id: p
            for p in Produit.objects.select_for_update().filter(id__in=product_ids)
        }

        # 3. Credit ceiling check
        SaleValidator._check_credit_ceiling(facture, data)

        # 4. Stock check (accounting for promis)
        SaleValidator._check_stock(items, products_map, facture, validation_user)

        # 5. Lot allocation (FIFO/FEFO) with optimistic locking
        (
            allocations_to_create, items_to_update, lots_to_update_set,
            prods_to_sync_from_lots, manual_stock_decrements
        ) = SaleValidator._allocate_lots(items, products_map)

        # Execute bulk ops
        if allocations_to_create:
            FactureProduitAllocation.objects.bulk_create(allocations_to_create)
        if items_to_update:
            FactureProduit.objects.bulk_update(items_to_update, ['lot', 'date_expiration'])
        if lots_to_update_set:
            StockLot.objects.bulk_update(list(lots_to_update_set), ['quantity_remaining', 'quantity_free_remaining'])
        if manual_stock_decrements:
            for pid, qty in manual_stock_decrements.items():
                Produit.objects.filter(id=pid).update(stock=F('stock') - qty)
        if prods_to_sync_from_lots:
            LotAllocationService.sync_stock_from_lots(prods_to_sync_from_lots)

        # 6. Stock movements (traceability)
        LotAllocationService.create_stock_movements(items, facture, validation_user, prefix="Vente")

        # 7. Loyalty management
        SaleValidator._handle_loyalty(facture, data)

        # 8. Final updates
        facture.status = Facture.Status.VALIDEE
        facture._skip_audit = True
        # À la validation, remplacer le numéro DEV-XXXXXX par FAC-XXXXXX
        # (un devis validé devient une facture)
        if not facture.numero_facture or facture.numero_facture.startswith('DEV-'):
            facture.numero_facture = f"FAC-{facture.id:06d}"
        if not facture.validated_by:
            facture.validated_by = validation_user
        facture.save(update_fields=[
            'status', 'numero_facture', 'validated_by',
            'points_fidelite_utilises', 'montant_fidelite', 'points_fidelite_gagnes'
        ])

        Produit.objects.filter(id__in=product_ids).update(dernier_vente=timezone.now().date())
        PromotionService.apply_promotions_to_invoice(facture)
        facture.calculate_totals(save=True)

        # 9. Automated debt for professional clients
        SaleValidator._handle_professional_debt(facture, validation_user)

        # Cache invalidation
        cache_key = f'stats_jour_{timezone.now().strftime("%Y-%m-%d")}'
        cache.delete(cache_key)

        return facture

    # ──────────────────────────────────────────────
    #  Private helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _check_credit_ceiling(facture, data):
        """Vérifie le plafond de crédit pour les clients professionnels."""
        if not facture.client:
            return
        paiement_immediat = Decimal(str(data.get('paiement_immediat', 0)))
        new_debt_increment = max(Decimal(0), facture.total_ttc - paiement_immediat)

        if (facture.client.client_type == 'PROFESSIONNEL'
                and facture.client.plafond != Decimal(-1)
                and (facture.client.current_debt + new_debt_increment) > facture.client.plafond):
            raise ValueError(
                f"Le plafond de crédit du client professionnel est dépassé "
                f"(Limite: {facture.client.plafond} F, Dette actuelle: {facture.client.current_debt} F, "
                f"Nouveau: +{new_debt_increment} F)."
            )

    @staticmethod
    def _check_stock(items, products_map, facture, validation_user):
        """Vérifie que le stock est suffisant pour tous les items (hors promis)."""
        requested_map = {}
        for item in items:
            requested_map[item.produit_id] = requested_map.get(item.produit_id, 0) + item.quantity

        promis_map = {p.produit_id: p.quantite for p in Promis.objects.filter(facture=facture)}

        can_sell_negative = validation_user.is_superuser or (
            hasattr(validation_user, 'profile') and validation_user.profile.can_sell_negative_stock
        )

        for pid, total_qty in requested_map.items():
            produit = products_map.get(pid)
            if not produit:
                continue

            promis_qty = promis_map.get(pid, 0)
            effective_qty = Decimal(str(total_qty - promis_qty))

            if effective_qty > 0 and produit.stock < effective_qty and not can_sell_negative:
                raise ValueError(
                    f"Stock insuffisant pour le produit {produit.name}. "
                    f"Quantité totale demandée: {total_qty}, Disponible: {produit.stock}"
                )

            if effective_qty < 0:
                can_return = validation_user.is_superuser or (
                    hasattr(validation_user, 'profile') and validation_user.profile.can_do_returns
                )
                if not can_return:
                    raise ValueError(f"Permission de retour refusée pour {produit.name}.")

    @staticmethod
    def _allocate_lots(items, products_map):
        """
        Effectue l'allocation des lots (FIFO/FEFO ou lot spécifique ou allocation explicite).
        Retourne (allocations, items_to_update, lots_to_update, prods_to_sync, manual_decrements).
        """
        # Lock lots referenced explicitly
        lot_ids_to_lock = [item.stock_lot_id for item in items if item.stock_lot_id]
        explicit_alloc_lot_ids = [
            alloc.get('lot_id') or alloc.get('stock_lot_id')
            for item in items
            for alloc in getattr(item, '_lot_allocations', []) or []
            if alloc.get('lot_id') or alloc.get('stock_lot_id')
        ]
        all_lot_ids = list(set(lot_ids_to_lock + explicit_alloc_lot_ids))
        lots_map = {l.id: l for l in StockLot.objects.filter(id__in=all_lot_ids)} if all_lot_ids else {}
        initial_lot_versions = {lid: l.version for lid, l in lots_map.items()}

        # Prepare FIFO queues
        fifo_prods = [
            item.produit_id for item in items
            if item.quantity > 0 and not item.stock_lot_id and not getattr(item, '_lot_allocations', None)
        ]
        fifo_lots_queue = {}
        if fifo_prods:
            fifo_lots = StockLot.objects.filter(
                produit_id__in=fifo_prods, quantity_remaining__gt=0
            ).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
            for lot in fifo_lots:
                fifo_lots_queue.setdefault(lot.produit_id, []).append(lot)

        allocations_to_create = []
        items_to_update = []
        lots_to_update_set = set()
        prods_to_sync_from_lots = set()
        manual_stock_decrements = {}

        for item in items:
            produit = products_map.get(item.produit_id)
            if not produit:
                continue
            lots_updated = False

            if item.quantity > 0:
                lots_updated = SaleValidator._allocate_positive_item(
                    item, produit, lots_map, fifo_lots_queue,
                    allocations_to_create, lots_to_update_set, items_to_update
                )
            elif getattr(item, '_lot_allocations', None):
                lots_updated = SaleValidator._allocate_explicit(
                    item, produit, lots_map, initial_lot_versions,
                    allocations_to_create, lots_to_update_set, items_to_update
                )
            elif item.quantity < 0:
                lots_updated = SaleValidator._handle_return(
                    item, produit, lots_map,
                    lots_to_update_set, items_to_update
                )

            if produit.use_lot_management and lots_updated:
                prods_to_sync_from_lots.add(produit.id)
            else:
                manual_stock_decrements[produit.id] = manual_stock_decrements.get(produit.id, 0) + item.quantity

        return allocations_to_create, items_to_update, lots_to_update_set, prods_to_sync_from_lots, manual_stock_decrements

    @staticmethod
    def _allocate_positive_item(item, produit, lots_map, fifo_lots_queue,
                                  allocations_to_create, lots_to_update_set, items_to_update):
        """Alloue un item à quantité positive (vente) — lot spécifié ou FIFO."""
        qty_to_alloc = item.quantity

        if item.stock_lot_id:
            target_lot = lots_map.get(item.stock_lot_id)
            if target_lot is None:
                raise ValueError(f"Lot de stock {item.stock_lot_id} introuvable pour le produit {item.produit_id}.")
            if target_lot.quantity_remaining < qty_to_alloc:
                raise ValueError(f"Stock insuffisant dans le lot {target_lot.lot}.")

            allocations_to_create.append(FactureProduitAllocation(
                facture_produit=item, stock_lot=target_lot, quantity=qty_to_alloc,
                cost_price=target_lot.price_cost, selling_price=item.selling_price
            ))
            target_lot.quantity_remaining -= qty_to_alloc
            if target_lot.quantity_free_remaining > 0:
                target_lot.quantity_free_remaining -= min(qty_to_alloc, target_lot.quantity_free_remaining)
            lots_to_update_set.add(target_lot)
            item.lot = target_lot.lot[:20]
            item.date_expiration = target_lot.date_expiration
            items_to_update.append(item)
            return True
        else:
            available = fifo_lots_queue.get(produit.id, [])
            used_lot_names = []
            for lot in available:
                if qty_to_alloc <= 0:
                    break
                qty_from_lot = min(lot.quantity_remaining, qty_to_alloc)
                allocations_to_create.append(FactureProduitAllocation(
                    facture_produit=item, stock_lot=lot, quantity=qty_from_lot,
                    cost_price=lot.price_cost, selling_price=item.selling_price
                ))
                lot.quantity_remaining -= qty_from_lot
                if lot.quantity_free_remaining > 0:
                    lot.quantity_free_remaining -= min(qty_from_lot, lot.quantity_free_remaining)
                lots_to_update_set.add(lot)
                used_lot_names.append(lot.lot)
                qty_to_alloc -= qty_from_lot
            if used_lot_names:
                item.lot = ",".join([n for n in used_lot_names if n])[:20]
                if available:
                    item.date_expiration = available[0].date_expiration
                items_to_update.append(item)
                return True
            return False

    @staticmethod
    def _allocate_explicit(item, produit, lots_map, initial_lot_versions,
                            allocations_to_create, lots_to_update_set, items_to_update):
        """Alloue selon les allocations explicites définies par l'utilisateur."""
        used_lot_names = []
        for alloc in item._lot_allocations:
            lot_id = alloc.get('lot_id') or alloc.get('stock_lot_id')
            qty = int(alloc.get('quantity', 0))
            if not lot_id or qty <= 0:
                continue
            target_lot = lots_map.get(lot_id)
            if target_lot is None:
                raise ValueError(f"Lot de stock {lot_id} introuvable pour le produit {item.produit_id}.")
            if target_lot.quantity_remaining < qty:
                raise ValueError(f"Stock insuffisant dans le lot {target_lot.lot} (demandé {qty}, disponible {target_lot.quantity_remaining}).")
            allocations_to_create.append(FactureProduitAllocation(
                facture_produit=item, stock_lot=target_lot, quantity=qty,
                cost_price=target_lot.price_cost, selling_price=item.selling_price
            ))
            target_lot.quantity_remaining -= qty
            if target_lot.quantity_free_remaining > 0:
                target_lot.quantity_free_remaining -= min(qty, target_lot.quantity_free_remaining)
            lots_to_update_set.add(target_lot)
            used_lot_names.append(target_lot.lot)
        if used_lot_names:
            item.lot = ",".join([n for n in used_lot_names if n])[:20]
            item.date_expiration = None
            items_to_update.append(item)
            return True
        return False

    @staticmethod
    def _handle_return(item, produit, lots_map, lots_to_update_set, items_to_update):
        """Gère un retour produit (quantité négative)."""
        target_lot = lots_map.get(item.stock_lot_id) or (
            StockLot.objects.filter(produit=produit).order_by('-created_at').first()
            if produit.use_lot_management else None
        )
        if target_lot:
            target_lot.quantity_remaining -= item.quantity  # item.quantity is negative
            restoring_qty = -item.quantity
            space_for_free = target_lot.quantity_free - target_lot.quantity_free_remaining
            if space_for_free > 0:
                target_lot.quantity_free_remaining += min(restoring_qty, space_for_free)
            lots_to_update_set.add(target_lot)
            item.lot = (target_lot.lot or "RETOUR")[:20]
            item.date_expiration = target_lot.date_expiration
            items_to_update.append(item)
            return True
        return False

    @staticmethod
    def _handle_loyalty(facture, data):
        """Gère les points de fidélité pour les clients non-professionnels."""
        if not facture.client:
            return
        if facture.client.client_type == 'PROFESSIONNEL':
            return
        if not facture.client.is_loyalty_member:
            return
        if facture.client.name.strip().upper() == 'CLIENTS DIVERS':
            return

        loyalty_conf = LoyaltySetting.objects.first()
        if not loyalty_conf:
            return

        client = facture.client
        client._skip_audit = True
        save_client = False

        if str(data.get('use_pending_discount', False)).lower() == 'true' and client.pending_discount > 0:
            client.pending_discount = 0
            save_client = True

        points_to_use = int(data.get('points_to_use', 0))
        if points_to_use > 0 and client.points_fidelite >= points_to_use:
            client.points_fidelite -= points_to_use
            facture.points_fidelite_utilises = points_to_use
            facture.montant_fidelite = points_to_use * loyalty_conf.point_value
            save_client = True

        if facture.total_ttc > 0 and loyalty_conf.amount_per_point > 0:
            points_gagnes = int(facture.total_ttc // loyalty_conf.amount_per_point)
            facture.points_fidelite_gagnes = points_gagnes
            client.points_fidelite += points_gagnes
            save_client = True

        if loyalty_conf.auto_reward_threshold > 0 and client.points_fidelite >= loyalty_conf.auto_reward_threshold:
            client.points_fidelite -= loyalty_conf.auto_reward_threshold
            client.pending_discount = max(client.pending_discount, loyalty_conf.auto_reward_percent)
            save_client = True

        if save_client:
            client.save()

    @staticmethod
    def _handle_professional_debt(facture, validation_user):
        """Crée une dette automatique pour les clients professionnels."""
        if not facture.client or facture.client.client_type != 'PROFESSIONNEL':
            return
        if facture.part_client is None:
            return

        part_assurance = facture.total_ttc - Decimal(str(facture.part_client))
        if part_assurance <= 0:
            return

        paiement_en_compte = Caisse.objects.create(
            facture=facture, mode_paiement='en_compte', montant=part_assurance,
            statut='completee', user=validation_user,
            part_assurance=part_assurance, part_patient=Decimal('0.00')
        )
        from .payment_service import PaymentService
        PaymentService.process_payment(paiement_en_compte, is_created=True)
