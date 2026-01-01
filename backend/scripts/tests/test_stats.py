import os
import django
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import FactureProduitAllocation, Facture
from api.views import StatistiquesViewSet
from rest_framework.test import APIRequestFactory

def test_stats():
    print("--- TEST STATISTIQUES ---")
    
    # 1. Vérifier les allocations existantes
    alloc_count = FactureProduitAllocation.objects.count()
    print(f"Nombre total d'allocations en base: {alloc_count}")
    
    if alloc_count > 0:
        last_alloc = FactureProduitAllocation.objects.last()
        print(f"Dernière allocation: Date={last_alloc.created_at}, Qte={last_alloc.quantity}, Fournisseur={last_alloc.stock_lot.fournisseur.name}")
        print(f"Facture associée: ID={last_alloc.facture_produit.facture.id}, Date={last_alloc.facture_produit.facture.date}, Status={last_alloc.facture_produit.facture.status}")

    # 2. Simuler appel API
    today = timezone.now().date()
    date_debut = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    date_fin = today.strftime('%Y-%m-%d')
    
    print(f"\nTest appel API avec Période: {date_debut} au {date_fin}")
    
    view = StatistiquesViewSet()
    factory = APIRequestFactory()
    request = factory.get(f'/api/statistiques/ca_par_fournisseur/?date_debut={date_debut}&date_fin={date_fin}')
    
    # Simuler l'utilisateur authentifié (si nécessaire, mais ici on appelle la méthode directement)
    # view.request = request # Pas suffisant pour viewsets
    
    # Appel direct de la méthode (bypass DRF request wrapping complet)
    # On doit mocker request.query_params car c'est ce que la vue utilise
    class MockRequest:
        query_params = {'date_debut': date_debut, 'date_fin': date_fin}
        
    response = view.ca_par_fournisseur(MockRequest())
    
    print(f"Status Code: {response.status_code}")
    print("Données retournées:")
    print(response.data)

if __name__ == "__main__":
    test_stats()
