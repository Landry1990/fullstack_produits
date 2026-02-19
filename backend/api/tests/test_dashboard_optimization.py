from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from api.models import Fournisseur, Commande, CommandeProduit, PaiementFournisseur
from django.contrib.auth.models import User
from decimal import Decimal

class DashboardOptimizationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser('admin', 'admin@test.com', 'password')
        self.client.force_authenticate(user=self.user)

        # Create data
        self.f1 = Fournisseur.objects.create(name="F1", email="f1@test.com", phone="123456789")
        self.f2 = Fournisseur.objects.create(name="F2", email="f2@test.com", phone="987654321")

        # F1: 1 order, 2 products. Total = 10*10 + 5*20 = 200. Paid = 50. Debt = 150.
        c1 = Commande.objects.create(fournisseur=self.f1, status=Commande.Status.CLOTUREE)
        CommandeProduit.objects.create(commande=c1, price=10, price_cost=10, quantity=10)
        CommandeProduit.objects.create(commande=c1, price=20, price_cost=20, quantity=5)
        PaiementFournisseur.objects.create(fournisseur=self.f1, montant=50)

        # F2: 2 orders.
        # Order 1: 100. Paid 100. Debt 0.
        c2 = Commande.objects.create(fournisseur=self.f2, status=Commande.Status.CLOTUREE)
        CommandeProduit.objects.create(commande=c2, price=100, price_cost=100, quantity=1)
        PaiementFournisseur.objects.create(fournisseur=self.f2, montant=100)
        
        # Order 2: 50. Paid 0. Debt 50.
        c3 = Commande.objects.create(fournisseur=self.f2, status=Commande.Status.CLOTUREE)
        CommandeProduit.objects.create(commande=c3, price=50, price_cost=50, quantity=1)

    def test_suppliers_stats_correctness(self):
        url = reverse('dashboard-supplier-debts')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.data
        suppliers = data['suppliers']
        
        # F1
        s1_data = next((s for s in suppliers if s['id'] == self.f1.id), None)
        self.assertIsNotNone(s1_data)
        self.assertEqual(s1_data['debt'], 150.0)

        # F2
        s2_data = next((s for s in suppliers if s['id'] == self.f2.id), None)
        self.assertIsNotNone(s2_data)
        self.assertEqual(s2_data['debt'], 50.0)
        
        self.assertEqual(data['total_debt'], 200.0)

    def test_suppliers_stats_queries(self):
        url = reverse('dashboard-supplier-debts')
        
        # Determine expected query count
        # Currently N+1 problem exists.
        # With optimization, it should be constant low number.
        
        with self.assertNumQueries(1): # Optimized to 1 query!
            self.client.get(url)
