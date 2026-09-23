from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import (
    Avoir,
    Commande,
    CommandeProduit,
    LigneAvoir,
    MouvementStock,
    OrderSchedule,
    Produit,
    StockLot,
)
from api.services.auto_order import create_order_from_suggestions

from .factories import TestDataFactory


class AutomaticOrderServiceTests(APITestCase):
    def setUp(self):
        self.fournisseur = TestDataFactory.create_fournisseur(name='Grossiste Automatique')
        self.produit = TestDataFactory.create_produit(
            name='Produit automatique',
            fournisseur=self.fournisseur,
            stock=5,
            cost_price=Decimal('100'),
            selling_price=Decimal('150'),
        )
        self.schedule = OrderSchedule.objects.create(
            fournisseur=self.fournisseur,
            active_days=[0],
            min_amount=Decimal('0'),
            min_items=0,
        )
        self.suggestion = {
            'produit_id': self.produit.id,
            'quantite_suggeree': 10,
            'prix_achat': '100',
            'prix_vente': '150',
            'tva': '0',
        }

    def test_empty_suggestions_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Aucune suggestion'):
            create_order_from_suggestions(self.schedule, [], 0)
        self.assertFalse(Commande.objects.exists())

    def test_and_conditions_require_amount_and_item_count(self):
        self.schedule.min_amount = Decimal('5000')
        self.schedule.min_items = 2
        self.schedule.condition_logic = OrderSchedule.ConditionLogic.AND
        self.schedule.save()

        commande, count = create_order_from_suggestions(
            self.schedule,
            [self.suggestion],
            Decimal('1000'),
        )

        self.assertIsNone(commande)
        self.assertEqual(count, 0)
        self.assertFalse(Commande.objects.exists())

    def test_or_conditions_create_when_one_threshold_is_met(self):
        self.schedule.min_amount = Decimal('5000')
        self.schedule.min_items = 1
        self.schedule.condition_logic = OrderSchedule.ConditionLogic.OR
        self.schedule.save()

        commande, count = create_order_from_suggestions(
            self.schedule,
            [self.suggestion],
            Decimal('1000'),
        )

        self.assertIsNotNone(commande)
        self.assertEqual(count, 1)
        self.assertEqual(commande.source, Commande.Source.AUTO_SCHEDULE)
        self.assertEqual(commande.status, Commande.Status.EN_PREPARATION)
        self.assertTrue(commande.numero_facture.startswith('AUTO-GROSSISTE-'))

    def test_missing_products_are_skipped_when_valid_lines_remain(self):
        missing = {**self.suggestion, 'produit_id': 999999}

        commande, count = create_order_from_suggestions(
            self.schedule,
            [missing, self.suggestion],
            Decimal('1000'),
        )

        self.assertIsNotNone(commande)
        self.assertEqual(count, 1)
        self.assertEqual(commande.produits.count(), 1)

    def test_no_empty_order_is_kept_when_all_products_are_missing(self):
        missing = {**self.suggestion, 'produit_id': 999999}

        commande, count = create_order_from_suggestions(
            self.schedule,
            [missing],
            Decimal('1000'),
        )

        self.assertIsNone(commande)
        self.assertEqual(count, 0)
        self.assertFalse(Commande.objects.exists())


class OrderScheduleEndpointTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = TestDataFactory.create_user(username='schedule-user')
        self.admin = TestDataFactory.create_superuser(username='schedule-admin')
        self.fournisseur = TestDataFactory.create_fournisseur(name='Grossiste Planning')
        self.produit = TestDataFactory.create_produit(fournisseur=self.fournisseur)
        self.schedule = OrderSchedule.objects.create(
            fournisseur=self.fournisseur,
            active_days=[0],
            is_active=True,
        )

    def tearDown(self):
        cache.clear()

    def test_regular_user_can_read_but_cannot_mutate_schedules(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(reverse('orderschedule-list')).status_code, status.HTTP_200_OK)

        create_response = self.client.post(
            reverse('orderschedule-list'),
            {'fournisseur': self.fournisseur.id, 'active_days': [1]},
            format='json',
        )
        trigger_response = self.client.post(
            reverse('orderschedule-trigger-now', kwargs={'pk': self.schedule.pk}),
            {},
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(trigger_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_schedule_cannot_be_triggered(self):
        self.schedule.is_active = False
        self.schedule.save(update_fields=['is_active'])
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('orderschedule-trigger-now', kwargs={'pk': self.schedule.pk}),
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Commande.objects.exists())

    @patch('api.views.commandes.schedules.run_suggestions_for_schedule')
    def test_admin_trigger_creates_order_and_updates_last_run(self, mocked_suggestions):
        mocked_suggestions.return_value = ([{
            'produit_id': self.produit.id,
            'quantite_suggeree': 4,
            'prix_achat': '100',
            'prix_vente': '150',
            'tva': '0',
        }], Decimal('400'))
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('orderschedule-trigger-now', kwargs={'pk': self.schedule.pk}),
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Commande.objects.filter(source=Commande.Source.AUTO_SCHEDULE).count(), 1)
        self.schedule.refresh_from_db()
        self.assertIsNotNone(self.schedule.last_run)


