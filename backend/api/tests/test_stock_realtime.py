"""
Tests for the realtime stock broadcast (group 'stock_updates').

Vérifie qu'une écriture du compteur stock déclenche un message
{'type': 'stock_update', 'produits': [...]} via le channel layer.
"""
from unittest.mock import AsyncMock, MagicMock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import TestDataFactory


class StockRealtimeBroadcastTestCase(APITestCase):
    """Broadcast WebSocket des changements de stock."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(
            name='Produit WS', stock=100, cost_price=50, selling_price=100
        )
        self.client_obj = TestDataFactory.create_client()
        # Les actions de facturation exigent une session de caisse active.
        self.session = TestDataFactory.create_session_caisse(user=self.user)

    def _mock_layer(self):
        layer = MagicMock()
        layer.group_send = AsyncMock()
        return layer

    def test_validate_invoice_broadcasts_stock_update(self):
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=5,
            selling_price=self.produit.selling_price,
        )

        layer = self._mock_layer()
        with patch('api.services.realtime.get_channel_layer', return_value=layer):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('facture-valider', kwargs={'pk': facture.pk}),
                    {'mode_paiement': 'especes'},
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        layer.group_send.assert_called_once()
        group, event = layer.group_send.call_args.args
        self.assertEqual(group, 'stock_updates')
        self.assertEqual(event['type'], 'stock_update')
        produits = {p['id']: p for p in event['produits']}
        self.assertIn(self.produit.id, produits)
        self.assertEqual(produits[self.produit.id]['stock'], 95)

    def test_adjust_stock_broadcasts_stock_update(self):
        layer = self._mock_layer()
        with patch('api.services.realtime.get_channel_layer', return_value=layer):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('produit-adjust-stock', kwargs={'pk': self.produit.pk}),
                    {
                        'new_quantity': 80,
                        'reason_type': 'INVENTAIRE',
                        'reason_detail': 'Correction test',
                    },
                    format='json',
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        layer.group_send.assert_called_once()
        group, event = layer.group_send.call_args.args
        self.assertEqual(group, 'stock_updates')
        produits = {p['id']: p for p in event['produits']}
        self.assertEqual(produits[self.produit.id]['stock'], 80)

    def test_notify_stock_changed_ignores_empty_ids(self):
        from api.services import realtime

        with patch.object(
            realtime, 'get_channel_layer', side_effect=AssertionError('ne doit pas être appelé')
        ):
            realtime.notify_stock_changed([])
            realtime.notify_stock_changed(None)
            realtime.notify_stock_changed([None, 0])
