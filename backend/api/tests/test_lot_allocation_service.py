"""
Tests pour LotAllocationService — allocation FIFO/FEFO, restauration, sync stock.
Purement additif : aucun impact sur le code existant.
"""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

from api.models import (
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    MouvementStock,
    Produit,
    StockLot,
)
from api.services.lot_allocation_service import LotAllocationService

User = get_user_model()


@pytest.mark.django_db
class TestLotAllocationService:

    def _create_product_with_lots(self, lots_data):
        """Helper: crée un produit + plusieurs lots."""
        from datetime import datetime
        produit = Produit.objects.create(
            name="Test Product",
            selling_price=Decimal("1000"),
            stock=0,
            use_lot_management=True,
        )
        lots = []
        for i, ld in enumerate(lots_data):
            lot = StockLot.objects.create(
                produit=produit,
                lot=f"LOT-{i+1}",
                quantity_initial=ld["quantity"],
                quantity_remaining=ld["quantity_remaining"],
                quantity_free=ld.get("quantity_free", 0),
                quantity_free_remaining=ld.get("quantity_free_remaining", 0),
                price_cost=Decimal("500"),
                date_reception=ld.get("date_reception", datetime(2025, 1, 1)),
                date_expiration=ld.get("date_expiration"),
            )
            lots.append(lot)
        return produit, lots

    def _create_facture_produit(self, produit, quantity=5):
        """Helper: crée une facture + une ligne FactureProduit."""
        user = User.objects.create_user(username="testuser", password="testpass123")
        facture = Facture.objects.create(
            created_by=user,
            validated_by=user,
            status=Facture.Status.BROUILLON,
        )
        fp = FactureProduit.objects.create(
            facture=facture,
            produit=produit,
            quantity=quantity,
            selling_price=Decimal("1000"),
        )
        return facture, fp

    # ── allocate_fifo ──────────────────────────────────────────────────

    def test_allocate_fifo_single_lot(self):
        """Allocation FIFO depuis un seul lot."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 100}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=10)

        allocations, lots_updated, used_names = LotAllocationService.allocate_fifo(fp, 10)

        assert len(allocations) == 1
        assert allocations[0].quantity == 10
        assert len(lots_updated) == 1
        lots[0].refresh_from_db()
        assert lots[0].quantity_remaining == 90

    def test_allocate_fifo_multiple_lots(self):
        """Allocation FIFO depuis plusieurs lots (FEFO — expiration ascending)."""
        from datetime import date
        produit, lots = self._create_product_with_lots([
            {"quantity": 5, "quantity_remaining": 5, "date_expiration": date(2025, 12, 31)},
            {"quantity": 10, "quantity_remaining": 10, "date_expiration": date(2026, 6, 30)},
        ])
        facture, fp = self._create_facture_produit(produit, quantity=8)

        allocations, lots_updated, used_names = LotAllocationService.allocate_fifo(fp, 8)

        assert len(allocations) == 2
        assert allocations[0].quantity == 5  # premier lot épuisé
        assert allocations[1].quantity == 3  # second lot partiellement
        lots[0].refresh_from_db()
        lots[1].refresh_from_db()
        assert lots[0].quantity_remaining == 0
        assert lots[1].quantity_remaining == 7

    def test_allocate_fifo_no_lots_available(self):
        """Allocation FIFO quand aucun lot n'est disponible."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 10, "quantity_remaining": 0}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=5)

        allocations, lots_updated, used_names = LotAllocationService.allocate_fifo(fp, 5)

        assert allocations == []
        assert lots_updated == []
        assert used_names == []

    def test_allocate_fifo_zero_quantity(self):
        """Allocation FIFO avec quantité zéro — ne fait rien."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 10, "quantity_remaining": 10}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=0)

        allocations, lots_updated, used_names = LotAllocationService.allocate_fifo(fp, 0)

        assert allocations == []
        assert lots_updated == []

    def test_allocate_fifo_partial_allocation(self):
        """Allocation FIFO quand la quantité demandée dépasse le stock total."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 3, "quantity_remaining": 3},
            {"quantity": 2, "quantity_remaining": 2},
        ])
        facture, fp = self._create_facture_produit(produit, quantity=10)

        allocations, lots_updated, used_names = LotAllocationService.allocate_fifo(fp, 10)

        # On alloque tout ce qui est disponible (3 + 2 = 5)
        assert len(allocations) == 2
        assert sum(a.quantity for a in allocations) == 5
        lots[0].refresh_from_db()
        lots[1].refresh_from_db()
        assert lots[0].quantity_remaining == 0
        assert lots[1].quantity_remaining == 0

    # ── allocate_specific_lot ──────────────────────────────────────────

    def test_allocate_specific_lot_success(self):
        """Allocation depuis un lot spécifique."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 50, "quantity_remaining": 50}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=10)

        allocation = LotAllocationService.allocate_specific_lot(fp, lots[0], 10)

        assert allocation is not None
        assert allocation.quantity == 10
        lots[0].refresh_from_db()
        assert lots[0].quantity_remaining == 40

    def test_allocate_specific_lot_insufficient_stock(self):
        """Allocation spécifique avec stock insuffisant — lève une erreur."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 5, "quantity_remaining": 5}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=10)

        with pytest.raises(ValueError, match="Stock insuffisant"):
            LotAllocationService.allocate_specific_lot(fp, lots[0], 10)

    def test_allocate_specific_lot_zero_quantity(self):
        """Allocation spécifique avec quantité zéro — retourne None."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 10, "quantity_remaining": 10}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=0)

        result = LotAllocationService.allocate_specific_lot(fp, lots[0], 0)
        assert result is None

    # ── restore_allocations ────────────────────────────────────────────

    def test_restore_allocations(self):
        """Restauration des allocations remet les quantités dans les lots."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 100, "quantity_free": 100, "quantity_free_remaining": 100},
        ])
        facture, fp = self._create_facture_produit(produit, quantity=20)
        LotAllocationService.allocate_specific_lot(fp, lots[0], 20)

        # Vérifier que l'allocation existe
        assert FactureProduitAllocation.objects.filter(facture_produit=fp).count() == 1

        allocations, product_ids = LotAllocationService.restore_allocations(facture)

        assert len(allocations) == 1
        assert produit.id in product_ids
        lots[0].refresh_from_db()
        assert lots[0].quantity_remaining == 100  # restauré
        assert FactureProduitAllocation.objects.filter(facture_produit=fp).count() == 0

    def test_restore_allocations_no_allocations(self):
        """Restauration quand il n'y a pas d'allocations."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 10, "quantity_remaining": 10}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=0)

        allocations, product_ids = LotAllocationService.restore_allocations(facture)

        assert allocations == []
        assert product_ids == set()

    # ── restore_to_lot ─────────────────────────────────────────────────

    def test_restore_to_lot(self):
        """Restauration d'une quantité dans un lot."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 70, "quantity_free": 100, "quantity_free_remaining": 70},
        ])

        LotAllocationService.restore_to_lot(lots[0], 30)

        lots[0].refresh_from_db()
        assert lots[0].quantity_remaining == 100
        assert lots[0].quantity_free_remaining == 100

    def test_restore_to_lot_capped_at_free(self):
        """Restauration capped à quantity_free."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 80, "quantity_free": 50, "quantity_free_remaining": 30},
        ])

        LotAllocationService.restore_to_lot(lots[0], 50)

        lots[0].refresh_from_db()
        assert lots[0].quantity_remaining == 130
        assert lots[0].quantity_free_remaining == 50  # capped at quantity_free

    # ── sync_stock_from_lots ───────────────────────────────────────────

    def test_sync_stock_from_lots(self):
        """Synchronisation du stock produit depuis les lots."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 30, "quantity_remaining": 25},
            {"quantity": 20, "quantity_remaining": 15},
        ])

        LotAllocationService.sync_stock_from_lots([produit.id])

        produit.refresh_from_db()
        assert produit.stock == 40  # 25 + 15

    def test_sync_stock_from_lots_no_lots(self):
        """Sync stock quand le produit n'a pas de lots — stock = 0."""
        produit = Produit.objects.create(
            name="No Lots Product",
            selling_price=Decimal("500"),
            stock=999,
            use_lot_management=False,
        )

        LotAllocationService.sync_stock_from_lots([produit.id])

        produit.refresh_from_db()
        assert produit.stock == 0

    def test_sync_stock_from_lots_empty_list(self):
        """Sync stock avec liste vide — ne fait rien."""
        LotAllocationService.sync_stock_from_lots([])
        # Pas d'erreur, c'est tout ce qu'on vérifie

    # ── create_stock_movements ─────────────────────────────────────────

    def test_create_stock_movements(self):
        """Création de mouvements de stock pour une facture."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 100}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=5)
        user = facture.created_by

        mouvements = LotAllocationService.create_stock_movements([fp], facture, user)

        assert len(mouvements) == 1
        assert mouvements[0].type_mouvement == MouvementStock.TypeMouvement.SORTIE
        assert mouvements[0].quantite == -5

    def test_create_stock_movements_zero_quantity_skipped(self):
        """Les lignes à quantité zéro sont ignorées."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 100}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=0)
        user = facture.created_by

        mouvements = LotAllocationService.create_stock_movements([fp], facture, user)

        assert len(mouvements) == 0

    def test_create_stock_movements_negative_is_return(self):
        """Une quantité négative crée un mouvement de retour."""
        produit, lots = self._create_product_with_lots([
            {"quantity": 100, "quantity_remaining": 100}
        ])
        facture, fp = self._create_facture_produit(produit, quantity=-3)
        user = facture.created_by

        mouvements = LotAllocationService.create_stock_movements([fp], facture, user)

        assert len(mouvements) == 1
        assert mouvements[0].type_mouvement == MouvementStock.TypeMouvement.RETOUR
