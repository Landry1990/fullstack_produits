import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from api.models import Facture, Produit
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

@pytest.mark.django_db
class TestRapportModular:
    def setup_method(self):
        self.client = APIClient()
        from django.contrib.auth.models import User
        self.user = User.objects.create_superuser(username='admin_test', email='test@test.com', password='password')
        self.client.force_authenticate(user=self.user)

    def test_valeur_stock_journalier(self):
        # Smoke test for stock value endpoint
        url = reverse('rapports-valeur-stock-journalier')
        now = timezone.now().date()
        date_debut = (now - timedelta(days=7)).isoformat()
        date_fin = now.isoformat()
        
        response = self.client.get(url, {'date_debut': date_debut, 'date_fin': date_fin})
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_stats_vendeurs(self):
        url = reverse('rapports-stats-vendeurs')
        now = timezone.now()
        date_debut = (now - timedelta(days=1)).isoformat()
        date_fin = now.isoformat()
        response = self.client.get(url, {'date_debut': date_debut, 'date_fin': date_fin})
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_meilleurs_clients(self):
        url = reverse('rapports-meilleurs-clients')
        now = timezone.now()
        date_debut = (now - timedelta(days=30)).isoformat()
        date_fin = now.isoformat()
        response = self.client.get(url, {'date_debut': date_debut, 'date_fin': date_fin})
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_rapport_mensuel(self):
        url = reverse('rapports-rapport-mensuel')
        now = timezone.now()
        mois = now.strftime('%Y-%m')
        response = self.client.get(url, {'mois': mois})
        assert response.status_code == 200
        assert 'ca' in response.data
