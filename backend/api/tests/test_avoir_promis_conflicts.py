"""
Décharge d'avoir fournisseur vs promis en attente.

Un promis réserve des unités qui restent physiquement dans les lots : le
vendable (Produit.stock) les exclut déjà. Si une décharge dépasse le vendable,
l'excédent est prélevé sur des unités promises — le client payé resterait
indélivrable. L'endpoint promis_conflicts doit les signaler et la décharge
être bloquée sans confirmation explicite (force_discharge).
"""
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Avoir, LigneAvoir, StockLot, StockObligation
from .factories import TestDataFactory


class AvoirPromisConflictsTestCase(APITestCase):
    """Garde-fou promis sur la décharge de stock des avoirs fournisseurs."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser(password='sudopass123')
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(name='Produit Promis')
        # Dette promis : 6 unités promises, déjà exclues du vendable.
        StockObligation.objects.create(
            produit=self.produit,
            produit_nom=self.produit.name,
            type=StockObligation.TypeObligation.PROMIS,
            status=StockObligation.Status.EN_ATTENTE,
            stock_applied=True,
            stock_location=StockObligation.StockLocation.RAYON,
            quantity=6,
            quantity_remaining=6,
        )
        # 16 unités physiques dans le lot → vendable = 16 − 6 = 10
        # (le signal post_save recalcule Produit.stock depuis les lots).
        StockLot.objects.create(
            produit=self.produit,
            lot='LOT-TEST-1',
            quantity_initial=16,
            quantity_paid=16,
            quantity_free=0,
            quantity_free_remaining=0,
            quantity_remaining=16,
            quantity_reserved=0,
            price_cost=50,
            selling_price=100,
            date_reception=timezone.now(),
        )
        self.produit.refresh_from_db()
        assert self.produit.stock == 10, self.produit.stock
        self.avoir = Avoir.objects.create(type_avoir='AUTRE', created_by=self.user)

    def _ligne(self, quantity):
        return LigneAvoir.objects.create(
            avoir=self.avoir, produit=self.produit,
            quantity=quantity, price=50,
        )

    def _sudo_payload(self, **extra):
        return {
            'validated_by_id': self.user.id,
            'password': 'sudopass123',
            **extra,
        }

    def test_conflicts_endpoint_reports_promised_units_at_risk(self):
        """14 demandés, vendable 10 → 4 unités promises consommées."""
        self._ligne(14)
        url = reverse('avoir-promis-conflicts', kwargs={'pk': self.avoir.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conflicts = response.data['conflicts']
        self.assertEqual(len(conflicts), 1)
        conflict = conflicts[0]
        self.assertEqual(conflict['produit_id'], self.produit.id)
        self.assertEqual(conflict['promis_en_attente'], 6)
        self.assertEqual(conflict['stock_vendable'], 10)
        self.assertEqual(conflict['unites_promises_consommees'], 4)

    def test_no_conflict_when_vendable_covers_discharge(self):
        """Décharge ≤ vendable : aucune unité promise n'est touchée."""
        self._ligne(8)
        url = reverse('avoir-promis-conflicts', kwargs={'pk': self.avoir.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['conflicts'], [])

    def test_decharger_blocked_without_force(self):
        """Sans force_discharge, la décharge est refusée en 409."""
        self._ligne(14)
        url = reverse('avoir-decharger-stock', kwargs={'pk': self.avoir.pk})
        response = self.client.post(url, self._sudo_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(response.data['requires_confirmation'])
        self.assertEqual(len(response.data['promis_conflicts']), 1)

        self.avoir.refresh_from_db()
        self.assertFalse(self.avoir.stock_decharge)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 10)

    def test_decharger_allowed_with_force(self):
        """force_discharge confirme : la décharge passe et consomme le vendable."""
        self._ligne(14)
        url = reverse('avoir-decharger-stock', kwargs={'pk': self.avoir.pk})
        response = self.client.post(
            url, self._sudo_payload(force_discharge=True), format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.avoir.refresh_from_db()
        self.assertTrue(self.avoir.stock_decharge)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 10 - 14)

    def test_decharger_without_conflict_needs_no_force(self):
        """Sans promis à risque, la décharge passe sans flag."""
        self._ligne(8)
        url = reverse('avoir-decharger-stock', kwargs={'pk': self.avoir.pk})
        response = self.client.post(url, self._sudo_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.avoir.refresh_from_db()
        self.assertTrue(self.avoir.stock_decharge)
