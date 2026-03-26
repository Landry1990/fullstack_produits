from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from api.models import (
    Inventaire, LigneInventaire, Produit, StockLot, MouvementStock, StockAdjustment
)
from api.tests.factories import TestDataFactory
from django.contrib.auth.models import User
from decimal import Decimal

class StockInventoryTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_inv_test', password='password')
        self.client.force_authenticate(user=self.user)
        # Use force_login or authenticate for non-API direct calls if needed, 
        # Create unique suppliers first
        f1 = self.factory.create_fournisseur(name="S1", email="s1@test.com", phone="111111111")
        f2 = self.factory.create_fournisseur(name="S2", email="s2@test.com", phone="222222222")
        
        # Products
        self.p1 = self.factory.create_produit(name="Product 1", stock=50, use_lot_management=True, fournisseur=f1)
        self.lot1 = self.factory.create_stock_lot(produit=self.p1, quantity=50, lot_name="LOT-INV-01")
        
        self.p2 = self.factory.create_produit(name="Product 2", stock=20, use_lot_management=False, fournisseur=f2)
        
    def test_complete_inventory_flow(self):
        """Test full flow: Create -> Pre-populate -> Edit -> Validate."""
        # 1. Create Inventory
        url_create = reverse('inventaire-list')
        res_create = self.client.post(url_create, {'description': 'Test Inv', 'inventory_type': 'RAYON'})
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        inv_id = res_create.data['id']
        
        # 2. Pre-populate (for p1's category)
        url_pop = reverse('inventaire-pre-populate', args=[inv_id])
        res_pop = self.client.post(url_pop, {'rayon_id': self.p1.rayon.id})
        self.assertEqual(res_pop.status_code, status.HTTP_200_OK)
        
        # Check that a line was created for p1
        self.assertTrue(LigneInventaire.objects.filter(inventaire_id=inv_id, produit=self.p1).exists())
        line_p1 = LigneInventaire.objects.get(inventaire_id=inv_id, produit=self.p1)
        self.assertEqual(line_p1.stock_theorique, 50)
        
        # 3. Add p2 manually
        url_lines = reverse('inventaire-lignes', args=[inv_id])
        res_add = self.client.post(url_lines, {'produit': self.p2.id, 'quantite_physique': 18}) # Ecart -2
        self.assertEqual(res_add.status_code, status.HTTP_201_CREATED)
        
        # 4. Modify p1 quantity (Ecart +5)
        line_p1.quantite_physique = 55
        line_p1.save()
        
        # 5. Validate
        url_val = reverse('inventaire-validate', args=[inv_id])
        # Note: validate_sudo_mode might require sudo password if configured, 
        # but for superuser it might be bypassed or handled. 
        # Let's check if the view allows superuser without extra password in tests.
        res_val = self.client.post(url_val, {'sudo_password': 'password'}) # Added just in case
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)
        
        # 6. Verify stock updates
        self.p1.refresh_from_db()
        self.p2.refresh_from_db()
        self.assertEqual(self.p1.stock, 55)
        self.assertEqual(self.p2.stock, 18)
        
        # Verify lot update for p1
        self.lot1.refresh_from_db()
        self.assertEqual(self.lot1.quantity_remaining, 55)
        
        # Verify traceability
        self.assertTrue(MouvementStock.objects.filter(produit=self.p1, quantite=5).exists())
        self.assertTrue(MouvementStock.objects.filter(produit=self.p2, quantite=-2).exists())
        self.assertTrue(StockAdjustment.objects.filter(produit=self.p1, quantity_change=5).exists())
