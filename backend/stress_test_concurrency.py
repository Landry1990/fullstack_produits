import os
import django
import sys
import threading
import time
import requests
from decimal import Decimal

# Setup Django for DB access only
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import (
    Produit, StockLot, Facture, FactureProduit, Profile
)
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

def test_concurrent_sales(product_id, num_threads=5, qty_per_sale=1):
    print(f"--- Stress Test: Concurrent Sales (REAL HTTP) for Product ID {product_id} ---")
    
    # 1. Reset product stock and LOTS
    p = Produit.objects.get(id=product_id)
    p.use_lot_management = True
    p.save()
    StockLot.objects.filter(produit=p).update(quantity_remaining=0)
    lot = StockLot.objects.filter(produit=p).first()
    if not lot:
         lot = StockLot.objects.create(produit=p, lot='TESTLOT', quantity_remaining=5, price_cost=50)
    else:
         lot.quantity_remaining = 5
         lot.save()
    p.stock = 5
    p.save()
    
    initial_stock = p.total_stock
    print(f"Initial Stock: {initial_stock}")
    
    # 2. Setup User & Token
    user = User.objects.get(username='test_vendeur')
    profile, _ = Profile.objects.get_or_create(user=user)
    profile.can_sell_negative_stock = False
    profile.save()
    token, _ = Token.objects.get_or_create(user=user)
    
    headers = {
        'Authorization': f'Token {token.key}',
        'Content-Type': 'application/json'
    }
    url = "http://localhost:8001/api/factures/finaliser/"
    
    results = []
    
    def simulate_sale():
        data = {
            'produits': [
                {
                    'produit': product_id,
                    'quantity': qty_per_sale,
                    'selling_price': 100,
                }
            ],
            'paiements': [{'mode': 'ESPECES', 'montant': 100}],
            'type': 'STD',
            'centralized_cash_register': False
        }
        
        try:
            start_time = time.time()
            response = requests.post(url, json=data, headers=headers)
            end_time = time.time()
            
            results.append({
                'status': response.status_code,
                'latency': end_time - start_time,
                'detail': response.text[:100]
            })
        except Exception as e:
            results.append({'status': 'ERROR', 'detail': str(e)})

    threads = []
    for _ in range(num_threads):
        t = threading.Thread(target=simulate_sale)
        threads.append(t)
        
    print(f"Launching {num_threads} concurrent sales threads...")
    for t in threads:
        t.start()
    for t in threads:
        t.join()
        
    print("\n--- Results ---")
    successes = sum(1 for r in results if r['status'] == 201)
    failures = sum(1 for r in results if r['status'] != 201)
    print(f"Successes: {successes}")
    print(f"Failures: {failures}")
    for i, r in enumerate(results):
        print(f" Thread {i+1}: Status {r['status']}, Detail: {r['detail']}")
        
    p.refresh_from_db()
    print(f"\nFinal Stock: {p.stock} (Cached), {p.total_stock} (Total from Lots)")
    
    # Verify exactly 5 successes
    if successes == 5:
        print("RESULT: PASS - Concurrency control works perfectly!")
    else:
        print(f"RESULT: FAIL - Expected 5 successes, got {successes}.")

if __name__ == "__main__":
    p = Produit.objects.filter(stock__gt=0).first()
    if p:
        test_concurrent_sales(p.id, num_threads=10, qty_per_sale=1)
    else:
        print("No product with stock found to test.")
