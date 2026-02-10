from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from rest_framework.test import APIClient
from rest_framework import status
from api.models import Facture, FactureProduit, Produit
from django.contrib.auth.models import User

class TemporalAnalysisTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create user and authenticate
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client.force_authenticate(user=self.user)
        
        # Create product
        self.produit = Produit.objects.create(
            name="Test Product",
            selling_price=1000,
            cost_price=800,
            stock=100
        )
        
        # Create sales data for testing
        today = timezone.now()
        
        # Helper to create invoice
        def create_facture(date_offset_days, hour, amount):
            date = today - timedelta(days=date_offset_days)
            date = date.replace(hour=hour, minute=0, second=0)
            
            facture = Facture.objects.create(
                status=Facture.Status.PAYEE,
                total_ttc=amount,
                created_by=self.user
            )
            # Force update date because auto_now_add=True ignores the date passed in create
            Facture.objects.filter(id=facture.id).update(date=date)
            
            FactureProduit.objects.create(
                facture=facture,
                produit=self.produit,
                quantity=1,
                selling_price=amount,
            )
            return facture

        # Create peak hour data (10am peak)
        create_facture(0, 10, 5000)
        create_facture(1, 10, 5000)
        create_facture(2, 14, 2000) # diff hour
        
        # Create daily comparison data (Monday vs Sunday)
        # Note: dates need to be adjusted based on actual day of week of execution
        # But we just check if data is returned mostly
        
    def test_peak_hours_endpoint(self):
        response = self.client.get('/api/temporal-analysis/peak_hours/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('data', data)
        self.assertIn('peak_hour', data)
        self.assertEqual(len(data['data']), 24) # 24 hours
        
        # check peak hour logic (should be 10h based on setup)
        peak_hour_data = next(d for d in data['data'] if d['hour'] == '10h')
        self.assertTrue(peak_hour_data['sales_count'] > 0)
        
    def test_daily_comparison_endpoint(self):
        response = self.client.get('/api/temporal-analysis/daily_comparison/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('data', data)
        self.assertIn('best_day', data)
        self.assertEqual(len(data['data']), 7) # 7 days
        
    def test_seasonality_endpoint(self):
        response = self.client.get('/api/temporal-analysis/seasonality/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('monthly_trends', data)
        self.assertIn('seasonal_products', data)
