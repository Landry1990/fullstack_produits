from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from .factories import TestDataFactory
from ..models import Produit, MouvementStock, Commande, CommandeProduit

class GlobalStockHistoryTestCase(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        # Create product with reserve storage
        self.produit = TestDataFactory.create_produit(
            name='Produit Test Reserve',
            stock=0,
            stock_reserve=0,
            has_reserve_storage=True
        )
        self.fournisseur = self.produit.fournisseur

    def test_global_stock_history_flow(self):
        """
        Verify that history reflects global stock (rayon + reserve) across different operations.
        """
        # 1. Reception to Reserve
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='PREP')
        CommandeProduit.objects.create(
            commande=commande,
            produit=self.produit,
            quantity=100,
            price_cost=50,
            lot='LOT-001'
        )
        self.client.post(reverse('commande-cloturer', kwargs={'pk': commande.pk}))
        
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 0)
        self.assertEqual(self.produit.stock_reserve, 100)
        self.assertEqual(self.produit.total_stock, 100)

        # 2. Transfer from Reserve to Rayon
        self.client.post(reverse('produit-reappro-rayon', kwargs={'pk': self.produit.pk}), {
            'quantity': 40
        })
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 40)
        self.assertEqual(self.produit.stock_reserve, 60)
        self.assertEqual(self.produit.total_stock, 100)

        # 3. Sale from Rayon
        # We need a manual sale validation or mock it. 
        # For simplicity, let's just trigger a manual adjustment and check history view
        self.client.post(reverse('produit-adjust-stock', kwargs={'pk': self.produit.pk}), {
            'new_quantity': 30, # Change from 40 to 30 in Rayon
            'reason_type': 'INVENTAIRE'
        })
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 30)
        self.assertEqual(self.produit.stock_reserve, 60)
        self.assertEqual(self.produit.total_stock, 90)

        # 4. Check History View
        response = self.client.get(reverse('produit-history', kwargs={'pk': self.produit.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        history = response.data
        
        # history is sorted by date DESC
        # Latest should be Adjustment: stock_apres=90, stock_avant=100, quantity=-10
        self.assertEqual(history[0]['stock_apres'], 90)
        self.assertEqual(history[0]['quantity'], -10)
        self.assertEqual(history[0]['stock_avant'], 100)
        
        # Second latest should be REAPPRO_INTERSTOCK: stock_apres=100, stock_avant=100, quantity=40 (but treated as 0 in global)
        self.assertEqual(history[1]['type'], 'REAPPRO_INTERSTOCK')
        self.assertEqual(history[1]['stock_apres'], 100)
        self.assertEqual(history[1]['stock_avant'], 100)
        
        # Third latest should be ENTREE (Commande): stock_apres=100, stock_avant=0, quantity=100
        self.assertEqual(history[2]['stock_apres'], 100)
        self.assertEqual(history[2]['quantity'], 100)
        self.assertEqual(history[2]['stock_avant'], 0)
