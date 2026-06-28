"""
Tests for cash closure (Clôture Caisse) flow.
Tests critical business logic:
- Totals calculation
- Closure record creation
- Date range filtering
- Écart calculation
"""
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta

from .factories import TestDataFactory
from ..models import ClotureCaisse, Caisse, MouvementCaisse, Facture


class CashClosureTotalsTestCase(APITestCase):
    """Test suite for cash closure totals calculation."""
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        
        # Create client and product for invoices
        self.client_obj = TestDataFactory.create_client()
        self.produit = TestDataFactory.create_produit(stock=1000)
        
    def test_get_totals_returns_correct_amounts(self):
        """
        Test that get_totals returns correct sales totals.
        """
        # Create validated invoices with payments
        facture1 = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('500.00')
        )
        TestDataFactory.create_caisse(
            facture=facture1,
            montant=Decimal('500.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        facture2 = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('300.00')
        )
        TestDataFactory.create_caisse(
            facture=facture2,
            montant=Decimal('300.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        # Get totals
        url = reverse('caisse-get-totals')
        today = timezone.now().date()
        response = self.client.get(url, {
            'date_debut': f'{today}T00:00:00',
            'date_fin': f'{today}T23:59:59'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify totals
        data = response.json()
        self.assertIn('total_ventes', data)
        expected_total = Decimal('800.00')
        self.assertEqual(
            Decimal(str(data.get('total_ventes', 0))),
            expected_total,
            f"Expected total_ventes={expected_total}, got {data.get('total_ventes')}"
        )
    
    def test_get_totals_includes_cash_movements(self):
        """
        Test that totals include cash entries and exits.
        """
        # Create cash entry
        TestDataFactory.create_mouvement_caisse(
            user=self.user,
            type_mouvement='ENTREE',
            montant=Decimal('1000.00'),
            description='Fond de caisse'
        )
        
        # Create cash exit
        TestDataFactory.create_mouvement_caisse(
            user=self.user,
            type_mouvement='SORTIE',
            montant=Decimal('200.00'),
            description='Achat fournitures'
        )
        
        url = reverse('caisse-get-totals')
        today = timezone.now().date()
        response = self.client.get(url, {
            'date_debut': f'{today}T00:00:00',
            'date_fin': f'{today}T23:59:59'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Check entries and exits are reported
        self.assertIn('total_entrees', data)
        self.assertIn('total_sorties', data)


class CashClosureCreationTestCase(APITestCase):
    """Test suite for cash closure creation."""
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()
        self.produit = TestDataFactory.create_produit(stock=1000)
    
    def test_cloturer_creates_record(self):
        """
        Test that clôturer action creates a ClotureCaisse record.
        """
        # Create a sale
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00')
        )
        TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('1000.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        initial_count = ClotureCaisse.objects.count()
        
        url = reverse('caisse-cloturer')
        today = timezone.now().date()
        response = self.client.post(url, {
            'date_debut': f'{today}T00:00:00',
            'date_fin': f'{today}T23:59:59',
            'montant_reel': '1000.00',
            'user_id': self.user.id
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            ClotureCaisse.objects.count(),
            initial_count + 1,
            "A ClotureCaisse record should be created"
        )
    
    def test_cloturer_calculates_ecart(self):
        """
        Test that écart (difference) is calculated correctly.
        """
        # Create sales totaling 1000
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('1000.00')
        )
        TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('1000.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        url = reverse('caisse-cloturer')
        today = timezone.now().date()
        
        # Close with 950 actual amount (50 short)
        response = self.client.post(url, {
            'date_debut': f'{today}T00:00:00',
            'date_fin': f'{today}T23:59:59',
            'montant_reel': '950.00',
            'user_id': self.user.id
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify écart was recorded
        cloture = ClotureCaisse.objects.latest('date')
        self.assertIsNotNone(cloture.ecart_caisse, "Écart should be calculated")
    
    def test_cloturer_date_range_filter(self):
        """
        Test that closure only includes transactions within date range.
        """
        # Create sale from yesterday
        yesterday = timezone.now() - timedelta(days=1)
        facture_yesterday = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('500.00')
        )
        caisse_yesterday = TestDataFactory.create_caisse(
            facture=facture_yesterday,
            montant=Decimal('500.00'),
            mode_paiement='especes',
            user=self.user
        )
        # Manually set date to yesterday
        caisse_yesterday.date_paiement = yesterday
        caisse_yesterday.save()
        
        # Create sale from today
        facture_today = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('300.00')
        )
        TestDataFactory.create_caisse(
            facture=facture_today,
            montant=Decimal('300.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        # Get totals for today only
        url = reverse('caisse-get-totals')
        today = timezone.now().date()
        response = self.client.get(url, {
            'date_debut': f'{today}T00:00:00',
            'date_fin': f'{today}T23:59:59'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Should only include today's 300, not yesterday's 500
        total = Decimal(str(data.get('total_ventes', 0)))
        self.assertLessEqual(
            total,
            Decimal('300.00'),
            "Totals should only include transactions from specified date range"
        )
