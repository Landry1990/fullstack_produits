from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .factories import TestDataFactory
from ..models import Facture, FactureProduit, Profile

class StockLoopholeTestCase(APITestCase):
    """Test case for the stock validation loophole (multiple lines bypassing stock)."""
    
    def setUp(self):
        self.user = TestDataFactory.create_user(username='vendeur_test')
        self.profile, _ = Profile.objects.get_or_create(user=self.user)
        self.profile.can_sell_negative_stock = False
        self.profile.save()
        
        self.client.force_authenticate(user=self.user)
        
        # Product with stock = 1
        self.produit = TestDataFactory.create_produit(
            name='Produit Rare',
            stock=1,
            selling_price=100
        )
        
    def test_stock_aggregation_validation(self):
        """Test that multiple lines of the same product are correctly aggregated during validation."""
        # Create invoice with 2 lines of 1 unit each. Total = 2. Stock = 1.
        facture = TestDataFactory.create_facture(status='BROU')
        
        # Line 1
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=1,
            selling_price=100
        )
        # Line 2
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=1,
            selling_price=100
        )
        
        # Attempt to validate
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        
        # Should FAIL with 400 Bad Request
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Stock insuffisant', response.data['detail'])
        self.assertIn('Quantité totale demandée: 2', response.data['detail'])
        
        # Verify stock remains 1
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 1)

    def test_superuser_can_still_force_stock(self):
        """Test that superusers can still bypass stock limits (existing requirement)."""
        admin_user = TestDataFactory.create_superuser(username='admin_test')
        self.client.force_authenticate(user=admin_user)
        
        facture = TestDataFactory.create_facture(status='BROU')
        TestDataFactory.create_facture_produit(facture=facture, produit=self.produit, quantity=2)
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        
        # Should succeed for admin
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, -1)
