import os
import sys
import django

# Add backend to path so we can import api and backend.settings
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit, AuditLog, StockAdjustment
from api.views.produits import ProduitViewSet
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth.models import User

def verify():
    print("Starting verification...")
    # 1. Setup User and Product
    user, created = User.objects.get_or_create(username='test_admin', defaults={'is_superuser': True})
    produit = Produit.objects.first()
    if not produit:
        print("No product found to test.")
        return

    print(f"Testing with Product: {produit.name} (ID: {produit.id})")
    
    # 2. Prepare Request
    factory = APIRequestFactory()
    new_qty = produit.stock + 1
    data = {
        'new_quantity': new_qty,
        'reason_type': 'INVENTAIRE',
        'reason_detail': 'Test Audit Log Nom'
    }
    
    request = factory.post(f'/api/produits/{produit.id}/adjust_stock/', data, format='json')
    force_authenticate(request, user=user)
    
    # 3. Call View
    view = ProduitViewSet.as_view({'post': 'adjust_stock'})
    response = view(request, pk=produit.id)
    
    if response.status_code != 200:
        print(f"Error adjusting stock: {response.data}")
        return

    print("Stock adjustment successful.")

    # 4. Verify Audit Log
    latest_log = AuditLog.objects.filter(
        model_name='Produit', 
        object_id=str(produit.id)
    ).latest('timestamp')
    
    print(f"Latest Log Action: {latest_log.action}")
    print(f"Latest Log Details: {latest_log.details}")
    
    if latest_log.details and 'produit_nom' in latest_log.details:
        print("SUCCESS: 'produit_nom' found in details.")
        print(f"Product Name in Log: {latest_log.details['produit_nom']}")
    elif latest_log.details and 'produit_name' in latest_log.details:
        print("SUCCESS: 'produit_name' found in details.")
        print(f"Product Name in Log: {latest_log.details['produit_name']}")
    else:
        print("FAILURE: Product name NOT found in details.")

if __name__ == "__main__":
    verify()
