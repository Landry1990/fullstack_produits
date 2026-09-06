"""
Tests for multi-payment scenarios on a single invoice.
Tests critical business logic:
- Full payment split across multiple payment modes
- Partial payment leaving a remaining balance
- Atomicity: a failed payment must not corrupt existing payments
"""
from decimal import Decimal

from django.db.models import Sum as DjangoSum
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Caisse, Facture, PosteVente
from .factories import TestDataFactory


class MultiPaymentTestCase(APITestCase):
    """Base setup with an active PosteVente so CaisseViewSet.create works."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()
        # CaisseViewSet.create requires an active sales point for the user
        PosteVente.objects.create(vendeur=self.user, est_actif=True)


class FullMultiPaymentTest(MultiPaymentTestCase):
    """Test: invoice paid in 3 installments across different modes."""

    def test_facture_payee_en_3_fois_statut_paye(self):
        """
        A 1000F invoice paid in 3 installments (especes 50% + carte 30% +
        momo 20%) must end up with status PAYEE and coherent encaissements
        per mode.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00'),
        )

        url = reverse('caisse-list')

        # Payment 1: especes 500 (50%)
        resp1 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '500',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        # Payment 2: carte 300 (30%)
        resp2 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'carte',
            'montant': '300',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        # Payment 3: momo 200 (20%)
        resp3 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'momo',
            'montant': '200',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_201_CREATED)

        # Reload the facture from DB to check status
        facture.refresh_from_db()
        self.assertEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Facture should be PAYEE after full payment in 3 installments"
        )

        # Verify coherent encaissements per mode
        paiements = Caisse.objects.filter(
            facture=facture, statut='completee'
        ).exclude(mode_paiement='en_compte')

        especes_total = paiements.filter(
            mode_paiement='especes'
        ).aggregate(total=DjangoSum('montant'))['total'] or Decimal(0)
        self.assertEqual(especes_total, Decimal('500.00'))

        carte_total = paiements.filter(
            mode_paiement='carte'
        ).aggregate(total=DjangoSum('montant'))['total'] or Decimal(0)
        self.assertEqual(carte_total, Decimal('300.00'))

        momo_total = paiements.filter(
            mode_paiement='momo'
        ).aggregate(total=DjangoSum('montant'))['total'] or Decimal(0)
        self.assertEqual(momo_total, Decimal('200.00'))

        # Grand total must equal the invoice total
        grand_total = paiements.aggregate(
            total=DjangoSum('montant')
        )['total'] or Decimal(0)
        self.assertEqual(grand_total, Decimal('1000.00'))


class PartialPaymentTest(MultiPaymentTestCase):
    """Test: partial payment leaves the invoice in a non-PAYEE state."""

    def test_paiement_partiel_statut_impaye_reste_a_payer(self):
        """
        A 1000F invoice with a partial payment of 500F (especes 50%) must
        NOT be marked PAYEE. The reste-a-payer must be 500F.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00'),
        )

        url = reverse('caisse-list')
        resp = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '500',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Reload facture: status should NOT be PAYEE (still VALIDEE)
        facture.refresh_from_db()
        self.assertNotEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Partially paid invoice must not be marked PAYEE"
        )
        self.assertEqual(
            facture.status,
            Facture.Status.VALIDEE,
            "Partially paid invoice should remain VALIDEE"
        )

        # Verify reste-a-payer
        total_paye = Caisse.objects.filter(
            facture=facture, statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(
            total=DjangoSum('montant')
        )['total'] or Decimal(0)
        reste_a_payer = facture.total_ttc - total_paye
        self.assertEqual(
            reste_a_payer,
            Decimal('500.00'),
            f"Reste-a-payer should be 500, got {reste_a_payer}"
        )


class MultiPaymentAtomicityTest(MultiPaymentTestCase):
    """Test: a failed payment must not corrupt previously created payments."""

    def test_paiement_echoue_ne_corrompt_pas_paiements_existants(self):
        """
        When a multi-payment sequence includes a payment that fails (e.g.
        negative amount rejected by the backend), the previously created
        valid payments must remain intact and the invoice status must
        reflect only the successful payments.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00'),
        )

        url = reverse('caisse-list')

        # Payment 1: valid - especes 400
        resp1 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '400',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        # Payment 2: valid - carte 300
        resp2 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'carte',
            'montant': '300',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        # Payment 3: INVALID - negative amount must be rejected (400)
        resp3 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'momo',
            'montant': '-100',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(
            resp3.status_code,
            status.HTTP_400_BAD_REQUEST,
            "Negative amount payment must be rejected"
        )

        # Verify: only 2 valid payment records exist (the failed one is not saved)
        paiements = Caisse.objects.filter(
            facture=facture, statut='completee'
        ).exclude(mode_paiement='en_compte')
        self.assertEqual(
            paiements.count(), 2,
            "Only the 2 valid payments should exist in DB"
        )

        # The invoice should NOT be PAYEE (only 700 of 1000 paid)
        facture.refresh_from_db()
        self.assertNotEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Invoice must not be PAYEE after a failed payment"
        )

        # Total paid must be 700 (400 + 300), not 600 or 800
        total_paye = paiements.aggregate(
            total=DjangoSum('montant')
        )['total'] or Decimal(0)
        self.assertEqual(
            total_paye,
            Decimal('700.00'),
            f"Total paid should be 700 (400+300), got {total_paye}"
        )

    def test_paiement_invalide_mode_ne_corrompt_pas_donnees(self):
        """
        A payment with an invalid mode_paiement must be rejected by the
        serializer, and existing valid payments must remain unchanged.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('500.00'),
        )

        url = reverse('caisse-list')

        # Valid payment: especes 500
        resp1 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '500',
            'statut': 'completee',
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        # Invalid payment: negative montant (rejected by CaisseViewSet.create)
        resp2 = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'carte',
            'montant': '-200',
            'statut': 'completee',
        }, format='json')
        # Backend rejects negative amounts
        self.assertIn(
            resp2.status_code,
            [status.HTTP_400_BAD_REQUEST],
            f"Negative montant must be rejected, got {resp2.status_code}"
        )

        # The valid payment must still exist and the invoice must be PAYEE
        facture.refresh_from_db()
        self.assertEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Invoice should be PAYEE from the first valid payment"
        )
        self.assertEqual(
            Caisse.objects.filter(
                facture=facture, statut='completee'
            ).exclude(mode_paiement='en_compte').count(),
            1,
            "Only the valid payment should exist"
        )
