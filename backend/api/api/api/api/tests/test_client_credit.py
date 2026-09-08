from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import AvoirClient, MouvementCaisse, MouvementStock
from api.tests.factories import TestDataFactory


class AvoirClientTests(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(self.user)
        self.customer = TestDataFactory.create_client()
        self.product = TestDataFactory.create_produit(stock=5, use_lot_management=False)
        self.invoice = TestDataFactory.create_facture(
            client=self.customer, status='PAY', total_ttc=Decimal('2000.00'), created_by=self.user
        )

    def test_create_validate_cash_and_restore_stock(self):
        response = self.client.post(reverse('avoirclient-list'), {
            'facture_origine': self.invoice.id,
            'client': self.customer.id,
            'montant_total': '2000.00',
            'type_motif': 'RETOUR',
            'notes': 'Retour après clôture',
            'lignes': [{
                'produit': self.product.id,
                'quantity': 2,
                'prix_unitaire': '1000.00',
                'remise': '0.00',
                'tva': '0.00',
                'lot': '',
                'stock_lot': None,
            }],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        avoir = AvoirClient.objects.get(pk=response.data['id'])
        self.assertRegex(avoir.numero, r'^AVC-\d{6}-\d{4}$')
        self.assertEqual(avoir.lignes.count(), 1)

        response = self.client.post(
            reverse('avoirclient-valider', kwargs={'pk': avoir.pk}),
            {'refund_method': 'cash'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        avoir.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(avoir.statut, AvoirClient.Statut.VALIDEE)
        self.assertEqual(self.product.stock, 7)
        self.assertTrue(MouvementStock.objects.filter(
            produit=self.product,
            type_mouvement=MouvementStock.TypeMouvement.RETOUR,
            quantite=2,
        ).exists())
        self.assertTrue(MouvementCaisse.objects.filter(
            type='SORTIE', montant=Decimal('2000.00')
        ).exists())
