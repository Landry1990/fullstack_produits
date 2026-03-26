from django.test import TestCase
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from django.contrib.auth.models import User
from api.models import Facture
from rest_framework.test import APIClient

class StatsDiscrepancyTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='admin_test', first_name='Admin', last_name='System')
        # Profile is created by signal, just update it if needed
        self.user.profile.role = 'PHARMACIEN'
        self.user.profile.save()
        
        self.client.force_authenticate(user=self.user)
        
        # Create a sale at the very end of March
        # 2024-03-31 23:59:30
        self.boundary_date = timezone.make_aware(datetime(2024, 3, 31, 23, 59, 30))
        self.facture = Facture.objects.create(
            numero_facture="FAC-BND-TEST",
            total_ttc=Decimal('1000.00'),
            total_ht=Decimal('1000.00'),
            status=Facture.Status.VALIDEE,
            created_by=self.user
        )
        # Use update() to bypass auto_now_add
        Facture.objects.filter(id=self.facture.id).update(date=self.boundary_date)
        self.facture.refresh_from_db()

    def test_stats_vendeurs_includes_boundary_sale(self):
        # Range from 2024-03-01 to 2024-03-31 23:59
        # Previously this would exclude the sale at 23:59:30 because lt 23:59:00 (if seconds ignored)
        # BUT our new logic adds 1 minute to date_fin if it has time.
        # So date_fin becomes 2024-04-01 00:00:00 (or 2024-03-31 24:00:00)
        # It should now include the sale at 23:59:30.
        response = self.client.get('/api/rapports/stats_vendeurs/', {
            'date_debut': '2024-03-01T00:00:00',
            'date_fin': '2024-03-31T23:59:00'
        })
        self.assertEqual(response.status_code, 200)
        data = response.data
        
        # Check for admin
        admin_stats = next((item for item in data if item['vendeur'] == 'Admin System'), None)
        self.assertIsNotNone(admin_stats, f"Admin should be in the stats. Data: {data}")
        self.assertEqual(admin_stats['nbre_ventes'], 1, "Boundary sale should be counted")

    def test_classement_vendeurs_mensuel_includes_boundary_sale(self):
        # Month 2024-03
        response = self.client.get('/api/rapports/classement_vendeurs_mensuel/', {
            'mois': '2024-03'
        })
        self.assertEqual(response.status_code, 200)
        data = response.data['data']
        
        # Check for admin
        admin_stats = next((item for item in data if item['vendeur'] == 'Admin System'), None)
        self.assertIsNotNone(admin_stats, "Admin should be in the ranking")
        self.assertEqual(admin_stats['nbre_ventes'], 1, "Boundary sale should be counted in ranking")
