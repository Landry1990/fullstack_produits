"""
Tests de regression pour le statut de clôture des commandes.

Couvre :
- Apres clôture d'une commande PREP, le statut est CLOT (regression du bug
  historique ou le statut restait PREP apres clôture).
- Une commande deja CLOT ne peut pas etre cloturee a nouveau (erreur 400).
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Commande
from .factories import TestDataFactory


class CommandeClotureStatusTestCase(APITestCase):
    """Tests de regression sur le statut CLOT apres clôture."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

        self.fournisseur = TestDataFactory.create_fournisseur(name='Grossiste Cloture')
        self.rayon = TestDataFactory.create_rayon(name='Rayon Cloture')
        self.produit = TestDataFactory.create_produit(
            name='Produit Cloture',
            stock=10,
            cost_price=500,
            selling_price=1000,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
        )
        # Lot initial pour coherence du stock gere par lots
        TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=10,
            quantity_remaining=10,
            lot_name='INIT-CLOT',
            price_cost=500,
        )

    def test_cloture_commande_prep_devient_clot(self):
        """Regression : apres clôture d'une commande PREP, le statut est CLOT (pas PREP)."""
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='PREP',
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=15,
            price=550,
            price_cost=550,
        )

        # Verifier l'etat initial
        self.assertEqual(commande.status, 'PREP')

        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        commande.refresh_from_db()
        # Le statut doit etre CLOT, pas PREP (regression du bug historique)
        self.assertEqual(commande.status, 'CLOT')
        self.assertNotEqual(commande.status, 'PREP')
        self.assertIsNotNone(commande.date_cloture)

    def test_commande_deja_clot_ne_peut_pas_etre_recloturee(self):
        """Une commande deja CLOT ne peut pas etre cloturee a nouveau (erreur 400)."""
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='PREP',
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=10,
            price=500,
            price_cost=500,
        )

        # Premiere clôture : OK
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        commande.refresh_from_db()
        self.assertEqual(commande.status, 'CLOT')

        # Deuxieme clôture : doit echouer (400 Bad Request)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Le message contient "déjà clôturée" (avec accents) — on normalise pour comparer
        import unicodedata
        msg = unicodedata.normalize('NFKD', str(response.data)).encode('ascii', 'ignore').decode().lower()
        self.assertIn('cloture', msg)

        # Le statut reste CLOT, pas de changement
        commande.refresh_from_db()
        self.assertEqual(commande.status, 'CLOT')
