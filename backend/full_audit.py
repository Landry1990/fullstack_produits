import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.stock import MouvementStock
from api.models.billing import Facture, FactureProduit
from django.db.models import Count

def full_audit():
    print("--- 1. Checking for Duplicate Invoice Numbers (Facture) ---")
    dupes = Facture.objects.exclude(numero_facture__isnull=True).exclude(numero_facture='').values('numero_facture').annotate(c=Count('id')).filter(c__gt=1)
    if dupes.exists():
        print(f"CRITICAL: Found {dupes.count()} duplicate invoice numbers!")
        for d in dupes:
            print(f"  - {d['numero_facture']}: {d['c']} times")
    else:
        print("OK: No duplicate invoice numbers.")

    print("\n--- 2. Checking for Movements referencing wrong Invoice Numbers ---")
    # We look for movements where description has 'FAC-XXXXXX' but doesn't match the linked facture's numero
    movements = MouvementStock.objects.filter(type_mouvement='SORTIE', facture__isnull=False)
    mismatches = 0
    for m in movements:
        actual_num = m.facture.numero_facture
        # Look for the FAC- pattern in description
        import re
        desc_match = re.search(r'#(\d+)', m.description) or re.search(r'FAC-(\d+)', m.description)
        if desc_match:
            desc_num = desc_match.group(1)
            # Normalize to FAC-000XXX format for comparison
            if actual_num:
                norm_actual = actual_num.split('-')[-1]
                if desc_num != norm_actual:
                    print(f"Mismatch in Mouvement {m.id}:")
                    print(f"  - Actual Facture: {actual_num} (ID {m.facture_id})")
                    print(f"  - Description says: {m.description}")
                    mismatches += 1
    
    print(f"\nFound {mismatches} mismatches in movement descriptions.")

    print("\n--- 3. Checking for Missing Movements (Invoice line exists but no Stock movement) ---")
    valid_statuses = ['VALIDE', 'PAYE', 'PARTIEL']
    lines = FactureProduit.objects.filter(facture__status__in=valid_statuses).select_related('facture', 'produit')
    missing = 0
    for l in lines:
        # Check if a SORTIE movement exists for this product and facture
        exists = MouvementStock.objects.filter(facture=l.facture, produit=l.produit, type_mouvement='SORTIE').exists()
        if not exists:
            print(f"Missing Movement for Product {l.produit_id} in Facture {l.facture_id} ({l.facture.numero_facture})")
            missing += 1
    
    print(f"\nFound {missing} invoice lines missing stock movements.")

if __name__ == "__main__":
    full_audit()
