from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import AvoirClient, DepotClient, LigneAvoirClient, MouvementCaisse, MouvementStock
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
            type='SORTIE', montant=Decimal('2000.00'), mode_paiement='especes'
        ).exists())

    def _create_avoir(self):
        avoir = AvoirClient.objects.create(
            facture_origine=self.invoice,
            client=self.customer,
            montant_total=Decimal('2000.00'),
            type_motif='RETOUR',
            created_by=self.user,
        )
        LigneAvoirClient.objects.create(
            avoir_client=avoir,
            produit=self.product,
            quantity=2,
            prix_unitaire='1000.00',
            remise='0.00',
            tva='0.00',
        )
        return avoir

    def test_validate_om_refund_records_om_channel(self):
        """Un remboursement OM crée une sortie de caisse sur le canal om,
        pas en espèces — sinon décalage à la clôture."""
        avoir = self._create_avoir()
        response = self.client.post(
            reverse('avoirclient-valider', kwargs={'pk': avoir.pk}),
            {'refund_method': 'om'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        mouvement = MouvementCaisse.objects.get(motif__icontains=avoir.numero)
        self.assertEqual(mouvement.type, 'SORTIE')
        self.assertEqual(mouvement.mode_paiement, 'om')
        self.assertEqual(mouvement.montant, Decimal('2000.00'))

    def test_validate_credit_creates_depot_without_movement(self):
        """Un remboursement en crédit crée un dépôt client et aucune
        sortie de caisse."""
        avoir = self._create_avoir()
        response = self.client.post(
            reverse('avoirclient-valider', kwargs={'pk': avoir.pk}),
            {'refund_method': 'credit'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(DepotClient.objects.filter(
            client=self.customer, montant=Decimal('2000.00'), facture=self.invoice
        ).exists())
        self.assertFalse(MouvementCaisse.objects.filter(motif__icontains=avoir.numero).exists())

    def test_validate_invalid_refund_method_rejected(self):
        avoir = self._create_avoir()
        response = self.client.post(
            reverse('avoirclient-valider', kwargs={'pk': avoir.pk}),
            {'refund_method': 'wizzal'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        avoir.refresh_from_db()
        self.assertEqual(avoir.statut, AvoirClient.Statut.BROUILLON)

    def test_suggested_refund_method_uses_dominant_invoice_mode(self):
        """Le mode suggéré est celui qui a le plus encaissé sur la facture."""
        TestDataFactory.create_caisse(facture=self.invoice, montant=1500, mode_paiement='om', user=self.user)
        TestDataFactory.create_caisse(facture=self.invoice, montant=500, mode_paiement='especes', user=self.user)
        avoir = self._create_avoir()
        response = self.client.get(reverse('avoirclient-detail', kwargs={'pk': avoir.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['suggested_refund_method'], 'om')
