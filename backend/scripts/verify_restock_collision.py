
import os
import sys
import django
from decimal import Decimal

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth.models import User
from api.models import Produit, Facture, FactureProduit, Commande, CommandeProduit
from api.views.ventes import FactureViewSet
from api.views.commandes import CommandeViewSet

def run_test():
    print("=== STARTING AUTO-RESTOCK COLLISION TEST ===")
    
    # 1. Setup Data
    user = User.objects.filter(username='test_admin').first()
    if not user:
        user = User.objects.create_superuser(username='test_admin', password='password123', email='admin@test.com')
    else:
        user.is_superuser = True
        user.is_staff = True
        user.save()
    
    produit = Produit.objects.create(
        name='Stock Test Item', 
        stock=100, 
        cost_price=10.0,
        selling_price=15.0
    )
    
    factory = APIRequestFactory()
    
    # 2. First Sale -> Should create REASSORT_AUTO
    print("\n[Step 1] Performing first sale...")
    ventes_view = FactureViewSet.as_view({'post': 'finaliser'})
    
    sale_data = {
        'produits': [{'produit': produit.id, 'quantity': 5, 'selling_price': 15}],
        'paiements': [{'mode': 'ESPECES', 'montant': 75}],
    }
    
    request = factory.post('/api/ventes/finaliser/', sale_data, format='json')
    force_authenticate(request, user=user)
    response = ventes_view(request)
    
    assert response.status_code == 201, f"Sale failed: {response.data}"
    
    # Verify restock order exists
    restock_order = Commande.objects.filter(numero_facture='REASSORT_AUTO', status=Commande.Status.EN_PREPARATION).first()
    assert restock_order is not None, "REASSORT_AUTO order was not created"
    print(f" - Created restock order ID: {restock_order.id}")
    
    ligne = CommandeProduit.objects.get(commande=restock_order, produit=produit)
    assert ligne.quantity == 5, f"Expected quantity 5 in restock, found {ligne.quantity}"
    
    # 3. Close the order (Clôturer)
    print("\n[Step 2] Closing the restock order...")
    cmd_view = CommandeViewSet.as_view({'post': 'cloturer'})
    request_cloture = factory.post(f'/api/commandes/{restock_order.id}/cloturer/')
    force_authenticate(request_cloture, user=user)
    response_cloture = cmd_view(request_cloture, pk=restock_order.id)
    
    assert response_cloture.status_code == 200, f"Cloture failed: {response_cloture.data}"
    
    restock_order.refresh_from_db()
    assert restock_order.status == Commande.Status.CLOTUREE, "Order not closed"
    assert restock_order.numero_facture != 'REASSORT_AUTO', f"Old order still has REASSORT_AUTO name: {restock_order.numero_facture}"
    print(f" - Order renamed to: {restock_order.numero_facture}")
    
    # 4. Second Sale -> Should create a NEW REASSORT_AUTO
    print("\n[Step 3] Performing second sale...")
    request2 = factory.post('/api/ventes/finaliser/', sale_data, format='json')
    force_authenticate(request2, user=user)
    response2 = ventes_view(request2)
    
    assert response2.status_code == 201, f"Second sale failed: {response2.data}"
    
    new_restock = Commande.objects.filter(numero_facture='REASSORT_AUTO', status=Commande.Status.EN_PREPARATION).first()
    assert new_restock is not None, "New REASSORT_AUTO order was not created"
    assert new_restock.id != restock_order.id, "New restock order has same ID as old one?!"
    print(f" - NEW restock order ID: {new_restock.id}")
    
    ligne2 = CommandeProduit.objects.get(commande=new_restock, produit=produit)
    assert ligne2.quantity == 5, f"Expected quantity 5 in NEW restock, found {ligne2.quantity}"
    
    print("\n=== TEST PASSED SUCCESSFULLY ===")
    
    # Cleanup
    new_restock.delete()
    restock_order.delete()
    produit.delete()

if __name__ == '__main__':
    run_test()
