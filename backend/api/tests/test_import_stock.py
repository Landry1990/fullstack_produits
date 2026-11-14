"""
Garantit que les imports produits ne créent pas de « stock fantôme » :
pour un produit géré par lots, la quantité importée doit passer par un
StockLot réel, sinon le compteur Produit.stock est vendable sans lot et
écrasé au prochain recalcul depuis les lots.
"""
from django.test import TestCase

from api.models import Produit, StockLot
from api.services.lot_allocation_service import LotAllocationService


class ApplyImportedStockTestCase(TestCase):
    def setUp(self):
        self.produit = Produit.objects.create(
            name='Produit import', cost_price=100, selling_price=200, stock=0,
        )
        self.produit_non_lot = Produit.objects.create(
            name='Produit simple', cost_price=50, selling_price=80,
            stock=10, use_lot_management=False,
        )

    def test_absolute_import_creates_lot(self):
        LotAllocationService.apply_imported_stock(self.produit, 40, absolute=True, cost_price=100)
        self.produit.refresh_from_db()
        lot = self.produit.stock_lots.get()
        self.assertEqual(lot.quantity_remaining, 40)
        self.assertTrue(lot.lot.startswith('IMP'))
        self.assertEqual(self.produit.stock, 40)

    def test_import_does_not_double_count(self):
        # Un lot physique existe déjà : la valeur du fichier est absolue,
        # pas additive — pas de double comptage.
        StockLot.objects.create(
            produit=self.produit, lot='L1', quantity_initial=15,
            quantity_paid=15, quantity_remaining=15, price_cost=100,
            selling_price=200, date_reception='2024-01-01T00:00:00Z',
        )
        LotAllocationService.apply_imported_stock(self.produit, 25, absolute=True)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 25)
        self.assertEqual(
            sum(self.produit.stock_lots.values_list('quantity_remaining', flat=True)), 25,
        )

    def test_absolute_import_shrinks_lots(self):
        StockLot.objects.create(
            produit=self.produit, lot='L1', quantity_initial=30,
            quantity_paid=30, quantity_remaining=30, price_cost=100,
            selling_price=200, date_reception='2024-01-01T00:00:00Z',
        )
        LotAllocationService.apply_imported_stock(self.produit, 10, absolute=True)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 10)
        self.assertEqual(
            sum(self.produit.stock_lots.values_list('quantity_remaining', flat=True)), 10,
        )

    def test_additive_import_adds_lot(self):
        StockLot.objects.create(
            produit=self.produit, lot='L1', quantity_initial=5,
            quantity_paid=5, quantity_remaining=5, price_cost=100,
            selling_price=200, date_reception='2024-01-01T00:00:00Z',
        )
        LotAllocationService.apply_imported_stock(self.produit, 7, absolute=False)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 12)

    def test_non_lot_product_direct_counter(self):
        LotAllocationService.apply_imported_stock(self.produit_non_lot, 99, absolute=True)
        self.produit_non_lot.stock = self.produit_non_lot.stock  # set en mémoire par le helper
        self.produit_non_lot.save(update_fields=['stock'])
        self.produit_non_lot.refresh_from_db()
        self.assertEqual(self.produit_non_lot.stock, 99)
        self.assertEqual(self.produit_non_lot.stock_lots.count(), 0)
