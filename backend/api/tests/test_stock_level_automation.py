from unittest.mock import patch

from django.test import TestCase

from ..models import Facture
from ..signals_stock_levels import monthly_stock_levels_update
from .factories import TestDataFactory


class StockLevelAutomationTests(TestCase):
    def setUp(self):
        self.produit = TestDataFactory.create_produit()
        self.facture = TestDataFactory.create_facture(status=Facture.Status.BROUILLON)
        TestDataFactory.create_facture_produit(self.facture, self.produit)

    @patch('api.signals_stock_levels.calculate_and_apply_stock_levels')
    def test_thresholds_recalculate_after_invoice_validation_commit(self, calculate):
        with self.captureOnCommitCallbacks(execute=True):
            self.facture.status = Facture.Status.VALIDEE
            self.facture.save(update_fields=['status'])

        calculate.assert_called_once_with(self.produit.id)

    @patch('api.signals_stock_levels.calculate_and_apply_stock_levels')
    def test_non_status_update_does_not_recalculate_thresholds(self, calculate):
        self.facture.status = Facture.Status.VALIDEE
        with self.captureOnCommitCallbacks(execute=True):
            self.facture.save(update_fields=['status'])
        calculate.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            self.facture.total_ttc = 100
            self.facture.save(update_fields=['total_ttc'])

        calculate.assert_not_called()

    @patch('api.signals_stock_levels.SearchCache.invalidate_all_products')
    @patch('api.signals_stock_levels.calculate_and_apply_stock_levels', return_value=7)
    def test_monthly_update_returns_count_and_invalidates_cache(self, calculate, invalidate):
        updated = monthly_stock_levels_update()

        self.assertEqual(updated, 7)
        calculate.assert_called_once_with()
        invalidate.assert_called_once_with()