class OrderReceptionEdgeTests(APITestCase):
    def setUp(self):
        self.admin = TestDataFactory.create_superuser(username='reception-admin')
        self.client.force_authenticate(user=self.admin)
        self.fournisseur = TestDataFactory.create_fournisseur(name='Grossiste Réception')
        self.produit = TestDataFactory.create_produit(
            fournisseur=self.fournisseur,
            stock=0,
            cost_price=Decimal('100'),
            selling_price=Decimal('150'),
            use_lot_management=True,
        )

    def test_paid_and_free_units_create_one_coherent_lot(self):
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='PREP')
        line = TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=6,
            unites_gratuites=2,
            price=Decimal('100'),
            price_cost=Decimal('100'),
            lot='LOT-UG-001',
        )

        response = self.client.post(reverse('commande-cloturer', kwargs={'pk': commande.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        lot = StockLot.objects.get(commande_produit=line)
        self.assertEqual(lot.quantity_initial, 8)
        self.assertEqual(lot.quantity_paid, 6)
        self.assertEqual(lot.quantity_free, 2)
        self.assertEqual(lot.quantity_remaining, 8)
        self.assertEqual(lot.price_cost, Decimal('75'))
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 8)

    def test_second_closure_does_not_duplicate_stock_lot_or_movement(self):
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='PREP')
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=5,
            price=Decimal('100'),
            price_cost=Decimal('100'),
        )
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})

        first = self.client.post(url)
        self.produit.refresh_from_db()
        stock_after_first = self.produit.stock
        lots_after_first = StockLot.objects.filter(produit=self.produit).count()
        movements_after_first = MouvementStock.objects.filter(produit=self.produit).count()
        second = self.client.post(url)

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, stock_after_first)
        self.assertEqual(StockLot.objects.filter(produit=self.produit).count(), lots_after_first)
        self.assertEqual(MouvementStock.objects.filter(produit=self.produit).count(), movements_after_first)


class SupplierCreditStockRoundTripTests(APITestCase):
    def setUp(self):
        self.admin = TestDataFactory.create_superuser(username='avoir-stock-admin')
        self.client.force_authenticate(user=self.admin)
        self.produit = TestDataFactory.create_produit(stock=20, use_lot_management=False)
        self.avoir = Avoir.objects.create(
            fournisseur=self.produit.fournisseur,
            type_avoir='AUTRE',
            created_by=self.admin,
        )
        LigneAvoir.objects.create(
            avoir=self.avoir,
            produit=self.produit,
            quantity=5,
            price=self.produit.cost_price,
        )

    def test_discharge_is_idempotent_and_cancellation_restores_stock(self):
        discharge_url = reverse('avoir-decharger-stock', kwargs={'pk': self.avoir.pk})
        cancel_url = reverse('avoir-annuler-dechargement', kwargs={'pk': self.avoir.pk})

        first = self.client.post(discharge_url)
        second = self.client.post(discharge_url)
        self.produit.refresh_from_db()
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.produit.stock, 15)

        cancelled = self.client.post(cancel_url)
        repeated_cancel = self.client.post(cancel_url)
        self.produit.refresh_from_db()
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(repeated_cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.produit.stock, 20)
        self.assertEqual(
            MouvementStock.objects.filter(produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.AVOIR).count(),
            1,
        )
        self.assertEqual(
            MouvementStock.objects.filter(produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.RETOUR).count(),
            1,
        )
