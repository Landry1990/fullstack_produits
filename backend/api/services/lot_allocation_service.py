"""
Service centralisé pour la gestion des allocations de lots (FIFO/FEFO),
restauration d'allocations et synchronisation du stock depuis les lots.

Factorise la logique commune entre SaleValidator, SaleCanceller et SaleModifier.
"""
import logging

from django.db.models import F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from ..models import (
    FactureProduitAllocation,
    MouvementStock,
    Produit,
    StockLot,
)

logger = logging.getLogger(__name__)


class LotAllocationService:
    """Centralise toutes les opérations d'allocation et restauration de lots."""

    # ──────────────────────────────────────────────
    #  Restauration d'allocations
    # ──────────────────────────────────────────────

    @staticmethod
    def restore_allocations(facture):
        """
        Restaure toutes les allocations de lots d'une facture :
        - Remet quantity_remaining et quantity_free_remaining dans chaque lot
        - Supprime les enregistrements FactureProduitAllocation
        - Retourne (allocations, product_ids_with_allocations) pour usage par l'appelant

        Utilisé par cancel_invoice et modify_sale.
        """
        allocations = list(
            FactureProduitAllocation.objects.filter(facture_produit__facture=facture)
            .select_related('stock_lot', 'facture_produit', 'facture_produit__produit')
        )
        lot_ids = [alloc.stock_lot_id for alloc in allocations if alloc.stock_lot_id]
        locked_lots = {
            lot.id: lot
            for lot in StockLot.objects.filter(id__in=lot_ids).select_for_update().order_by('id')
        } if lot_ids else {}

        for alloc in allocations:
            lot = locked_lots.get(alloc.stock_lot_id) if alloc.stock_lot_id else None
            if not lot:
                continue
            lot.quantity_remaining += alloc.quantity
            lot.quantity_free_remaining = min(
                lot.quantity_free_remaining + alloc.quantity,
                lot.quantity_free
            )
            lot.save()

        product_ids_with_allocations = set()
        for alloc in allocations:
            if alloc.facture_produit and alloc.facture_produit.produit_id:
                product_ids_with_allocations.add(alloc.facture_produit.produit_id)

        FactureProduitAllocation.objects.filter(id__in=[a.id for a in allocations]).delete()

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
        total_lots_sum = (
            StockLot.objects.filter(produit=OuterRef('pk'))
            .order_by()
            .values('produit')
            .annotate(total=Sum('quantity_remaining'))
            .values('total')
        )
        Produit.objects.filter(id__in=product_ids).update(
            stock=Coalesce(Subquery(total_lots_sum), Value(0))
        )

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

        available_lots = list(
            StockLot.objects.filter(
                produit_id=produit_id,
                quantity_remaining__gt=0
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
            allocations_created.append(FactureProduitAllocation(
                facture_produit=facture_produit,
                stock_lot=lot,
                quantity=qty_from_lot,
                cost_price=lot.price_cost,
                selling_price=sp
            ))
            lot.quantity_remaining -= qty_from_lot
            if lot.quantity_free_remaining > 0:
                lot.quantity_free_remaining -= min(qty_from_lot, lot.quantity_free_remaining)
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

        allocation = FactureProduitAllocation.objects.create(
            facture_produit=facture_produit,
            stock_lot=lot,
            quantity=quantity,
            cost_price=lot.price_cost,
            selling_price=sp
        )
        lot.quantity_remaining -= quantity
        if lot.quantity_free_remaining > 0:
            lot.quantity_free_remaining -= min(quantity, lot.quantity_free_remaining)
        lot.save()

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
        lot.save()

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

        mouvements = []
        for item in items:
            if item.quantity == 0:
                continue
            is_return = item.quantity < 0
            label = "Retour" if is_return else prefix
            mouvements.append(MouvementStock(
                produit_id=item.produit_id,
                type_mouvement=(
                    MouvementStock.TypeMouvement.RETOUR if is_return
                    else MouvementStock.TypeMouvement.SORTIE
                ),
                quantite=-item.quantity,
                stock_apres=product_stock_map.get(item.produit_id),
                user=user,
                facture=facture,
                description=f"{label} Facture #{facture.numero_facture or facture.id}",
            ))

        if mouvements:
            MouvementStock.objects.bulk_create(mouvements)
        return mouvements
