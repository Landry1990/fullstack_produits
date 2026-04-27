import pytest
import json
from django.urls import reverse
from rest_framework.test import APIClient
from api.models.products import Produit
from django.utils import timezone
from datetime import timedelta, time, datetime

@pytest.mark.django_db
class TestRapportDynamiqueRobustness:
    def setup_method(self):
        self.client = APIClient()
        from django.contrib.auth.models import User
        self.user = User.objects.create_superuser(username='admin_test', email='test@test.com', password='password')
        self.client.force_authenticate(user=self.user)
        
        # Create a dummy product
        self.prod = Produit.objects.create(
            name="Test Robustness",
            stock=15,
            selling_price=100.0,
            cost_price=50.0,
            pmp=50.0,
            tva=20.0
        )

    def test_rapport_produits_with_extra_fields(self):
        url = reverse('rapports-rapport-dynamique')
        params = {
            'source': 'produits',
            'date_debut': timezone.now().date().isoformat(),
            'date_fin': timezone.now().date().isoformat(),
            'fields': 'produit,quantite,tva,rayon,pourcentage_marge,cip'
        }
        response = self.client.get(url, params)
        assert response.status_code == 200
        data = response.data
        assert len(data) >= 1
        row = data[0]
        assert 'Produit' in row
        assert 'TVA (%)' in row
        assert 'Marge (%)' in row
        assert row['TVA (%)'] == 20.0

    def test_rapport_produits_with_conditions(self):
        url = reverse('rapports-rapport-dynamique')
        
        # Condition: Stock >= 10 (should match)
        conds = [
            {'field': 'quantite', 'operator': 'gte', 'value': '10'}
        ]
        params = {
            'source': 'produits',
            'date_debut': timezone.now().date().isoformat(),
            'date_fin': timezone.now().date().isoformat(),
            'fields': 'produit,quantite',
            'conditions': json.dumps(conds)
        }
        response = self.client.get(url, params)
        assert response.status_code == 200
        assert len(response.data) >= 1
        
        # Condition: Stock < 10 (should NOT match)
        conds = [
            {'field': 'quantite', 'operator': 'lt', 'value': '10'}
        ]
        params['conditions'] = json.dumps(conds)
        response = self.client.get(url, params)
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_invalid_json_conditions(self):
        url = reverse('rapports-rapport-dynamique')
        params = {
            'source': 'produits',
            'date_debut': timezone.now().date().isoformat(),
            'date_fin': timezone.now().date().isoformat(),
            'conditions': 'invalid_json'
        }
        # Should not crash, just ignore conditions
        response = self.client.get(url, params)
        assert response.status_code == 200

    def test_unknown_source(self):
        url = reverse('rapports-rapport-dynamique')
        params = {
            'source': 'unknown_source',
            'date_debut': timezone.now().date().isoformat(),
            'date_fin': timezone.now().date().isoformat()
        }
        response = self.client.get(url, params)
        assert response.status_code == 400
        assert "Source inconnue" in response.data['error']

    def test_rapport_produits_with_margin_filter(self):
        url = reverse('rapports-rapport-dynamique')
        # Dummy prod has selling_price=100, cost=50 => margin=50%
        conds = [
            {'field': 'pourcentage_marge', 'operator': 'lt', 'value': '25'}
        ]
        params = {
            'source': 'produits',
            'date_debut': timezone.now().date().isoformat(),
            'date_fin': timezone.now().date().isoformat(),
            'fields': 'produit,quantite,pourcentage_marge',
            'conditions': json.dumps(conds)
        }
        response = self.client.get(url, params)
        assert response.status_code == 200
        assert len(response.data) == 0

        # Condition: Marge (%) > 25 (should match)
        conds[0]['operator'] = 'gt'
        params['conditions'] = json.dumps(conds)
        response = self.client.get(url, params)
        assert response.status_code == 200
        assert len(response.data) >= 1
