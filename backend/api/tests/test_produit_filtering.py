from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User
from api.models import Groupe, Produit, Rayon, Fournisseur

class ProduitFilteringTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client.force_authenticate(user=self.user)
        
        # Create dependencies
        self.rayon = Rayon.objects.create(name="Default Rayon")
        self.fournisseur = Fournisseur.objects.create(name="Default Fournisseur", email="test@example.com", phone="1234567890")
        
        # Create Groupes
        self.groupe_a = Groupe.objects.create(nom="Groupe A")
        self.groupe_b = Groupe.objects.create(nom="Groupe B")
        
        # Create Products
        self.product_a = Produit.objects.create(
            name="Produit A",
            groupe=self.groupe_a,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
            stock=10,
            cost_price=100,
            selling_price=150,
            cip1="111111"
        )
        
        self.product_b = Produit.objects.create(
            name="Produit B",
            groupe=self.groupe_b,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
            stock=20,
            cost_price=200,
            selling_price=250,
            cip1="222222"
        )
        
        self.product_no_group = Produit.objects.create(
            name="Produit Sans Groupe",
            groupe=None,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
            stock=5,
            cost_price=50,
            selling_price=75,
            cip1="333333"
        )

    def test_filter_products_by_groupe(self):
        """
        Test that filtering by 'groupe' ID returns only products in that group.
        """
        response = self.client.get(f'/api/produits/?groupe={self.groupe_a.id}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data) # Handle potential pagination
        
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.product_a.id)
        self.assertEqual(results[0]['name'], "Produit A")

    def test_filter_products_by_other_groupe(self):
        """
        Test filtering by a different group.
        """
        response = self.client.get(f'/api/produits/?groupe={self.groupe_b.id}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.product_b.id)

    def test_filter_ignores_other_products(self):
        """
        Ensure filtering excludes products from other groups or no group.
        """
        response = self.client.get(f'/api/produits/?groupe={self.groupe_a.id}')
        results = response.data.get('results', response.data)
        ids = [p['id'] for p in results]
        
        self.assertNotIn(self.product_b.id, ids)
        self.assertNotIn(self.product_no_group.id, ids)
