"""
Tests pour les filtres « réserve » de _get_rows_from_stock
(api/views/stocks/inventaire/listing_excel.py).

Régressions couvertes :
- reserve + zero : le pré-filtre emplacement quantity_reserved__gt=0
  combiné à quantity_reserved=0 vidait le queryset lots → le fallback
  produits affichait TOUS les produits à réserve avec mouvement, même
  ceux dont stock_reserve > 0.
- reserve + non_zero : exigeait quantity_remaining__gt=0 → un lot avec
  du stock en réserve mais un rayon vide disparaissait du listing.
- zero : un produit approvisionné (compteur > 0) avec un simple lot vide
  ne doit pas apparaître dans « Stocks nuls ».
"""
from django.test import TestCase

from ..models import MouvementStock
from ..views.stocks.inventaire.listing_excel import _get_rows_from_stock
from .factories import TestDataFactory as F


def _ids(grouped):
    return {
        row['produit_id']
        for rows in grouped.values()
        for row in rows
        if row.get('produit_id')
    }


def _mouvement(produit):
    MouvementStock.objects.create(
        produit=produit, type_mouvement='ENTREE', quantite=5,
    )


class ReserveZeroFilterTest(TestCase):
    def setUp(self):
        # Réserve pleine : ne doit JAMAIS apparaître dans « Stocks nuls »
        self.avec_reserve = F.create_produit(
            name='AVEC RESERVE', stock=0, stock_reserve=5,
            has_reserve_storage=True,
        )
        F.create_stock_lot(
            self.avec_reserve, quantity=0, quantity_remaining=0,
            quantity_reserved=5, lot_name='LOT-RES-1',
        )
        _mouvement(self.avec_reserve)

        # Réserve vide, sans lot : ligne synthétique attendue
        self.sans_reserve = F.create_produit(
            name='SANS RESERVE', stock=0, stock_reserve=0,
            has_reserve_storage=True,
        )
        _mouvement(self.sans_reserve)

        # Réserve vide avec un lot à zéro : ligne attendue aussi
        self.reserve_zero_lot = F.create_produit(
            name='RESERVE LOT ZERO', stock=0, stock_reserve=0,
            has_reserve_storage=True,
        )
        F.create_stock_lot(
            self.reserve_zero_lot, quantity=0, quantity_remaining=0,
            quantity_reserved=0, lot_name='LOT-RES-0',
        )
        _mouvement(self.reserve_zero_lot)

    def test_reserve_zero_excludes_products_with_reserve(self):
        grouped = _get_rows_from_stock(
            'rayon', 'zero', stock_location='reserve', lang='fr',
        )
        ids = _ids(grouped)
        self.assertNotIn(self.avec_reserve.id, ids)
        self.assertIn(self.sans_reserve.id, ids)
        self.assertIn(self.reserve_zero_lot.id, ids)

    def test_reserve_nonzero_includes_lot_with_empty_shelf(self):
        """Un lot avec réserve > 0 mais rayon vide doit apparaître dans
        « stock non nul en réserve » (le filtre porte sur quantity_reserved)."""
        grouped = _get_rows_from_stock(
            'rayon', 'non_zero', stock_location='reserve', lang='fr',
        )
        ids = _ids(grouped)
        self.assertIn(self.avec_reserve.id, ids)
        self.assertNotIn(self.sans_reserve.id, ids)
        self.assertNotIn(self.reserve_zero_lot.id, ids)


class ZeroFilterProductLevelTest(TestCase):
    def test_zero_excludes_stocked_product_with_empty_lot(self):
        """Un produit approvisionné (stock > 0) qui possède un lot vide
        n'est pas « en rupture » — le compteur produit fait foi."""
        appro = F.create_produit(name='APPRO', stock=10)
        # Le lot approvisionné maintient le compteur à 10 malgré le lot vide
        # (créer un StockLot déclenche calculate_stock_from_lots).
        F.create_stock_lot(
            appro, quantity=10, quantity_remaining=10, lot_name='LOT-PLEIN',
        )
        F.create_stock_lot(
            appro, quantity=0, quantity_remaining=0, lot_name='LOT-VIDE',
        )
        _mouvement(appro)

        rupture = F.create_produit(name='RUPTURE', stock=0)
        _mouvement(rupture)

        grouped = _get_rows_from_stock('rayon', 'zero', lang='fr')
        ids = _ids(grouped)
        self.assertNotIn(appro.id, ids)
        self.assertIn(rupture.id, ids)
