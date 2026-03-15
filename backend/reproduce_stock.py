
import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit, Facture, FactureProduit, StockLot, MouvementStock
from api.services.sales_service import SalesService
from django.contrib.auth.models import User
from decimal import Decimal

def test_stock_reintegration():
    # 1. Setup
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser('admin_test', 'admin@test.com', 'password')
    
    produit = Produit.objects.create(
        name="Test Reintegration",
        stock=100,
        cost_price=Decimal('50'),
        selling_price=Decimal('100'),
        use_lot_management=False
    )
    
    print(f"Initial Stock: {produit.stock}")
    
    # 2. Finalize Sale
    data = {
        'produits': [
            {
                'produit': produit.id,
                'quantity': 10,
                'selling_price': 100,
                'discount': 0,
                'tva': 0
            }
        ]
    }
    
    facture = SalesService.finalize_sale(user, data, centralized=True)
    produit.refresh_from_db()
    print(f"Stock after sale (status {facture.status}): {produit.stock}")
    
    if produit.stock != 90:
        print("ERROR: Stock not decremented correctly!")
        return

    # 3. Cancel Sale
    success, message = SalesService.cancel_invoice(facture, user, "Test cancellation")
    print(f"Cancellation result: {success}, {message}")
    
    produit.refresh_from_db()
    print(f"Stock after cancellation: {produit.stock}")
    
    if produit.stock == 100:
        print("SUCCESS: Stock reintegrated correctly!")
    else:
        print(f"FAILURE: Stock NOT reintegrated! Current stock: {produit.stock}")

    # Cleanup
    facture.delete()
    produit.delete()

from django.utils import timezone

def test_stock_reintegration_with_lots():
    # 1. Setup
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser('admin_test', 'admin@test.com', 'password')
    
    produit = Produit.objects.create(
        name="Test Reintegration Lots",
        stock=100,
        cost_price=Decimal('50'),
        selling_price=Decimal('100'),
        use_lot_management=True
    )
    
    lot = StockLot.objects.create(
        produit=produit,
        lot="LOT-001",
        quantity_initial=100,
        quantity_remaining=100,
        price_cost=Decimal('50'),
        date_reception=timezone.now()
    )
    
    print(f"Initial Product Stock: {produit.stock}, Lot Stock: {lot.quantity_remaining}")
    
    # 2. Finalize Sale
    data = {
        'produits': [
            {
                'produit': produit.id,
                'quantity': 10,
                'selling_price': 100,
                'discount': 0,
                'tva': 0,
                'lot_id': lot.id
            }
        ]
    }
    
    facture = SalesService.finalize_sale(user, data, centralized=True)
    produit.refresh_from_db()
    lot.refresh_from_db()
    print(f"Stock after sale: Product={produit.stock}, Lot={lot.quantity_remaining}")
    
    if lot.quantity_remaining != 90:
        print("ERROR: Lot stock not decremented correctly!")
        return

    # 3. Cancel Sale
    success, message = SalesService.cancel_invoice(facture, user, "Test cancellation lots")
    print(f"Cancellation result: {success}, {message}")
    
    produit.refresh_from_db()
    lot.refresh_from_db()
    print(f"Stock after cancellation: Product={produit.stock}, Lot={lot.quantity_remaining}")
    
    if produit.stock == 100 and lot.quantity_remaining == 100:
        print("SUCCESS: Stock and Lot reintegrated correctly!")
    else:
        print(f"FAILURE: Reintegration failed! Product={produit.stock}, Lot={lot.quantity_remaining}")

    # Cleanup
    facture.delete()
    produit.delete()

def test_stock_reintegration_with_promis():
    # 1. Setup
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser('admin_test', 'admin@test.com', 'password')
    
    produit = Produit.objects.create(
        name="Test Reintegration Promis",
        stock=100,
        cost_price=Decimal('50'),
        selling_price=Decimal('100'),
        use_lot_management=False
    )
    
    print(f"Initial Stock: {produit.stock}")
    
    # 2. Finalize Sale with PROMIS
    # We simulate a promis by adding 'promis_qty' to the product data
    data = {
        'produits': [
            {
                'produit': produit.id,
                'quantity': 10,
                'promis_qty': 10, # All promised
                'selling_price': 100,
                'discount': 0,
                'tva': 0
            }
        ]
    }
    
    facture = SalesService.finalize_sale(user, data, centralized=True)
    produit.refresh_from_db()
    print(f"Stock after sale (10 promised): {produit.stock}")
    
    if produit.stock != 100:
        print("ERROR: Stock should NOT have been decremented for promised items!")
        # But wait, does finalize_sale handle promis_qty from data?
        # Let's check validate_invoice logic in sales_service.py
    
    # 3. Cancel Sale
    success, message = SalesService.cancel_invoice(facture, user, "Test cancellation promis")
    print(f"Cancellation result: {success}, {message}")
    
    produit.refresh_from_db()
    print(f"Stock after cancellation: {produit.stock}")
    
    if produit.stock == 100:
        print("SUCCESS: Stock remained correct after promis cancellation!")
    else:
        print(f"FAILURE: Stock jumped to {produit.stock}! (Reintegrated promised items?)")

    # Cleanup
    facture.delete()
    produit.delete()

def test_stock_reintegration_on_delete():
    print("\n--- Testing Stock Reintegration on DELETE ---")
    # 1. Setup
    user = User.objects.filter(is_superuser=True).first()
    produit = Produit.objects.create(
        name="Test Delete Reintegration",
        stock=100,
        cost_price=Decimal('50'),
        selling_price=Decimal('100'),
        use_lot_management=False
    )
    
    print(f"Initial Stock: {produit.stock}")
    
    # 2. Finalize Sale
    data = {
        'produits': [
            {
                'produit': produit.id,
                'quantity': 15,
                'selling_price': 100,
                'discount': 0,
                'tva': 0
            }
        ]
    }
    
    facture = SalesService.finalize_sale(user, data, centralized=True)
    produit.refresh_from_db()
    print(f"Stock after sale (status {facture.status}): {produit.stock}")
    
    # 3. Simulate DELETE via ViewSet (which calls destroy)
    # We'll manually call a simulation of the logic we added to destroy
    # since we're in a script and not a real request.
    print("Simulating DELETE (via SalesService.cancel_invoice + delete)...")
    if facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE, 'PAY', 'VAL']:
         SalesService.cancel_invoice(facture, user, motif="Test delete")
    
    facture.delete()
    
    produit.refresh_from_db()
    print(f"Stock after simulated delete: {produit.stock}")
    
    if produit.stock == 100:
        print("SUCCESS: Stock reintegrated correctly on delete simulation!")
    else:
        print(f"FAILURE: Stock NOT reintegrated on delete! Current stock: {produit.stock}")

    produit.delete()

if __name__ == "__main__":
    print("--- Testing Simple Product ---")
    test_stock_reintegration()
    print("\n--- Testing Product with Lots ---")
    test_stock_reintegration_with_lots()
    print("\n--- Testing Product with Promis ---")
    test_stock_reintegration_with_promis()
    test_stock_reintegration_on_delete()
