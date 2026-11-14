"""
Tests de l'option PharmacySettings.expiry_cutoff.

Deux conventions de péremption pour une saisie MM/AA (stockée au dernier
jour du mois) :
- LAST_DAY (défaut) : le lot reste vendable jusqu'à la fin de son mois
  d'expiration — comportement historique.
- FIRST_DAY : le lot est périmé dès le 1er jour de son mois d'expiration.

Couvre : helper expired_before/is_expired, allocation FEFO en vente,
liste des périmés et filtres de lots valides.
"""
import calendar
from datetime import date, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import PharmacySettings, StockLot
from api.tests.factories import TestDataFactory
from api.utils.expiry import expired_before, is_expired


def end_of_month(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


class ExpiryCutoffHelperTestCase(TestCase):
    """Unit tests du helper api.utils.expiry."""

    def setUp(self):
        PharmacySettings.objects.all().delete()
        self.settings = PharmacySettings.objects.create(pharmacy_name='Test')

    def test_default_is_last_day(self):
        self.assertEqual(self.settings.expiry_cutoff, PharmacySettings.ExpiryCutoff.LAST_DAY)
        today = date(2026, 11, 15)
        self.assertEqual(expired_before(today), today)
        self.assertFalse(is_expired(end_of_month(today), today))
        self.assertTrue(is_expired(today - timedelta(days=1), today))

    def test_first_day_cutoff(self):
        self.settings.expiry_cutoff = PharmacySettings.ExpiryCutoff.FIRST_DAY
        self.settings.save()
        today = date(2026, 11, 15)
        # Un lot expirant fin novembre est périmé dès le 1er novembre.
        self.assertEqual(expired_before(today), date(2026, 12, 1))
        self.assertTrue(is_expired(end_of_month(today), today))
        # Un lot expirant fin décembre reste valide.
        self.assertFalse(is_expired(date(2026, 12, 31), today))

    def test_first_day_cutoff_december(self):
        self.settings.expiry_cutoff = PharmacySettings.ExpiryCutoff.FIRST_DAY
        self.settings.save()
        # Passage d'année : en décembre, la butoir est le 1er janvier suivant.
        today = date(2026, 12, 10)
        self.assertEqual(expired_before(today), date(2027, 1, 1))
        self.assertTrue(is_expired(date(2026, 12, 31), today))
        self.assertFalse(is_expired(date(2027, 1, 31), today))


class ExpiryCutoffSaleTestCase(TestCase):
    """Vente FEFO : un lot expirant dans le mois courant."""

    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(
            username='admin_cutoff', password='adminpass123',
        )
        self.client.force_authenticate(user=self.user)
        self.settings = PharmacySettings.objects.first()
        if self.settings is None:
            self.settings = PharmacySettings.objects.create(pharmacy_name='Test')

        self.today = timezone.now().date()
        # Lot expirant le dernier jour du mois courant (saisie MM/AA).
        self.current_month_lot_date = end_of_month(self.today)

        self.produit = self.factory.create_produit(stock=0, use_lot_management=True)
        self.expiring_lot = self.factory.create_stock_lot(
            produit=self.produit, quantity=20, lot_name='LOT-MOIS-COURANT',
            date_expiration=self.current_month_lot_date,
        )
        self.future_lot = self.factory.create_stock_lot(
            produit=self.produit, quantity=30, lot_name='LOT-FUTUR',
            date_expiration=self.today + timedelta(days=365),
        )
        self.produit.calculate_stock_from_lots()
        self.produit.refresh_from_db()

    def _make_sale(self, quantity=10):
        session = self.factory.create_session_caisse(user=self.user)
        client = self.factory.create_client()
        payload = {
            'client': client.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': quantity,
                'selling_price': str(self.produit.selling_price),
                'discount': '0',
                'tva': '0',
            }],
            'paiements': [{'mode': 'especes', 'montant': str(self.produit.selling_price * quantity)}],
            'remise': '0',
            'type': 'STD',
            'centralized_cash_register': False,
        }
        return self.client.post(reverse('facture-finaliser'), payload, format='json')

    def test_last_day_mode_allocates_current_month_lot(self):
        """LAST_DAY (défaut) : le lot du mois courant est vendable (FEFO)."""
        self.settings.expiry_cutoff = PharmacySettings.ExpiryCutoff.LAST_DAY
        self.settings.save()

        response = self._make_sale(10)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.expiring_lot.refresh_from_db()
        self.future_lot.refresh_from_db()
        # FEFO : le lot le plus proche de la péremption est consommé en premier.
        self.assertEqual(self.expiring_lot.quantity_remaining, 10)
        self.assertEqual(self.future_lot.quantity_remaining, 30)

    def test_first_day_mode_skips_current_month_lot(self):
        """FIRST_DAY : le lot du mois courant est périmé → non alloué."""
        self.settings.expiry_cutoff = PharmacySettings.ExpiryCutoff.FIRST_DAY
        self.settings.save()

        response = self._make_sale(10)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.expiring_lot.refresh_from_db()
        self.future_lot.refresh_from_db()
        # Le lot « périmé » selon la règle n'est pas touché.
        self.assertEqual(self.expiring_lot.quantity_remaining, 20)
        self.assertEqual(self.future_lot.quantity_remaining, 20)

    def test_first_day_mode_counts_lot_as_expired_in_stats(self):
        """FIRST_DAY : le lot du mois courant remonte dans les stats périmés."""
        self.settings.expiry_cutoff = PharmacySettings.ExpiryCutoff.FIRST_DAY
        self.settings.save()

        response = self.client.get(reverse('stocklot-stats-perimes'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        perimes_ids = {d['lot_id'] for d in response.data['perimes']['details']}
        self.assertIn(self.expiring_lot.id, perimes_ids)
        self.assertNotIn(self.future_lot.id, perimes_ids)

    def test_last_day_mode_lot_not_in_expired_stats(self):
        """LAST_DAY : le lot du mois courant n'est pas compté périmé."""
        self.settings.expiry_cutoff = PharmacySettings.ExpiryCutoff.LAST_DAY
        self.settings.save()

        response = self.client.get(reverse('stocklot-stats-perimes'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        perimes_ids = {d['lot_id'] for d in response.data['perimes']['details']}
        self.assertNotIn(self.expiring_lot.id, perimes_ids)
