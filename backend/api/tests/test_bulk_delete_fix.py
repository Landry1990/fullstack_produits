from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .factories import TestDataFactory
from ..models import Commande, CommandeProduit, StockLot, Facture, FactureProduit, FactureProduitAllocation

class BulkDeleteFixTestCase(APITestCase):
    """Test suite for bulk delete fix."""
    
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.fournisseur = TestDataFactory.create_fournisseur(name='Pharma Grossiste')
        self.rayon = TestDataFactory.create_rayon(name='Comprimés')
        self.produit = TestDataFactory.create_produit(name='Doliprane', stock=10, cost_price=500, rayon=self.rayon, fournisseur=self.fournisseur)

    def test_bulk_delete_skips_closed_orders(self):
        """Test that bulk delete skips closed orders and returns 204 if some were deleted."""
        # 1. Create one PREP and one CLOT order
        prep_cmd = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='PREP')
        clot_cmd = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='CLOT')
        
        url = reverse('commande-bulk-delete')
        data = {'ids': [prep_cmd.id, clot_cmd.id]}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(Commande.objects.filter(id=prep_cmd.id).count(), 0)
        self.assertEqual(Commande.objects.filter(id=clot_cmd.id).count(), 1)

    def test_bulk_delete_fails_if_only_closed_orders(self):
        """Test that bulk delete returns 400 if only closed orders are selected."""
        clot_cmd = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='CLOT')
        
        url = reverse('commande-bulk-delete')
        data = {'ids': [clot_cmd.id]}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('déjà clôturées', response.data['detail'])

    def test_bulk_delete_protected_error(self):
        """Test handling of ProtectedError when a lot is sold."""
        # 1. Create a PREP order with a lot (unusual but possible for testing the catch block)
        prep_cmd = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='PREP')
        line = TestDataFactory.create_commande_produit(commande=prep_cmd, produit=self.produit, quantity=10, price=500, price_cost=500)
        lot = StockLot.objects.create(
            produit=self.produit,
            commande_produit=line,
            quantity_initial=10,
            quantity_remaining=10,
            price_cost=500,
            date_reception=prep_cmd.date
        )
        
        # 2. Sell from this lot to protect it
        facture = Facture.objects.create(status='VAL')
        fp = FactureProduit.objects.create(facture=facture, produit=self.produit, quantity=5, selling_price=1000)
        FactureProduitAllocation.objects.create(facture_produit=fp, stock_lot=lot, quantity=5, cost_price=500, selling_price=1000)
        
        # 3. Try to delete the order
        url = reverse('commande-bulk-delete')
        data = {'ids': [prep_cmd.id]}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('lots déjà utilisés', response.data['detail'])
