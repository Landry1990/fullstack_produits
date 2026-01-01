from django.test import TestCase
from django.utils import timezone
from api.models import Client, Produit, Facture, FactureProduit, StockLot, Commande, CommandeProduit, Fournisseur
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from django.contrib.auth.models import User

class FefoAllocationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.db_client = Client.objects.create(name="Test Client", client_type="PARTICULIER")
        
        self.fournisseur = Fournisseur.objects.create(name="Test Fournisseur")
        
        self.produit = Produit.objects.create(
            name="Paracetamol",
            stock_alert=10,
            selling_price=1000,
            cost_price=500,
            stock=0
        )
        
        today = timezone.now().date()
        
        # Create Commande
        self.commande = Commande.objects.create(fournisseur=self.fournisseur)
        
        # Commande Produits (needed for StockLot)
        self.cp1 = CommandeProduit.objects.create(
            produit=self.produit,
            commande=self.commande,
            quantity=10,
            price=500,
            price_cost=500
        )
        self.cp2 = CommandeProduit.objects.create(
            produit=self.produit,
            commande=self.commande,
            quantity=10,
            price=550,
            price_cost=550
        )

        
        # Lot 1: Exp 30 days
        self.lot1 = StockLot.objects.create(
            produit=self.produit,
            commande_produit=self.cp1,
            fournisseur=self.fournisseur,
            lot="LOT-EXP-SOON",
            date_reception=timezone.now(),
            date_expiration=today + timedelta(days=30),
            quantity_initial=10,
            quantity_remaining=10, # 10 units
            quantity_paid=10,
            price_cost=500,
            selling_price=1000
        )
        
        # Lot 2: Exp 60 days
        self.lot2 = StockLot.objects.create(
            produit=self.produit,
            commande_produit=self.cp2,
            fournisseur=self.fournisseur,
            lot="LOT-EXP-LATER",
            date_reception=timezone.now(),
            date_expiration=today + timedelta(days=60),
            quantity_initial=10,
            quantity_remaining=10, # 10 units
            quantity_paid=10,
            price_cost=550,
            selling_price=1000
        )

    def test_fefo_auto_allocation(self):
        # Create draft invoice
        facture = Facture.objects.create(client=self.db_client, status="BROU")
        FactureProduit.objects.create(
            facture=facture,
            produit=self.produit,
            quantity=5, # Should take from lot1
            selling_price=1000,
            lot=None # Legacy field
        )

        response = self.client.post(f'/api/factures/{facture.id}/valider/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh lots
        self.lot1.refresh_from_db()
        self.lot2.refresh_from_db()
        
        # Lot 1 should have 5 remaining (10 - 5)
        self.assertEqual(self.lot1.quantity_remaining, 5)
        # Lot 2 should be untouched
        self.assertEqual(self.lot2.quantity_remaining, 10)

    def test_manual_lot_selection(self):
        # Create draft invoice
        facture = Facture.objects.create(client=self.db_client, status="BROU")
        
        # User manually selects Lot 2 (Expiring Later)
        FactureProduit.objects.create(
            facture=facture,
            produit=self.produit,
            quantity=5,
            selling_price=1000,
            stock_lot=self.lot2, # Explicit manual selection
            lot=None
        )

        response = self.client.post(f'/api/factures/{facture.id}/valider/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.lot1.refresh_from_db()
        self.lot2.refresh_from_db()
        
        # Lot 1 should be untouched
        self.assertEqual(self.lot1.quantity_remaining, 10)
        # Lot 2 should have 5 remaining
        self.assertEqual(self.lot2.quantity_remaining, 5)
