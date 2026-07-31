
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    HistoriqueTransformation,
    RelationTransformation,
    StockAdjustment,
    StockLot,
)
from api.tests.factories import TestDataFactory


class StockTransformationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_trans', email='admin_trans@test.com', password='password')
        self.client.force_authenticate(user=self.user)
        
        # Source: Boîte de 10
        self.source = self.factory.create_produit(name="Source Box", stock=10, use_lot_management=True)
        self.lot_source = self.factory.create_stock_lot(produit=self.source, quantity=10, lot_name="LOT-S1")
        
        # Destination: Plaquette
        self.dest = self.factory.create_produit(name="Dest Plate", stock=0, use_lot_management=True)
        
        # Relation: 1 Source -> 10 Dest (Ratio 10)
        self.relation = RelationTransformation.objects.create(
            produit_source=self.source,
            produit_destination=self.dest,
            ratio=10
        )

    def test_transformation_success_with_lots(self):
        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        data = {'quantite': 2} # Transform 2 boxes into 20 plates
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check stock updates
        self.source.refresh_from_db()
        self.dest.refresh_from_db()
        self.assertEqual(self.source.stock, 8)
        self.assertEqual(self.dest.stock, 20)
        
        # Check lot updates
        self.lot_source.refresh_from_db()
        self.assertEqual(self.lot_source.quantity_remaining, 8)
        
        dest_lot = StockLot.objects.get(produit=self.dest, lot="LOT-S1")
        self.assertEqual(dest_lot.quantity_remaining, 20)
        
        # Check traceability
        self.assertTrue(HistoriqueTransformation.objects.filter(relation=self.relation).exists())
        self.assertTrue(StockAdjustment.objects.filter(produit=self.source, quantity_change=-2).exists())
        self.assertTrue(StockAdjustment.objects.filter(produit=self.dest, quantity_change=20).exists())

    def test_transformation_insufficient_stock(self):
        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        data = {'quantite': 50} # Only 10 in stock
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('insuffisant', response.data['error'])

    def test_transformation_invalid_quantity(self):
        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        data = {'quantite': -1}
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def _do_transformation(self, quantite=2):
        """Helper: effectue une transformation et retourne l'entrée d'historique."""
        url = reverse('relationtransformation-transformer', args=[self.relation.id])
        response = self.client.post(url, {'quantite': quantite})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return HistoriqueTransformation.objects.filter(relation=self.relation).first()

    def test_reverser_success_with_lots(self):
        """Annulation d'une transformation avec gestion par lots : stock et lots restitués."""
        hist = self._do_transformation(quantite=2)

        # État après transformation : source=8, dest=20
        self.source.refresh_from_db()
        self.dest.refresh_from_db()
        self.assertEqual(self.source.stock, 8)
        self.assertEqual(self.dest.stock, 20)

        # Annulation
        url = reverse('historiquetransformation-reverser', args=[hist.id])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Stock restitué : source revient à 10, dest revient à 0
        self.source.refresh_from_db()
        self.dest.refresh_from_db()
        self.assertEqual(self.source.stock, 10)
        self.assertEqual(self.dest.stock, 0)

        # L'entrée originale est marquée reversed=True
        hist.refresh_from_db()
        self.assertTrue(hist.reversed)

        # Une nouvelle entrée d'historique (l'annulation) existe
        reversal = HistoriqueTransformation.objects.get(reversed_by=hist)
        self.assertEqual(reversal.quantite_source, 20)  # dest qty consommée
        self.assertEqual(reversal.quantite_destination, 2)  # source qty restituée
        self.assertEqual(reversal.reversed_by, hist)  # pointe vers l'original
        self.assertFalse(reversal.reversed)  # l'annulation n'est pas elle-même annulée

    def test_reverser_double_reversal_blocked(self):
        """On ne peut pas annuler une transformation déjà annulée."""
        hist = self._do_transformation(quantite=1)

        url = reverse('historiquetransformation-reverser', args=[hist.id])
        # Première annulation OK
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Deuxième annulation doit échouer
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('déjà', response.data['error'])

    def test_reverser_reversal_entry_not_reversible(self):
        """Une entrée d'annulation ne peut pas être annulée."""
        hist = self._do_transformation(quantite=1)

        url = reverse('historiquetransformation-reverser', args=[hist.id])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Récupérer l'entrée d'annulation
        reversal = HistoriqueTransformation.objects.get(reversed_by=hist)
        url_rev = reverse('historiquetransformation-reverser', args=[reversal.id])
        response = self.client.post(url_rev, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('annulation', response.data['error'])

    def test_reverser_insufficient_destination_stock(self):
        """L'annulation échoue si le stock destination est insuffisant."""
        hist = self._do_transformation(quantite=2)

        # Simuler une vente qui vide le stock destination
        self.dest.refresh_from_db()
        self.dest.stock = 5  # moins que les 20 à reprendre
        self.dest.save(update_fields=['stock'])

        url = reverse('historiquetransformation-reverser', args=[hist.id])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('insuffisant', response.data['error'])

        # L'original ne doit pas être marqué reversed
        hist.refresh_from_db()
        self.assertFalse(hist.reversed)

    def test_reverser_without_lots(self):
        """Annulation d'une transformation sans gestion par lots."""
        # Créer des produits sans lot
        source_nl = self.factory.create_produit(name="Source NoLot", stock=5, use_lot_management=False)
        dest_nl = self.factory.create_produit(name="Dest NoLot", stock=0, use_lot_management=False)
        relation_nl = RelationTransformation.objects.create(
            produit_source=source_nl,
            produit_destination=dest_nl,
            ratio=3
        )

        # Transformer 2 source -> 6 destination
        url = reverse('relationtransformation-transformer', args=[relation_nl.id])
        response = self.client.post(url, {'quantite': 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        source_nl.refresh_from_db()
        dest_nl.refresh_from_db()
        self.assertEqual(source_nl.stock, 3)
        self.assertEqual(dest_nl.stock, 6)

        # Annuler
        hist = HistoriqueTransformation.objects.filter(relation=relation_nl).first()
        url_rev = reverse('historiquetransformation-reverser', args=[hist.id])
        response = self.client.post(url_rev, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        source_nl.refresh_from_db()
        dest_nl.refresh_from_db()
        self.assertEqual(source_nl.stock, 5)  # restitué
        self.assertEqual(dest_nl.stock, 0)   # consommé

    def test_reverser_creates_stock_movements(self):
        """L'annulation crée des mouvements de stock de type TRANSFORMATION."""
        from api.models import MouvementStock
        hist = self._do_transformation(quantite=1)

        url = reverse('historiquetransformation-reverser', args=[hist.id])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 2 mouvements de sortie + 2 d'entrée pour la transformation + l'annulation
        movements = MouvementStock.objects.filter(
            type_mouvement__in=[
                MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
                MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
            ]
        )
        # 2 (transformation) + 2 (annulation) = 4
        self.assertEqual(movements.count(), 4)

        # L'annulation a une sortie sur le dest et une entrée sur le source
        reversal_movements = movements.filter(description__icontains='Annulation')
        self.assertEqual(reversal_movements.count(), 2)
        # Une sortie sur dest, une entrée sur source
        self.assertTrue(reversal_movements.filter(
            produit=self.dest,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE
        ).exists())
        self.assertTrue(reversal_movements.filter(
            produit=self.source,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE
        ).exists())
