"""
Tests for Order (Commande) management flow.
Tests critical business logic:
- Order creation
- Adding lines
- Closing order (Stock increment, Lot creation, PMP update)
"""
from decimal import Decimal
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import TestDataFactory
from ..models import Commande, CommandeProduit, StockLot, Produit

class OrderManagementTestCase(APITestCase):
    """Test suite for order management flow."""
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        
        self.fournisseur = TestDataFactory.create_fournisseur(name='Pharma Grossiste')
        self.rayon = TestDataFactory.create_rayon(name='Comprimés')
        self.produit = TestDataFactory.create_produit(
            name='Doliprane 1000mg',
            stock=10,
            cost_price=500, # Initial PMP
            selling_price=1000,
            rayon=self.rayon,
            fournisseur=self.fournisseur
        )

    def test_create_commande(self):
        """Test creating a new draft command."""
        url = reverse('commande-list')
        data = {
            'fournisseur': self.fournisseur.id,
            # 'status': 'BROU' # Status is likely read-only or defaults to PREP
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Commande.objects.count(), 1)
        # Default status is PREP according to models.py
        self.assertEqual(Commande.objects.first().status, 'PREP')

    def test_add_lines_to_commande(self):
        """Test adding products to a command."""
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='BROU'
        )
        url = reverse('commandeproduit-list')
        data = {
            'commande': commande.id,
            'produit': self.produit.id,
            'quantity': 100,
            'price': 450,
            'price_cost': 450
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CommandeProduit.objects.count(), 1)
        
        # Verify line details
        line = CommandeProduit.objects.first()
        self.assertEqual(line.quantity, 100)
        self.assertEqual(line.price, 450)

    def test_close_command_updates_stock_and_creates_lot(self):
        """Test that closing a command increments stock and creates a lot."""
        initial_stock = self.produit.stock
        quantity_received = 50
        purchase_price = 600

        # Create command and line
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='BROU'
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=quantity_received,
            price=purchase_price,
            price_cost=purchase_price
        )

        # Close command
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify status
        commande.refresh_from_db()
        self.assertEqual(commande.status, 'CLOT')
        
        # Verify stock increment
        self.produit.refresh_from_db()
        expected_stock = initial_stock + quantity_received
        self.assertEqual(self.produit.stock, expected_stock)
        
        # Verify Lot creation
        lot = StockLot.objects.filter(produit=self.produit).order_by('-created_at').first()
        self.assertIsNotNone(lot)
        self.assertEqual(lot.quantity_initial, quantity_received)
        self.assertEqual(lot.quantity_remaining, quantity_received)
        self.assertEqual(lot.price_cost, purchase_price)

    def test_close_command_updates_pmp(self):
        """
        Test Weighted Average Price (PMP) calculation on reception.
        Initial: 10 units @ 500 = 5000 value
        Buy: 10 units @ 600 = 6000 value
        Total: 20 units @ 11000 value
        New PMP should be 11000 / 20 = 550
        """
        # Ensure initial state
        self.produit.stock = 10
        self.produit.cost_price = 500
        self.produit.pmp = 500 # Sync PMP with cost price
        self.produit.save()

        quantity_received = 10
        purchase_price = 600

        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='BROU'
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=quantity_received,
            price=purchase_price,
            price_cost=purchase_price
        )

        # Close command
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        self.client.post(url)
        
        self.produit.refresh_from_db()
        
        # PMP Calculation: ((10 * 500) + (10 * 600)) / (10 + 10) = (5000 + 6000) / 20 = 11000 / 20 = 550
        self.assertEqual(self.produit.pmp, Decimal('550.00'))
