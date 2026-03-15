import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from django.contrib.auth.models import User
from api.models import Commande, CommandeProduit, Produit
from api.views.commandes import CommandeViewSet

def test_retrieve_reassort_auto():
    # 1. Get a superuser
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser('admin_repro', 'admin@repro.com', 'pwd_repro')

    import time
    unique_suffix = int(time.time())
    order = Commande.objects.create(
        numero_facture=f'REASSORT_REPRO_{unique_suffix}',
        fournisseur=None,
        status=Commande.Status.EN_PREPARATION,
        type=Commande.Type.LOCALE
    )
    
    # 3. Add a product
    prod = Produit.objects.create(name="Repro Prod", cost_price=200, selling_price=300)
    CommandeProduit.objects.create(
        commande=order,
        produit=prod,
        quantity=10,
        price=200,
        price_cost=200
    )

    print(f"Created order ID: {order.id} with fournisseur=None")

    # 4. Test retrieve via ViewSet
    factory = RequestFactory()
    view = CommandeViewSet.as_view({'get': 'retrieve'})
    request = factory.get(f'/api/commandes/{order.id}/')
    force_authenticate(request, user=user)
    
    try:
        response = view(request, pk=order.id)
        print(f"Retrieve Status: {response.status_code}")
        if response.status_code == 200:
            print("SUCCESS: Order retrieved successfully")
        else:
            print(f"FAILURE: {response.data}")
            
        # 5. Test update (adding a field or changing status)
        view_update = CommandeViewSet.as_view({'patch': 'partial_update'})
        request_update = factory.patch(f'/api/commandes/{order.id}/', data={'status': 'ATT'}, content_type='application/json')
        force_authenticate(request_update, user=user)
        response_update = view_update(request_update, pk=order.id)
        print(f"Update Status (Patch status to ATT): {response_update.status_code}")
        if response_update.status_code == 200:
            print("SUCCESS: Order updated successfully")
        else:
            print(f"FAILURE: {response_update.data}")

    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_retrieve_reassort_auto()
