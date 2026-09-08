"""
Tests for overpayment scenarios (payment > invoice total).
Tests critical business logic:
- Backend caps the payment amount to the remaining balance
- The invoice reaches PAYEE status with no excess in DB
- Especes overpayment: the capped amount equals the total (rendu monnaie = 0 in DB)
"""
from decimal import Decimal

from django.db.models import Sum as DjangoSum
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Caisse, Facture, PosteVente
from .factories import TestDataFactory
from ..models import FactureProduit


class OverpaymentTestCase(APITestCase):
    """Base setup with an active PosteVente so CaisseViewSet.create works."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()
        # CaisseViewSet.create requires an active sales point for the user
        PosteVente.objects.create(vendeur=self.user, est_actif=True)


class OverpaymentCappingTest(OverpaymentTestCase):
    """Test: payment amount exceeding the invoice total is capped."""

    def test_paiement_superieur_total_cappe_statut_paye(self):
        """
        A payment of 1500F on a 1000F invoice must be capped to 1000F.
        The invoice must reach PAYEE status and no excess payment must
        be stored in the database.
        """
        produit = TestDataFactory.create_produit(
            name='Produit Overpay',
            stock=10,
            cost_price=Decimal('500'),
            selling_price=Decimal('1000'),
        )
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00'),
        )
        FactureProduit.objects.create(
            facture=facture,
            produit=produit,
            quantity=1,
            selling_price=Decimal('1000'),
        )

        url = reverse('caisse-list')
        response = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '1500',  # Exceeds the 1000F total
            'statut': 'completee',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # The payment record must have been capped to 1000
        payment = Caisse.objects.get(id=response.data['id'])
        self.assertEqual(
            payment.montant,
            Decimal('1000.00'),
            f"Payment must be capped to 1000, got {payment.montant}"
        )

        # The invoice must be PAYEE
        facture.refresh_from_db()
        self.assertEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Invoice must be PAYEE after a capped full payment"
        )

        # No excess: total payments in DB must not exceed the invoice total
        total_paye = Caisse.objects.filter(
            facture=facture, statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(
            total=DjangoSum('montant')
        )['total'] or Decimal(0)
        self.assertLessEqual(
            total_paye,
            facture.total_ttc,
            f"Total payments ({total_paye}) must not exceed invoice total "
            f"({facture.total_ttc})"
        )
        self.assertEqual(
            total_paye,
            Decimal('1000.00'),
            f"Total paid must be exactly 1000, got {total_paye}"
        )

    def test_surpaiement_especes_rendu_monnaie_implicit(self):
        """
        When a client overpays in especes (e.g. 2000F for a 1500F invoice),
        the backend caps the stored amount to 1500F. The "rendu monnaie"
        (500F) is implicitly handled: the excess is never stored in DB.
        The payment record equals exactly the invoice total.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1500.00'),
        )

        url = reverse('caisse-list')
        response = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '2000',  # Client gives 2000 for a 1500 invoice
            'statut': 'completee',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # The stored payment must be exactly 1500 (capped, rendu = 500 implicit)
        payment = Caisse.objects.get(id=response.data['id'])
        self.assertEqual(
            payment.montant,
            Decimal('1500.00'),
            f"Payment must be capped to 1500 (rendu monnaie = 500 implicit), "
            f"got {payment.montant}"
        )

        # Verify the "rendu monnaie" is not stored as an extra payment
        paiements = Caisse.objects.filter(
            facture=facture, statut='completee'
        ).exclude(mode_paiement='en_compte')
        self.assertEqual(
            paiements.count(), 1,
            "Only one payment record should exist (no excess payment)"
        )

        # The invoice must be PAYEE
        facture.refresh_from_db()
        self.assertEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Invoice must be PAYEE after capped especes payment"
        )

        # The excédent (rendu monnaie) is traced by the difference between
        # what the client offered and what was actually recorded.
        montant_offert = Decimal('2000.00')
        montant_enregistre = payment.montant
        rendu_monnaie = montant_offert - montant_enregistre
        self.assertEqual(
            rendu_monnaie,
            Decimal('500.00'),
            f"Rendu monnaie (excédent) should be 500, got {rendu_monnaie}"
        )


class OverpaymentMultiplePaymentsTest(OverpaymentTestCase):
    """Test: overpayment on a partially paid invoice is capped to the remainder."""

    def test_surpaiement_sur_facture_partiellement_payee(self):
        """
        A 1000F invoice already paid 600F: a second payment of 600F (exceeding
        the 400F remainder) must be capped to 400F. The invoice reaches PAYEE.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00'),
        )

        # First payment: 600F in especes
        Caisse.objects.create(
            facture=facture,
            montant=Decimal('600.00'),
            mode_paiement='especes',
            statut='completee',
            user=self.user,
        )

        url = reverse('caisse-list')
        # Second payment: 600F (exceeds the 400F remainder)
        response = self.client.post(url, {
            'facture': facture.id,
            'mode_paiement': 'carte',
            'montant': '600',
            'statut': 'completee',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # The second payment must be capped to 400 (remaining balance)
        payment2 = Caisse.objects.get(id=response.data['id'])
        self.assertEqual(
            payment2.montant,
            Decimal('400.00'),
            f"Second payment must be capped to 400 (remaining), "
            f"got {payment2.montant}"
        )

        # The invoice must be PAYEE
        facture.refresh_from_db()
        self.assertEqual(
            facture.status,
            Facture.Status.PAYEE,
            "Invoice must be PAYEE after the capped second payment"
        )

        # Total payments must equal exactly 1000 (600 + 400), not 1200
        total_paye = Caisse.objects.filter(
            facture=facture, statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(
            total=DjangoSum('montant')
        )['total'] or Decimal(0)
        self.assertEqual(
            total_paye,
            Decimal('1000.00'),
            f"Total paid must be exactly 1000 (600+400), got {total_paye}"
        )
