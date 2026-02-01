
import os
import django
import sys
from decimal import Decimal

# Setup Django environment
sys.path.append('c:/Projet Fullstack/fullstack_produits/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Inventaire

try:
    inv = Inventaire.objects.get(id=16)
    print(f"Inventaire #{inv.id} loaded.")
    
    # Check for lines where effective price is 0
    lines = inv.lignes.select_related('produit').all()
    
    print("Checking for lines with EFFECTIVE PRICE == 0 (where Ecart != 0)")
    
    count_zero = 0
    for l in lines:
        if l.ecart == 0: continue
        
        pmp = l.pmp_snapshot
        cost = l.produit.cost_price if l.produit else Decimal(0)
        price = pmp if pmp > 0 else cost
        
        if price == 0:
            count_zero += 1
            print(f"\n--- ZERO PRICE DETECTED ---")
            print(f"Line ID: {l.id}")
            print(f"Product: {l.produit.name if l.produit else 'None'}")
            print(f"Ecart: {l.ecart}")
            print(f"PMP Snapshot: {pmp}")
            print(f"Cost Price: {cost}")
            print(f"Selling Price: {l.produit.selling_price if l.produit else 'N/A'}")
            print(f"PMP Field: {l.produit.pmp if l.produit else 'N/A'}")

    if count_zero == 0:
        print("No lines have 0 effective price.")
    else:
        print(f"Found {count_zero} lines with 0 effective price.")

except Exception as e:
    print(f"Error: {e}")
