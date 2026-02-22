"""
Tests d'intégration pour le processus de Pointage Global et de Règlement Multiple
Test cases:
1. Création d'un paiement lié à plusieurs factures/commandes
2. Vérification de la mise à jour des relations (commandes)
"""
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import TestDataFactory
from ..models import Commande, PaiementFournisseur

class PointageGlobalTestCase(APITestCase):
    
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Grossiste Global',
            email='grossiste.global@test.com',
            phone='09876543210'
        )
        
    def test_paiement_global_lie_factures(self):
        """Test la création d'un paiement en liant plusieurs factures via commande_ids."""
        
        # 1. Création de deux factures cloturées
        commande1 = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='CLOT',
            numero_facture='FACT-001'
        )
        # Ajouter des produits (total 15000)
        produit = TestDataFactory.create_produit(name='ProdA', stock=100)
        TestDataFactory.create_commande_produit(
            commande=commande1, produit=produit, quantity=10, price=1500, price_cost=1500
        )
        
        commande2 = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='CLOT',
            numero_facture='FACT-002'
        )
        # Ajouter des produits (total 25000)
        TestDataFactory.create_commande_produit(
            commande=commande2, produit=produit, quantity=10, price=2500, price_cost=2500
        )
        
        # 2. Préparation du payload comme envoyé par le frontend (FinanceFournisseurModal)
        url = reverse('paiementfournisseur-list')
        payload = {
            'fournisseur': self.fournisseur.id,
            'montant': '40000.00',
            'mode_paiement': 'CHQ',
            'reference': 'CHQ-999-GLOBAL',
            'notes': 'Règlement global de test',
            'commande_ids': [commande1.id, commande2.id]
        }
        
        # 3. Appel à l'API
        response = self.client.post(url, payload, format='json')
        
        # 4. Vérification du statut de la requête
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PaiementFournisseur.objects.count(), 1)
        
        # 5. Vérification des relations en base de données
        paiement = PaiementFournisseur.objects.first()
        self.assertEqual(paiement.fournisseur.id, self.fournisseur.id)
        self.assertEqual(paiement.montant, Decimal('40000.00'))
        
        # Vérification du ManyToMany (les commandes liées)
        commandes_liees = paiement.commandes.all()
        self.assertEqual(commandes_liees.count(), 2)
        
        # Les factures doivent être celles insérées
        ids_lies = [c.id for c in commandes_liees]
        self.assertIn(commande1.id, ids_lies)
        self.assertIn(commande2.id, ids_lies)
        
        # 6. Vérification de la réponse standard renvoyée par le serializer (test property 'commandes_liees')
        self.assertIn('commandes_liees', response.data)
        self.assertIn('FACT-001', response.data['commandes_liees'])
        self.assertIn('FACT-002', response.data['commandes_liees'])
