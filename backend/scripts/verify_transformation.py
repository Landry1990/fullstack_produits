
import os
import sys
import django
from datetime import timedelta
from decimal import Decimal

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth.models import User
from django.db.models import Sum
from api.models import Produit, StockLot, RelationTransformation, Fournisseur
from api.views.stocks import RelationTransformationViewSet

def run_test():
    print("=== STARTING TRANSFORMATION TEST ===")
    
    # 1. Setup Data
    user, _ = User.objects.get_or_create(username='test_admin')
    fournisseur, _ = Fournisseur.objects.get_or_create(name='Test Supplier')
    
    # Source Product (Managed by Lot)
    source = Produit.objects.create(
        name='Source Product', 
        stock=20, 
        cost_price=10.0,
        selling_price=15.0,
        use_lot_management=True,
        fournisseur=fournisseur
    )
    
    # Source Lots (FIFO setup)
    # Lot 1: Expire demain (Doit être pris en premier)
    lot1 = StockLot.objects.create(
        produit=source, lot='LOT-OLD', 
        quantity_initial=10, quantity_remaining=10,
        date_expiration=timezone.now().date() + timedelta(days=1),
        date_reception=timezone.now() - timedelta(days=5),
        fournisseur=fournisseur, price_cost=10.0
    )
    
    # Lot 2: Expire dans 1 mois
    lot2 = StockLot.objects.create(
        produit=source, lot='LOT-NEW', 
        quantity_initial=10, quantity_remaining=10,
        date_expiration=timezone.now().date() + timedelta(days=30),
        date_reception=timezone.now(),
        fournisseur=fournisseur, price_cost=10.0
    )
    
    # Destination Product (Managed by Lot)
    dest = Produit.objects.create(
        name='Dest Product', 
        stock=0, 
        cost_price=2.0, # Ratio 5:1 approx value
        selling_price=3.0,
        use_lot_management=True,
        fournisseur=fournisseur
    )
    
    # Relation (1 Source = 5 Dest)
    relation = RelationTransformation.objects.create(
        produit_source=source,
        produit_destination=dest,
        ratio=5.0
    )
    
    # Manually fix stock before test
    total_lots = StockLot.objects.filter(produit=source).aggregate(t=Sum('quantity_remaining'))['t'] or 0
    Produit.objects.filter(pk=source.pk).update(stock=total_lots)
    
    source.refresh_from_db()
    print(f"INITIAL STATE (DB Refreshed, Fixed):")
    print(f"Source: {source.stock}")
    print(f"Lots in DB: {StockLot.objects.filter(produit=source).count()}")
    for l in StockLot.objects.filter(produit=source):
        print(f" - Lot {l.lot}: qty={l.quantity_remaining}")
    
    # 2. Execute Transformation
    # Transform 15 units of Source
    # Expectation: 
    #   - Consume 10 from Lot1 (Empty)
    #   - Consume 5 from Lot2 (Remain 5)
    #   - Create Dest Lot with 15 * 5 = 75 units
    
    factory = APIRequestFactory()
    view = RelationTransformationViewSet.as_view({'post': 'transformer'})
    
    request = factory.post(f'/api/relations-transformation/{relation.id}/transformer/', {'quantite': 15, 'notes': 'Test Auto'}, format='json')
    force_authenticate(request, user=user)
    
    print("\n>>> EXECUTING TRANSFORMATION (Qty: 15)...")
    response = view(request, pk=relation.id)
    
    print(f"Response: {response.status_code}")
    if response.status_code != 200:
        print(response.data)
        return

    # 3. Validation
    source.refresh_from_db()
    dest.refresh_from_db()
    lot1.refresh_from_db()
    lot2.refresh_from_db()
    
    print("\nFINAL STATE:")
    print(f"Source: {source.stock} (Expected: 5)")
    print(f"Lot OLD: {lot1.quantity_remaining} (Expected: 0)")
    print(f"Lot NEW: {lot2.quantity_remaining} (Expected: 5)")
    
    print(f"Dest: {dest.stock} (Expected: 75)")
    
    dest_lots = StockLot.objects.filter(produit=dest)
    print(f"Dest Lots count: {dest_lots.count()}")
    for l in dest_lots:
        print(f" - Lot: {l.lot}, Qty: {l.quantity_remaining}, Exp: {l.date_expiration}")

    # Assertions
    assert source.stock == 5, f"Source stock incorrect: {source.stock}"
    assert lot1.quantity_remaining == 0, "Lot1 should be empty"
    assert lot2.quantity_remaining == 5, "Lot2 should have 5 left"
    assert dest.stock == 75, f"Dest stock incorrect: {dest.stock}"
    assert dest_lots.count() == 1, "Should have 1 dest lot"
    assert dest_lots.first().date_expiration == lot1.date_expiration, "Dest lot should inherit Lot1 expiry (oldest)"
    
    print("\n=== TEST PASSED SUCCESSFULLY ===")
    
    # Cleanup
    relation.delete()
    source.delete()
    dest.delete()
    # Note: lots cascade delete or set null depending on definition, generic cleanup here
    print("Cleanup done.")

if __name__ == '__main__':
    run_test()
