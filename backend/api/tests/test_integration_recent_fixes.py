from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from api.models import AuditLog, Produit
from .factories import TestDataFactory

class RecentFixesIntegrationTest(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

    def test_cancel_alerts_endpoint_works(self):
        """Verify that the cancel_alerts endpoint (StatistiquesViewSet) works and returns correct data."""
        # Create some cancellations in AuditLog
        AuditLog.objects.create(
            user=self.user,
            action=AuditLog.Action.INVOICE_CANCEL,
            model_name='Facture',
            object_id='1',
            description='Test cancel'
        )
        AuditLog.objects.create(
            user=self.user,
            action=AuditLog.Action.INVOICE_CANCEL,
            model_name='Facture',
            object_id='2',
            description='Test cancel 2'
        )

        url = reverse('statistiques-cancel-alerts')
        # Test with threshold=1 to ensure we get results
        response = self.client.get(url, {'threshold': 1, 'days': 30})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['Nombre Annulations'], 2)
        self.assertEqual(response.data[0]['Utilisateur'], self.user.get_full_name() or self.user.username)

    def test_stock_alerts_refined_logic(self):
        """Verify that stock_alerts only returns relevant products."""
        f = TestDataFactory.create_fournisseur()
        # 1. Product with stock < rotation (Alert)
        TestDataFactory.create_produit(name='Alert Rotation', stock=5, rotation_moyenne=10, stock_minimum=0, fournisseur=f)
        
        # 2. Product with stock <= stock_minimum (Alert)
        TestDataFactory.create_produit(name='Alert Minimum', stock=2, rotation_moyenne=0, stock_minimum=5, fournisseur=f)
        
        # 3. Product with negative stock (Alert)
        TestDataFactory.create_produit(name='Alert Negative', stock=-1, rotation_moyenne=0, stock_minimum=0, fournisseur=f)

        # 4. Product with zero stock but zero rotation and zero minimum (NO Alert)
        TestDataFactory.create_produit(name='No Alert Passive', stock=0, rotation_moyenne=0, stock_minimum=0, fournisseur=f)

        # 5. Product with stock > rotation and > minimum (NO Alert)
        TestDataFactory.create_produit(name='No Alert Healthy', stock=100, rotation_moyenne=10, stock_minimum=10, fournisseur=f)
        
        # 6. Inactive product meeting alert criteria (NO Alert)
        TestDataFactory.create_produit(name='No Alert Inactive', stock=0, rotation_moyenne=10, is_active=False, fournisseur=f)

        url = reverse('produit-stock-alerts')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [p['nom_produit'] for p in response.data]
        
        self.assertIn('Alert Rotation', names)
        self.assertIn('Alert Minimum', names)
        self.assertIn('Alert Negative', names)
        
        self.assertNotIn('No Alert Passive', names)
        self.assertNotIn('No Alert Healthy', names)
        self.assertNotIn('No Alert Inactive', names)
        self.assertEqual(len(names), 3)
