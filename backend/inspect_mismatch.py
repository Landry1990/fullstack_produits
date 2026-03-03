import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.stock import MouvementStock, StockLot
from api.models.billing import Facture, FactureProduit

def inspect_mismatch(product_id, invoice_num):
    print(f"Inspecting Product ID: {product_id}")
    
    # 1. Find all Movements for this product
    movements = MouvementStock.objects.filter(produit_id=product_id).order_by('-date')
    print(f"\nFound {movements.count()} movements for product {product_id}:")
    for m in movements:
        print(f"  - Mouvement ID: {m.id}, Type: {m.type_mouvement}, Qty: {m.quantite}, Facture ID: {m.facture_id}, Date: {m.date}, Description: {m.description}")
        if m.facture:
             print(f"    -> Facture Numero: {m.facture.numero_facture}, Status: {m.facture.status}")

    # 2. Check if any movement was linked to ID 174 (the old duplicate of 245)
    movements_174 = MouvementStock.objects.filter(facture_id=174)
    print(f"\nMovements linked to Facture ID 174 (Old duplicate of 245):")
    for m in movements_174:
         print(f"  - Product ID: {m.produit_id}, Name: {m.produit_nom}, Type: {m.type_mouvement}, Qty: {m.quantite}")

    # 3. Check Facture ID 174 lines
    try:
        f174 = Facture.objects.get(id=174)
        print(f"\nLines in Facture ID 174 (Current number: {f174.numero_facture}):")
        lines_174 = FactureProduit.objects.filter(facture=f174)
        for l in lines_174:
            print(f"  - Product ID: {l.produit_id}, Name: {l.produit_nom}, Qty: {l.quantity}")
    except Facture.DoesNotExist:
        print("\nFacture ID 174 does not exist.")

if __name__ == "__main__":
    inspect_mismatch(6966, "FAC-000245")
