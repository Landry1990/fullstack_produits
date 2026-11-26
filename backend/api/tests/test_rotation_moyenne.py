from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from api.models import Facture, FactureProduit
from api.services.replenishment_service import (
    jours_donnees_cache_key,
    get_replenishment_metrics,
    recalculate_products_rotation,
)
from api.services.sale_validator import SaleValidator
from api.tests.factories import TestDataFactory


class TestCacheConfigurationTests(SimpleTestCase):
    def test_test_runner_never_uses_application_redis(self):
        self.assertEqual(
            settings.CACHES['default']['BACKEND'],
            'django.core.cache.backends.locmem.LocMemCache',
        )


@override_settings(CACHES={'default': {
    'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    'LOCATION': 'replenishment-regressions',
}})
class ReplenishmentCacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.today = timezone.localdate()
        self.facture = TestDataFactory.create_facture(status='VAL')
        Facture.objects.filter(pk=self.facture.pk).update(
            date=timezone.now() - timedelta(days=40),
        )

    def test_legacy_seven_day_cache_cannot_poison_existing_history(self):
        from api.services.replenishment_service import get_jours_donnees
        cache.set('stock_jours_donnees', 7, 3600)
        self.assertEqual(get_jours_donnees(self.today), 41)

    def test_history_cache_is_scoped_to_the_observation_day(self):
        from api.services.replenishment_service import get_jours_donnees
        self.assertEqual(get_jours_donnees(self.today), 41)
        self.assertEqual(get_jours_donnees(self.today + timedelta(days=1)), 42)

    def test_history_cache_is_scoped_to_the_database(self):
        from api.services.replenishment_service import get_jours_donnees
        with patch.dict(connection.settings_dict, NAME='cache_scope_other_database'):
            cache.clear()
            with patch.object(Facture.objects, 'filter') as sales:
                sales.return_value.order_by.return_value.values_list.return_value.first.return_value = timezone.now()
                self.assertEqual(get_jours_donnees(self.today), 7)
        self.assertEqual(get_jours_donnees(self.today), 41)

    def test_cached_history_avoids_repeating_the_sales_query(self):
        from api.services.replenishment_service import get_jours_donnees
        get_jours_donnees(self.today)
        with self.assertNumQueries(0):
            self.assertEqual(get_jours_donnees(self.today), 41)

    def test_legacy_pilotage_result_is_ignored(self):
        from api.services.stock_pilotage import compute_stock_pilotage
        cache.set('stock_pilotage:30:all', {'jours_donnees': 7}, 300)
        result = compute_stock_pilotage(30)
        self.assertEqual(result['jours_donnees'], 41)
        self.assertIn('summary', result)


class RotationMoyenneTests(TestCase):
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.produit = TestDataFactory.create_produit(
            name='Produit Rotation',
            stock=10,
            selling_price=500,
        )
        self.facture = Facture.objects.create(
            numero_facture='FAC-TEST-ROTATION',
            status=Facture.Status.BROUILLON,
            created_by=self.user,
            validated_by=self.user,
        )
        FactureProduit.objects.bulk_create([
            FactureProduit(
                facture=self.facture,
                produit=self.produit,
                quantity=3,
                selling_price=Decimal('500'),
                discount=Decimal('0'),
                tva=Decimal('0'),
            )
        ])
        self.facture.calculate_totals(save=True)

    def test_validation_recalcule_rotation_apres_bulk_create(self):
        self.assertEqual(self.produit.rotation_moyenne, Decimal('0.00'))

        with self.captureOnCommitCallbacks(execute=True):
            SaleValidator.validate_invoice(
                self.facture,
                self.user,
                {
                    'paiement_immediat': Decimal('1500'),
                    'points_to_use': 0,
                    'use_pending_discount': False,
                },
            )

        self.facture.refresh_from_db()
        self.produit.refresh_from_db()
        metrics = get_replenishment_metrics(self.produit.id, produit=self.produit)
        expected_rotation = Decimal(str(metrics['consommation_mensuelle'])).quantize(Decimal('0.01'))

        self.assertEqual(self.facture.status, Facture.Status.VALIDEE)
        self.assertEqual(self.produit.rotation_moyenne, expected_rotation)
        self.assertGreater(self.produit.rotation_moyenne, Decimal('0.00'))
        self.assertEqual(
            self.produit.date_premiere_vente,
            timezone.localtime(self.facture.date).date(),
        )

    def test_recalcul_global_ignore_le_cache_jours_donnees(self):
        old_date = timezone.now() - timedelta(days=40)
        old_facture = Facture.objects.create(
            numero_facture='FAC-TEST-ROTATION-OLD',
            status=Facture.Status.VALIDEE,
            created_by=self.user,
            validated_by=self.user,
        )
        FactureProduit.objects.bulk_create([
            FactureProduit(
                facture=old_facture,
                produit=self.produit,
                quantity=30,
                selling_price=Decimal('500'),
                discount=Decimal('0'),
                tva=Decimal('0'),
            )
        ])
        Facture.objects.filter(pk=old_facture.pk).update(date=old_date)
        type(self.produit).objects.filter(pk=self.produit.pk).update(created_at=old_date)
        cache.set(jours_donnees_cache_key(), 7, 3600)

        recalculate_products_rotation([self.produit.id])

        self.produit.refresh_from_db()
        metrics = get_replenishment_metrics(self.produit.id, produit=self.produit)
        expected_rotation = Decimal(str(metrics['consommation_mensuelle'])).quantize(Decimal('0.01'))
        self.assertEqual(self.produit.rotation_moyenne, expected_rotation)
        self.assertLess(self.produit.rotation_moyenne, Decimal('60.00'))

    def test_annulation_recalcule_rotation_a_zero(self):
        with self.captureOnCommitCallbacks(execute=True):
            SaleValidator.validate_invoice(
                self.facture,
                self.user,
                {
                    'paiement_immediat': Decimal('1500'),
                    'points_to_use': 0,
                    'use_pending_discount': False,
                },
            )
        self.produit.refresh_from_db()
        self.assertGreater(self.produit.rotation_moyenne, Decimal('0.00'))

        with self.captureOnCommitCallbacks(execute=True):
            self.facture.status = Facture.Status.ANNULEE
            self.facture.save(update_fields=['status'])

        self.produit.refresh_from_db()
        self.assertEqual(self.produit.rotation_moyenne, Decimal('0.00'))
