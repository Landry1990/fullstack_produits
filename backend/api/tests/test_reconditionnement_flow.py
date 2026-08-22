"""
Tests pour le flux de reconditionnement (transformation) apres clôture de commande.

Couvre :
- Clôture d'une commande puis transformation -> HistoriqueTransformation cree.
- Transformation cree un MouvementStock de type TRANSFORMATION.
- Transformation bloquee si le stock source est insuffisant.
- Transformation decremente le stock source et incremente le stock cible.
"""
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Commande,
    HistoriqueTransformation,
    MouvementStock,
    RelationTransformation,
    StockLot,
)
from .factories import TestDataFactory


class ReconditionnementFlowTestCase(APITestCase):
    """Tests du flux complet : clôture commande -> transformation / reconditionnement."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

        self.fournisseur = TestDataFactory.create_fournisseur(name='Grossiste Recond')
        self.rayon = TestDataFactory.create_rayon(name='Rayon Recond')

        # Produit source : boite (gere par lots)
        self.produit_source = TestDataFactory.create_produit(
            name='Paracetamol Boite 100',
            stock=0,
            cost_price=1000,
            selling_price=1500,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
            use_lot_management=True,
        )

        # Produit destination : detail (gere par lots)
        self.produit_dest = TestDataFactory.create_produit(
            name='Paracetamol Detail 10',
            stock=0,
            cost_price=100,
            selling_price=150,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
            use_lot_management=True,
        )

        # Relation de transformation : 1 boite -> 10 details
        self.relation = RelationTransformation.objects.create(
            produit_source=self.produit_source,
            produit_destination=self.produit_dest,
            ratio=Decimal('10'),
            actif=True,
        )

    def _cloturer_commande_avec_source(self, quantity=5):
        """Helper : cree et cloture une commande apportant du stock au produit source."""
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='PREP',
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit_source,
            quantity=quantity,
            price=1000,
            price_cost=1000,
        )
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        commande.refresh_from_db()
        self.produit_source.refresh_from_db()
        return commande

    def test_cloture_puis_transformation_cree_historique(self):
        """Cloturer une commande -> appeler la transformation -> HistoriqueTransformation cree."""
        commande = self._cloturer_commande_avec_source(quantity=5)
        self.assertEqual(commande.status, 'CLOT')
        self.assertGreater(self.produit_source.stock, 0)

        # Aucun historique avant transformation
        self.assertEqual(
            HistoriqueTransformation.objects.filter(relation=self.relation).count(), 0
        )

        # Transformer 2 boites -> 20 details
        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        response = self.client.post(url, {'quantite': 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        # Un HistoriqueTransformation est cree
        hist = HistoriqueTransformation.objects.filter(relation=self.relation).first()
        self.assertIsNotNone(hist)
        self.assertEqual(hist.quantite_source, 2)
        self.assertEqual(hist.quantite_destination, 20)

    def test_transformation_cree_mouvement_stock_transformation(self):
        """La transformation cree un MouvementStock de type TRANSFORMATION (sortie + entree)."""
        self._cloturer_commande_avec_source(quantity=5)

        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        response = self.client.post(url, {'quantite': 1})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        # Mouvement de sortie sur le produit source
        mvt_sortie = MouvementStock.objects.filter(
            produit=self.produit_source,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
        )
        self.assertTrue(mvt_sortie.exists())
        self.assertEqual(mvt_sortie.first().quantite, -1)

        # Mouvement d'entree sur le produit destination
        mvt_entree = MouvementStock.objects.filter(
            produit=self.produit_dest,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
        )
        self.assertTrue(mvt_entree.exists())
        self.assertEqual(mvt_entree.first().quantite, 10)

    def test_transformation_bloquee_si_stock_source_insuffisant(self):
        """La transformation est bloquee si le stock source est insuffisant."""
        self._cloturer_commande_avec_source(quantity=3)
        stock_initial = self.produit_source.stock
        self.assertEqual(stock_initial, 3)

        # Tenter de transformer 10 boites alors qu'on n'en a que 3
        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        response = self.client.post(url, {'quantite': 10})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('insuffisant', str(response.data).lower())

        # Aucun historique cree, stock inchange
        self.assertEqual(
            HistoriqueTransformation.objects.filter(relation=self.relation).count(), 0
        )
        self.produit_source.refresh_from_db()
        self.assertEqual(self.produit_source.stock, stock_initial)

    def test_transformation_decremente_source_et_incremente_cible(self):
        """La transformation decremente le stock source et incremente le stock cible."""
        self._cloturer_commande_avec_source(quantity=5)
        stock_source_avant = self.produit_source.stock
        stock_dest_avant = self.produit_dest.stock

        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        response = self.client.post(url, {'quantite': 3})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.produit_source.refresh_from_db()
        self.produit_dest.refresh_from_db()

        # Source : -3
        self.assertEqual(self.produit_source.stock, stock_source_avant - 3)
        # Destination : +30 (3 boites x ratio 10)
        self.assertEqual(self.produit_dest.stock, stock_dest_avant + 30)
