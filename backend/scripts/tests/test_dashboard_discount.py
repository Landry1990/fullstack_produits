from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from api.models import Client, Produit, Facture, FactureProduit, StockLot, Commande, CommandeProduit, Fournisseur
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

class DashboardDiscountTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.db_client = Client.objects.create(name="Test Client")
        self.produit = Produit.objects.create(
            name="Test Product", 
            selling_price=Decimal('100.00'),
            cost_price=Decimal('50.00'),
            stock=100
        )
        
        # Create necessary dependencies for StockLot
        self.fournisseur = Fournisseur.objects.create(name="Test Fournisseur")
        self.commande = Commande.objects.create(fournisseur=self.fournisseur, status="CLOT", date=timezone.now())
        self.commande_produit = CommandeProduit.objects.create(
            commande=self.commande,
            produit=self.produit,
            quantity=100,
            price=Decimal('50.00'), # Added price field
            price_cost=Decimal('50.00'),
            lot="LOT123",
            date_expiration=timezone.now() + timedelta(days=30)
        )
        
        self.stock_lot = StockLot.objects.create(
            produit=self.produit,
            commande_produit=self.commande_produit,
            fournisseur=self.fournisseur,
            quantity_initial=10,
            quantity_remaining=10,
            price_cost=Decimal('50.00'),
            selling_price=Decimal('100.00'),
            lot="LOT123",
            date_expiration=timezone.now() + timedelta(days=365),
            date_reception=timezone.now()
        )

    def test_dashboard_discount_calculation(self):
        # Create invoice
        facture = Facture.objects.create(
            client=self.db_client, 
            status="VAL",
            remise=Decimal('5.00') # Global discount
        )
        # Set date to noon to avoid timezone shifts at day boundaries in tests
        now = timezone.now()
        safe_date = now.replace(hour=12, minute=0, second=0, microsecond=0)
        facture.date = safe_date
        facture.save()
        
        print(f"Test Invoice Date: {facture.date}")
        print(f"Test Invoice Status: {facture.status}")
        print(f"Timezone Now Date: {now.date()}")
        print(f"Factures in DB: {Facture.objects.count()}")
        print(f"Factures with status VAL: {Facture.objects.filter(status='VAL').count()}")
        today = timezone.now().date()
        print(f"Factures with date {today}: {Facture.objects.filter(date__date=today).count()}")
        
        # Reproduce View Query
        from django.db.models import Sum, Count, F, Value, DecimalField, OuterRef, Subquery
        from django.db.models.functions import Coalesce
        
        qs = Facture.objects.filter(
            status__in=['VAL', 'PAY'],
            date__date=today
        )
        print(f"View Query Count: {qs.count()}")
        
        # Add product with line discount
        # Original Price: 100
        # Discount: 10% -> 10.00
        # Net Price: 90.00
        FactureProduit.objects.create(
            facture=facture,
            produit=self.produit,
            quantity=2,
            selling_price=Decimal('90.00'),
            discount=Decimal('10.00'), # 10.00 per unit
            stock_lot=self.stock_lot
        )
        
        # Expected Total Discount:
        # Global: 5.00
        # Line: 2 * 10.00 = 20.00
        # Total: 25.00
        
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        today_str = timezone.now().date().isoformat()
        
        # Find stats for today
        if today_str in data:
            stats = data[today_str]
        else:
            # Fallback if structure is flat (it shouldn't be based on code)
            stats = data
            
        print(f"Stats Data: {data}")
        
        # Check discount
        # The view returns a dict { 'revenue': { 'value': ... }, 'discount': { 'value': ... } }
        
        self.assertIn('discount', data)
        discount_data = data['discount']
        
        # Expected: 25.00
        # Received might be float or Decimal string
        self.assertEqual(float(discount_data['value']), 25.0)
        print("Discount verification passed!")
