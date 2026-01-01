
import os
import django
import sys
import json
from decimal import Decimal

# Setup Django environment
sys.path.append('c:/Projet Fullstack/fullstack_produits/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth.models import User
from api.models import Client, Produit, Facture, FactureProduit, StockLot, Commande
from api.views import FactureViewSet, FactureProduitViewSet, CaisseViewSet
from api.serializers import FactureSerializer

def run_test():
    print("--- Starting Invoice Flow Test ---")
    
    # Cleanup potentially conflicting data
    import random
    suffix = random.randint(1000, 9999)
    try:
        # Cannot delete easily without knowing IDs, but uniqueness is on Name/Phone unique constraints usually
        pass 
    except:
        pass
    
    # 1. Setup Data
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT setval(pg_get_serial_sequence('api_stocklot', 'id'), coalesce(max(id), 0) + 1, false) FROM api_stocklot;")
        cursor.execute("SELECT setval(pg_get_serial_sequence('api_client', 'id'), coalesce(max(id), 0) + 1, false) FROM api_client;")
        cursor.execute("SELECT setval(pg_get_serial_sequence('api_produit', 'id'), coalesce(max(id), 0) + 1, false) FROM api_produit;")
        cursor.execute("SELECT setval(pg_get_serial_sequence('api_fournisseur', 'id'), coalesce(max(id), 0) + 1, false) FROM api_fournisseur;")
        cursor.execute("SELECT setval(pg_get_serial_sequence('api_commande', 'id'), coalesce(max(id), 0) + 1, false) FROM api_commande;")
        cursor.execute("SELECT setval(pg_get_serial_sequence('api_commandeproduit', 'id'), coalesce(max(id), 0) + 1, false) FROM api_commandeproduit;")

    user, _ = User.objects.get_or_create(username='test_admin', defaults={'email': 'admin@test.com', 'is_superuser': True, 'is_staff': True})
    import random
    suffix = random.randint(1000, 9999)
    client, _ = Client.objects.get_or_create(name=f"Test Client {suffix}", defaults={'address': 'Test Address', 'phone': f'12345{suffix}', 'email': f'client{suffix}@test.com'})
    product, _ = Produit.objects.get_or_create(name=f"Test Product {suffix}", defaults={'selling_price': 1000, 'cost_price': 500, 'stock': 100, 'pmp': 500})
    
    # Ensure stock is positive
    product.stock = 100
    product.save()
    
    from api.models import Fournisseur, Commande, CommandeProduit
    import datetime
    
    supplier, _ = Fournisseur.objects.get_or_create(name=f"Test Supplier {suffix}", defaults={'email': f'supp{suffix}@test.com', 'phone': f'98765{suffix}'})

    # Create Reception Command
    cmd, _ = Commande.objects.get_or_create(
        numero_facture=f"CMD-REC-{suffix}",
        defaults={
            'fournisseur': supplier,
            'status': Commande.Status.CLOTUREE,
            'date': datetime.datetime.now()
        }
    )
    
    # Create Command Product
    cmd_prod, _ = CommandeProduit.objects.get_or_create(
        commande=cmd,
        produit=product,
        defaults={
            'quantity': 100,
            'price': 500,
            'price_cost': 500,
            'selling_price': 1000
        }
    )

    # Create StockLot
    StockLot.objects.get_or_create(
        produit=product,
        lot=f"LOT-TEST-{suffix}",
        defaults={
            'commande_produit': cmd_prod,
            'fournisseur': supplier,
            'quantity_initial': 100,
            'quantity_remaining': 100,
            'price_cost': 500,
            'selling_price': 1000,
            'date_reception': '2024-01-01'
        }
    )
    # Fix StockLot creation if Fournisseur is required (it is protected, so likely required)
    # Actually StockLot.fournisseur is PROTECT, so not nullable by default in Django unless null=True.
    # Checking models.py: fournisseur = models.ForeignKey('Fournisseur', on_delete=models.PROTECT) -> Required!
    
    from rest_framework.test import APIClient
    client_api = APIClient()
    client_api.force_authenticate(user=user)
    
    # 2. Simulate Create Facture (Draft)
    data = {
        'client': client.id,
        'remise': '0',
        'tva': '0'
    }
    response = client_api.post('/api/factures/', data, format='json')
    
    if response.status_code != 201:
        print(f"FAILED: Create Facture returned {response.status_code}")
        print(response.data)
        return
        
    facture_id = response.data['id']
    print(f"SUCCESS: Created Facture {facture_id}")
    
    # 3. Add Product
    data_prod = {
        'facture': facture_id,
        'produit': product.id,
        'quantity': 1,
        'selling_price': '1000'
    }
    
    response_prod = client_api.post('/api/facture-produits/', data_prod, format='json')
    if response_prod.status_code != 201:
        print(f"FAILED: Add Product returned {response_prod.status_code}")
        print(response_prod.data)
        return
    print("SUCCESS: Added Product to Facture")
    
    # 4. Validate Facture
    data_val = {
        'use_pending_discount': False,
        'points_to_use': 0
    }
    
    try:
        response_val = client_api.post(f'/api/factures/{facture_id}/valider/', data_val, format='json')
        if response_val.status_code != 200:
            print(f"FAILED: Validate Facture returned {response_val.status_code}")
            print(response_val.data)
            
            # Check for current debt limit issue
            if 'plafond' in str(response_val.data):
                print("NOTE: Hit credit limit check")
            return
        
        print("SUCCESS: Validated Facture")
        print("Status:", response_val.data['status'])
        
    except Exception as e:
        print(f"CRASH: Validation crashed with {e}")
        import traceback
        traceback.print_exc()
        return

    # 5. Check if REASSORT_AUTO exists and was updated (Signal check)
    try:
        cmd = Commande.objects.get(numero_facture='REASSORT_AUTO', status='PREP')
        print(f"SUCCESS: REASSORT_AUTO command found with ID {cmd.id}")
        # Check products
        lines = cmd.produits.filter(produit=product)
        if lines.exists():
             print(f"SUCCESS: Product found in REASSORT_AUTO with qty {lines.first().quantity}")
        else:
             print("FAILURE: Product NOT found in REASSORT_AUTO")
    except Commande.DoesNotExist:
        print("WARNING: REASSORT_AUTO command not found (Signal might not have run or failed)")

def force_auth(request, user):
    request.user = user
    from rest_framework.test import force_authenticate
    force_authenticate(request, user=user)

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"Global Error: {e}")
