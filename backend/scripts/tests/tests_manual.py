import os
import django
import sys
from django.core.files.base import ContentFile

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory
from api.models import Rayon, Produit, Fournisseur
from api.views import CategorieViewSet

def test_pdf_generation():
    print("Testing PDF Generation for Rayon...")
    
    # create dummy data if needed
    try:
        rayon, _ = Rayon.objects.get_or_create(name="Test Rayon")
        fournisseur, _ = Fournisseur.objects.get_or_create(name="Test Fournisseur", email="test@test.com", phone="123456789")
        produit, _ = Produit.objects.get_or_create(
            rayon=rayon, 
            fournisseur=fournisseur,
            defaults={'selling_price': 100, 'cost_price': 50, 'stock': 10, 'pmp': 50}
        )
        
        factory = RequestFactory()
        request = factory.get(f'/api/categories/{rayon.id}/imprimer_etat_stock/', {'exclude_zero': 'true'})
        view = CategorieViewSet.as_view({'get': 'imprimer_etat_stock'})
        
        response = view(request, pk=rayon.id)
        
        if response.status_code == 200:
            print("SUCCESS: Endpoint returned 200 OK")
            
        # Test 2: Sans Rayon
        print("Testing PDF Generation for Sans Rayon...")
        produit2, _ = Produit.objects.get_or_create(
            name="Product No Rayon",
            rayon=None,
            defaults={'selling_price': 100, 'cost_price': 50, 'stock': 5, 'pmp': 50}
        )
        
        request2 = factory.get('/api/categories/imprimer_sans_rayon/', {'exclude_zero': 'false'})
        view2 = CategorieViewSet.as_view({'get': 'imprimer_sans_rayon'})
        response2 = view2(request2)
        
        if response2.status_code == 200:
             print("SUCCESS: Sans Rayon Endpoint returned 200 OK")
        else:
             print(f"FAILURE: Sans Rayon Endpoint returned {response2.status_code}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_pdf_generation()
