"""
Tests pour les endpoints du Dashboard.
Tests couvrent:
- Endpoint stats (revenus, stock, créances, user_stats)
- Endpoint low_stock
- Endpoint supplier_debts
- Contrôle d'accès par rôle
"""
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta

from .factories import TestDataFactory
from ..models import Facture, Produit, Client, Fournisseur, Commande, CommandeProduit


class DashboardStatsTestCase(APITestCase):
    """Test suite pour l'endpoint /api/dashboard/stats/."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('dashboard-stats')

    def test_stats_unauthenticated(self):
        """Vérifie que l'accès non-authentifié est refusé."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stats_returns_revenue(self):
        """Vérifie que le CA du jour est correctement calculé."""
        produit = TestDataFactory.create_produit(stock=100)
        client_obj = TestDataFactory.create_client()

        # Créer 2 factures validées aujourd'hui
        f1 = TestDataFactory.create_facture(
            client=client_obj, status='VAL',
            total_ttc=Decimal('15000.00'), created_by=self.user
        )
        f2 = TestDataFactory.create_facture(
            client=client_obj, status='PAY',
            total_ttc=Decimal('25000.00'), created_by=self.user
        )
        # Facture brouillon (ne doit pas compter)
        f3 = TestDataFactory.create_facture(
            client=client_obj, status='BROU',
            total_ttc=Decimal('99999.00'), created_by=self.user
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn('revenue', data)
        self.assertEqual(data['revenue']['value'], 40000.0)

    def test_stats_returns_stock_value_with_count(self):
        """Vérifie que stock_value retourne value ET count."""
        # Créer 3 produits avec stock > 0, 1 avec stock = 0
        rayon = TestDataFactory.create_rayon(name='R1')
        fournisseur = TestDataFactory.create_fournisseur(name='F1')
        Produit.objects.create(
            name='P1', stock=10, pmp=Decimal('100'), cost_price=100,
            selling_price=200, rayon=rayon, fournisseur=fournisseur
        )
        Produit.objects.create(
            name='P2', stock=20, pmp=Decimal('50'), cost_price=50,
            selling_price=100, rayon=rayon, fournisseur=fournisseur
        )
        Produit.objects.create(
            name='P3', stock=5, pmp=Decimal('200'), cost_price=200,
            selling_price=400, rayon=rayon, fournisseur=fournisseur
        )
        Produit.objects.create(
            name='P4_vide', stock=0, pmp=Decimal('300'), cost_price=300,
            selling_price=600, rayon=rayon, fournisseur=fournisseur
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        sv = response.data['stock_value']
        # value = 10*100 + 20*50 + 5*200 = 1000 + 1000 + 1000 = 3000
        self.assertEqual(sv['value'], 3000.0)
        # count = 3 (only stock > 0)
        self.assertEqual(sv['count'], 3)

    def test_stats_returns_receivables(self):
        """Vérifie le calcul des créances (factures non entièrement payées)."""
        client_obj = TestDataFactory.create_client(name='Débiteur')

        # Facture de 10000, payée 3000 → reste 7000
        f1 = TestDataFactory.create_facture(
            client=client_obj, status='VAL', total_ttc=Decimal('10000.00')
        )
        TestDataFactory.create_caisse(
            facture=f1, montant=Decimal('3000.00'), user=self.user
        )

        # Facture de 5000, non payée → reste 5000
        f2 = TestDataFactory.create_facture(
            client=client_obj, status='VAL', total_ttc=Decimal('5000.00')
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        recv = response.data['receivables']
        self.assertEqual(recv['value'], 12000.0)
        self.assertEqual(recv['count'], 2)

    def test_stats_returns_user_stats(self):
        """Vérifie les statistiques personnelles du vendeur."""
        client_obj = TestDataFactory.create_client()

        # 2 factures créées par l'utilisateur connecté
        TestDataFactory.create_facture(
            client=client_obj, status='VAL',
            total_ttc=Decimal('10000.00'), created_by=self.user
        )
        TestDataFactory.create_facture(
            client=client_obj, status='PAY',
            total_ttc=Decimal('20000.00'), created_by=self.user
        )

        response = self.client.get(self.url)
        data = response.data

        self.assertIn('user_stats', data)
        self.assertEqual(data['user_stats']['sales'], 30000.0)
        self.assertEqual(data['user_stats']['count'], 2)
        self.assertEqual(data['user_stats']['avg_basket'], 15000.0)

    def test_stats_role_pharmacien_gets_full_data(self):
        """Vérifie que l'admin/pharmacien voit toutes les stats."""
        response = self.client.get(self.url)
        data = response.data

        self.assertEqual(data['role'], 'PHARMACIEN')
        # Toutes les clés globales doivent être présentes
        for key in ['revenue', 'sales', 'low_stock', 'receivables', 'stock_value']:
            self.assertIn(key, data, f"Clé '{key}' manquante pour PHARMACIEN")


class DashboardLowStockTestCase(APITestCase):
    """Test suite pour l'endpoint /api/dashboard/low_stock/."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('dashboard-low-stock')
        self.rayon = TestDataFactory.create_rayon()
        self.fournisseur = TestDataFactory.create_fournisseur()

    def test_low_stock_returns_critical_products(self):
        """Vérifie que les produits en rupture ou critique apparaissent."""
        # Produit en rupture (stock=0, rotation > 0)
        Produit.objects.create(
            name='Rupture', stock=0, rotation_moyenne=60,
            cost_price=100, selling_price=200,
            rayon=self.rayon, fournisseur=self.fournisseur
        )
        # Produit critique (stock=5, rotation=60/mois → 2j/unité → 10 jours)
        Produit.objects.create(
            name='Critique', stock=5, rotation_moyenne=60,
            cost_price=100, selling_price=200,
            rayon=self.rayon, fournisseur=self.fournisseur
        )
        # Produit OK (stock=100, rotation=30/mois → 100 jours)
        Produit.objects.create(
            name='OK', stock=100, rotation_moyenne=30,
            cost_price=100, selling_price=200,
            rayon=self.rayon, fournisseur=self.fournisseur
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        names = [p['name'] for p in response.data]
        self.assertIn('Rupture', names)
        self.assertIn('Critique', names)
        self.assertNotIn('OK', names)

    def test_low_stock_includes_days_remaining(self):
        """Vérifie que days_remaining est calculé correctement."""
        # rotation_moyenne=30 (mensuel), stock=10 → 10/(30/30) = 10 jours
        Produit.objects.create(
            name='TestDays', stock=10, rotation_moyenne=30,
            cost_price=100, selling_price=200,
            rayon=self.rayon, fournisseur=self.fournisseur
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        item = next((p for p in response.data if p['name'] == 'TestDays'), None)
        self.assertIsNotNone(item)
        self.assertEqual(item['days_remaining'], 10.0)


class DashboardSupplierDebtsTestCase(APITestCase):
    """Test suite pour l'endpoint /api/dashboard/supplier_debts/."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('dashboard-supplier-debts')

    def test_supplier_debts_returns_debts(self):
        """Vérifie le calcul des dettes fournisseurs."""
        fournisseur = TestDataFactory.create_fournisseur(name='Fournisseur Endetté')
        produit = TestDataFactory.create_produit(fournisseur=fournisseur)

        # Commande clôturée de 50 unités à 100F = 5000F
        commande = TestDataFactory.create_commande(
            fournisseur=fournisseur, status='CLOT'
        )
        TestDataFactory.create_commande_produit(
            commande=commande, produit=produit,
            quantity=50, price=Decimal('100.00')
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertGreater(data['total_debt'], 0)
        self.assertEqual(len(data['suppliers']), 1)
        self.assertEqual(data['suppliers'][0]['name'], 'Fournisseur Endetté')

    def test_supplier_no_debt_when_fully_paid(self):
        """Vérifie qu'un fournisseur entièrement payé n'apparaît pas."""
        from ..models import PaiementFournisseur
        fournisseur = TestDataFactory.create_fournisseur(name='Fournisseur Payé')
        produit = TestDataFactory.create_produit(fournisseur=fournisseur)

        commande = TestDataFactory.create_commande(
            fournisseur=fournisseur, status='CLOT'
        )
        TestDataFactory.create_commande_produit(
            commande=commande, produit=produit,
            quantity=10, price=Decimal('100.00')
        )

        # Payer intégralement
        PaiementFournisseur.objects.create(
            fournisseur=fournisseur,
            montant=Decimal('1000.00'),
            mode_paiement='virement',
            created_by=self.user
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        names = [s['name'] for s in response.data['suppliers']]
        self.assertNotIn('Fournisseur Payé', names)
