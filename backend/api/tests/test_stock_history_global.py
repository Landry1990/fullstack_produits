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
        self.user = TestDataFactory.create_superuser(username='admin_hist', password='adminpass123')
        # Standard users might not have can_adjust_stock, so we need a supervisor for Sudo
        self.supervisor = TestDataFactory.create_superuser(username='super_hist', password='passsupervisor')
        
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
        Simule également le mode SUDO pour le transfert.
        """
        # 1. Reception to Reserve
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status='PREP')
        TestDataFactory.create_commande_produit(
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

        # 2. Transfer from Reserve to Rayon (with Sudo Mode)
        # Give the lot a specific price and expiration to check sync
        lot = self.produit.stock_lots.first()
        lot.selling_price = Decimal('75.00')
        lot.date_expiration = timezone.now().date() + timezone.timedelta(days=365)
        lot.save()

        response = self.client.post(reverse('produit-transfer-to-shelf', kwargs={'pk': self.produit.pk}), {
            'quantity': 40,
            'validated_by_id': self.supervisor.id,
            'sudo_password': 'passsupervisor'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 40)
        self.assertEqual(self.produit.stock_reserve, 60)
        self.assertEqual(self.produit.total_stock, 100)
        # Check attribute sync
        self.assertEqual(self.produit.selling_price, Decimal('75.00'))
        self.assertEqual(self.produit.expire_date, lot.date_expiration)

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
        
        # REAPPRO_INTERSTOCK now has TWO lines (Entrance and Exit)
        # Line 1: Entrée Rayon (Positive)
        self.assertEqual(history[1]['type'], 'REAPPRO_INTERSTOCK')
        self.assertEqual(history[1]['quantity'], 40)
        self.assertEqual(history[1]['libelle'], f'Entrée Rayon: 40 unités. (Validé par {self.supervisor.username})')
        self.assertEqual(history[1]['stock_apres'], 100)
        self.assertEqual(history[1]['user'], self.supervisor.username)
        
        # Line 2: Sortie Réserve (Negative)
        self.assertEqual(history[2]['type'], 'REAPPRO_INTERSTOCK')
        self.assertEqual(history[2]['quantity'], -40)
        self.assertEqual(history[2]['libelle'], f'Sortie Réserve: 40 unités. (Validé par {self.supervisor.username})')
        self.assertEqual(history[2]['stock_apres'], 100)
        self.assertEqual(history[2]['user'], self.supervisor.username)
        
        # Final: ENTREE (Commande)
        self.assertEqual(history[3]['stock_apres'], 100)
        self.assertEqual(history[3]['quantity'], 100)
