"""
Service centralisé pour la gestion des allocations de lots (FIFO/FEFO),
restauration d'allocations et synchronisation du stock depuis les lots.

Factorise la logique commune entre SaleValidator, SaleCanceller et SaleModifier.
"""
import logging

from django.db.models import F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..models import (
    FactureProduitAllocation,
    MouvementStock,
    Produit,
    StockLot,
    StockObligation,
    StockObligationResolution,
)
from ..utils.expiry import expired_before
from .realtime import notify_stock_changed
from .stock_obligation_service import StockObligationService

logger = logging.getLogger(__name__)


class LotAllocationService:
    """Centralise toutes les opérations d'allocation et restauration de lots."""

    # ──────────────────────────────────────────────
    #  Restauration d'allocations
    # ──────────────────────────────────────────────

    @staticmethod
    def restore_allocations(facture):
        """
        Restaure les allocations d'une facture sans écraser les autres dettes
        de stock du produit.

        - allocation résolue avec lot : remet la quantité dans le lot ;
        - allocation résolue sans lot : réintègre le compteur produit ;
        - allocation en attente : annule l'obligation de stock correspondante.
        """
        allocations = list(
            FactureProduitAllocation.objects.filter(facture_produit__facture=facture)
            .select_related(
                'stock_lot', 'stock_obligation',
                'facture_produit', 'facture_produit__produit'
            )
        )
        lot_ids = [alloc.stock_lot_id for alloc in allocations if alloc.stock_lot_id]
        locked_lots = {
            lot.id: lot
            for lot in StockLot.objects.filter(id__in=lot_ids).select_for_update().order_by('id')
        } if lot_ids else {}
        product_ids = {
            alloc.facture_produit.produit_id
            for alloc in allocations
            if alloc.facture_produit and alloc.facture_produit.produit_id
        }
        locked_products = {
            produit.id: produit
            for produit in Produit.objects.filter(id__in=product_ids).select_for_update().order_by('id')
        } if product_ids else {}
        StockObligationService.reapply_pending_obligations(product_ids)

        product_stock_deltas = {}
        obligations_to_update = []
        lots_to_update = set()
        resolved_obligation_ids = set()

        for alloc in allocations:
            produit_id = alloc.facture_produit.produit_id if alloc.facture_produit else None
            obligation = alloc.stock_obligation
            if obligation:
                resolved_obligation_ids.add(obligation.id)

            if alloc.is_pending:
                if obligation:
                    if obligation.status == StockObligation.Status.EN_ATTENTE:
                        if obligation.stock_applied:
                            product_stock_deltas[produit_id] = (
                                product_stock_deltas.get(produit_id, 0) + alloc.quantity
                            )
                        obligation.quantity_remaining = 0
                        obligation.stock_applied = False
                        obligation.status = StockObligation.Status.ANNULEE
                        obligation.cancelled_at = timezone.now()
                    obligations_to_update.append(obligation)
                else:
                    product_stock_deltas[produit_id] = (
                        product_stock_deltas.get(produit_id, 0) + alloc.quantity
                    )
                continue

            if alloc.stock_lot_id:
                lot = locked_lots.get(alloc.stock_lot_id)
                if lot:
                    lot.quantity_remaining += alloc.quantity
                    lot.quantity_free_remaining = min(
                        lot.quantity_free_remaining + getattr(alloc, 'quantity_free', 0),
                        lot.quantity_free
                    )
                    lots_to_update.add(lot)
                product_stock_deltas[produit_id] = (
                    product_stock_deltas.get(produit_id, 0) + alloc.quantity
                )
            else:
                product_stock_deltas[produit_id] = (
                    product_stock_deltas.get(produit_id, 0) + alloc.quantity
                )

            if obligation and obligation.status != StockObligation.Status.ANNULEE:
                obligation.quantity_remaining = 0
                obligation.stock_applied = False
                obligation.status = StockObligation.Status.ANNULEE
                obligation.cancelled_at = timezone.now()
                obligations_to_update.append(obligation)

        if lots_to_update:
            StockLot.objects.bulk_update(
                list(lots_to_update),
                ['quantity_remaining', 'quantity_free_remaining'],
                batch_size=100,
            )
        if product_stock_deltas:
            for produit_id, delta in product_stock_deltas.items():
                if delta and produit_id in locked_products:
                    Produit.objects.filter(pk=produit_id).update(stock=F('stock') + delta)
            notify_stock_changed(product_stock_deltas.keys())
        if obligations_to_update:
            unique_obligations = {obligation.id: obligation for obligation in obligations_to_update}
            FactureProduitAllocation.objects.filter(id__in=[a.id for a in allocations]).delete()
            StockObligation.objects.bulk_update(
                list(unique_obligations.values()),
                ['quantity_remaining', 'stock_applied', 'status', 'cancelled_at'],
                batch_size=100,
            )
        else:
            FactureProduitAllocation.objects.filter(id__in=[a.id for a in allocations]).delete()

        if resolved_obligation_ids:
            StockObligationResolution.objects.filter(
                obligation_id__in=resolved_obligation_ids
            ).delete()

        product_ids_with_allocations = set()
        for alloc in allocations:
            if alloc.facture_produit and alloc.facture_produit.produit_id:
                product_ids_with_allocations.add(alloc.facture_produit.produit_id)

        return allocations, product_ids_with_allocations

    # ──────────────────────────────────────────────
    #  Synchronisation stock depuis les lots
    # ──────────────────────────────────────────────

    @staticmethod
    def sync_stock_from_lots(product_ids):
        """
        Recalcule produit.stock depuis la somme des quantity_remaining des lots
        pour les produits gérés par lots.

        Utilisé par validate_invoice, cancel_invoice et modify_sale.
        """
        if not product_ids:
            return
        for produit in Produit.objects.filter(
            id__in=product_ids,
            use_lot_management=True,
        ):
            produit.calculate_stock_from_lots()

    # ──────────────────────────────────────────────
    #  Stock issu d'un import fichier (catalogue/quantités)
    # ──────────────────────────────────────────────

    @staticmethod
    def apply_imported_stock(produit, quantity, *, absolute=True, cost_price=None, selling_price=None):
        """
        Applique une quantité de stock issue d'un import Excel/CSV.

        Pour un produit géré par lots, ``Produit.stock`` est **dérivé** des
        ``StockLot`` (recalculé par signal à chaque lot.save()) : écrire le
        compteur directement créerait du « stock fantôme » — vendable à
        l'écran, sans lot physique derrière, et écrasé silencieusement à la
        prochaine opération touchant un lot. On ajuste donc les lots :

        - delta positif → création d'un lot d'import (numéro ``IMP…``),
        - delta négatif (``absolute=True`` seulement) → déduction FIFO des
          lots existants (rayon puis réserve).

        ``absolute=True`` : ``quantity`` est le stock physique total visé.
        ``absolute=False`` : ``quantity`` est ajoutée au stock physique — une
        valeur négative est ignorée (écrêtée à 0, jamais déduite des lots).

        Pour un produit sans gestion de lots, le compteur est mis à jour
        directement (comportement historique inchangé).
        """
        quantity = int(quantity or 0)
        if quantity < 0 and not absolute:
            quantity = 0

        physical = produit.stock_lots.aggregate(
            rem=Coalesce(Sum('quantity_remaining'), 0),
            res=Coalesce(Sum('quantity_reserved'), 0),
        )
        physical_total = int(physical['rem']) + int(physical['res'])

        if not produit.use_lot_management:
            produit.stock = max(0, quantity) if absolute else (produit.stock or 0) + max(0, quantity)
            return

        target = max(0, quantity) if absolute else physical_total + max(0, quantity)
        delta = target - physical_total

        if delta > 0:
            base = f"IMP{timezone.now():%y%m%d%H%M%S}"
            lot_number, suffix = base[:20], 1
            while StockLot.objects.filter(produit=produit, lot=lot_number).exists():
                tag = f"-{suffix}"
                lot_number = base[:20 - len(tag)] + tag
                suffix += 1
            StockLot.objects.create(
                produit=produit,
                lot=lot_number,
                quantity_initial=delta,
                quantity_paid=delta,
                quantity_remaining=delta,
                price_cost=cost_price if cost_price is not None else (produit.cost_price or 0),
                selling_price=selling_price if selling_price is not None else (produit.selling_price or 0),
                date_reception=timezone.now(),
            )
        elif delta < 0:
            to_remove = -delta
            for lot in produit.stock_lots.filter(
                Q(quantity_remaining__gt=0) | Q(quantity_reserved__gt=0)
            ).order_by('date_reception', 'id'):
                if to_remove <= 0:
                    break
                taken = min(lot.quantity_remaining, to_remove)
                lot.quantity_remaining -= taken
                to_remove -= taken
                if to_remove > 0:
                    taken = min(lot.quantity_reserved, to_remove)
                    lot.quantity_reserved -= taken
                    to_remove -= taken
                lot.save(update_fields=['quantity_remaining', 'quantity_reserved'])

    # ──────────────────────────────────────────────
    #  Allocation FIFO/FEFO pour un item unique
    # ──────────────────────────────────────────────

    @staticmethod
    def allocate_fifo(facture_produit, quantity, selling_price=None):
        """
        Alloue une quantité depuis les lots disponibles (FIFO/FEFO) pour un FactureProduit.
        Crée les FactureProduitAllocation et met à jour les lots.

        Retourne (allocations_created, lots_updated, used_lot_names) ou
        ([], [], []) si aucun lot n'était disponible.
        """
        if quantity <= 0:
            return [], [], []

        produit_id = facture_produit.produit_id
        sp = selling_price or facture_produit.selling_price

        expiry_cut = expired_before(timezone.localdate())
        available_lots = list(
            StockLot.objects.filter(
                produit_id=produit_id,
                quantity_remaining__gt=0
            ).filter(
                Q(date_expiration__gte=expiry_cut) | Q(date_expiration__isnull=True)
            ).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
        )

        if not available_lots:
            return [], [], []

        allocations_created = []
        lots_updated = []
        used_lot_names = []
        qty_to_alloc = quantity

        for lot in available_lots:
            if qty_to_alloc <= 0:
                break
            qty_from_lot = min(lot.quantity_remaining, qty_to_alloc)
            free_taken = min(qty_from_lot, lot.quantity_free_remaining) if lot.quantity_free_remaining > 0 else 0
            allocations_created.append(FactureProduitAllocation(
                facture_produit=facture_produit,
                stock_lot=lot,
                quantity=qty_from_lot,
                quantity_free=free_taken,
                cost_price=lot.price_cost,
                selling_price=sp
            ))
            lot.quantity_remaining -= qty_from_lot
            lot.quantity_free_remaining -= free_taken
            lots_updated.append(lot)
            used_lot_names.append(lot.lot)
            qty_to_alloc -= qty_from_lot

        # Persistance
        if allocations_created:
            FactureProduitAllocation.objects.bulk_create(allocations_created)
        if lots_updated:
            StockLot.objects.bulk_update(lots_updated, ['quantity_remaining', 'quantity_free_remaining'])

        return allocations_created, lots_updated, used_lot_names

    @staticmethod
    def allocate_specific_lot(facture_produit, lot, quantity, selling_price=None):
        """
        Alloue une quantité depuis un lot spécifique.
        Crée la FactureProduitAllocation et met à jour le lot.

        Retourne l'allocation créée ou None si quantité <= 0.
        """
        if quantity <= 0:
            return None

        sp = selling_price or facture_produit.selling_price

        if lot.quantity_remaining < quantity:
            raise ValueError(
                f"Stock insuffisant dans le lot {lot.lot} "
                f"(demandé {quantity}, disponible {lot.quantity_remaining})."
            )

        free_taken = min(quantity, lot.quantity_free_remaining) if lot.quantity_free_remaining > 0 else 0
        allocation = FactureProduitAllocation.objects.create(
            facture_produit=facture_produit,
            stock_lot=lot,
            quantity=quantity,
            quantity_free=free_taken,
            cost_price=lot.price_cost,
            selling_price=sp
        )
        lot.quantity_remaining -= quantity
        lot.quantity_free_remaining -= free_taken
        StockLot.objects.filter(pk=lot.pk).update(
            quantity_remaining=lot.quantity_remaining,
            quantity_free_remaining=lot.quantity_free_remaining,
        )

        return allocation

    # ──────────────────────────────────────────────
    #  Restauration d'un lot unique (retour produit)
    # ──────────────────────────────────────────────

    @staticmethod
    def restore_to_lot(lot, quantity):
        """
        Remet une quantité dans un lot (pour un retour produit).
        Met à jour quantity_remaining et quantity_free_remaining.
        """
        lot.quantity_remaining += quantity
        space_for_free = lot.quantity_free - lot.quantity_free_remaining
        if space_for_free > 0:
            lot.quantity_free_remaining += min(quantity, space_for_free)
        StockLot.objects.filter(pk=lot.pk).update(
            quantity_remaining=lot.quantity_remaining,
            quantity_free_remaining=lot.quantity_free_remaining,
        )

    # ──────────────────────────────────────────────
    #  Création de mouvements de stock
    # ──────────────────────────────────────────────

    @staticmethod
    def create_stock_movements(items, facture, user, prefix="Vente"):
        """
        Crée les MouvementStock pour une liste de FactureProduit.
        Retourne la liste des mouvements créés.
        """
        product_ids = [item.produit_id for item in items]
        if not product_ids:
            return []

        updated_products = Produit.objects.filter(id__in=product_ids)
        product_stock_map = {p.id: p.total_stock for p in updated_products}
        service_ids = {p.id for p in updated_products if p.is_service}

        mouvements = []
        for item in items:
            stock_quantity = item.quantity
            if stock_quantity == 0 or item.produit_id in service_ids:
                continue
            is_return = stock_quantity < 0
            label = "Retour" if is_return else prefix
            mouvements.append(MouvementStock(
                produit_id=item.produit_id,
                type_mouvement=(
                    MouvementStock.TypeMouvement.RETOUR if is_return
                    else MouvementStock.TypeMouvement.SORTIE
                ),
                quantite=-stock_quantity,
                stock_apres=product_stock_map.get(item.produit_id),
                user=user,
                facture=facture,
                description=f"{label} Facture #{facture.numero_facture or facture.id}",
            ))

        if mouvements:
            MouvementStock.objects.bulk_create(mouvements)
        return mouvements
