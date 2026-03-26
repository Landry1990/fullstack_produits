from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from api.models import (
    RelationTransformation, Produit, StockLot, MouvementStock, StockAdjustment, HistoriqueTransformation
)
from api.tests.factories import TestDataFactory
from django.contrib.auth.models import User
from decimal import Decimal

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
