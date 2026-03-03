import os
import django
import sys
import re

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.stock import MouvementStock
from api.models.billing import Facture, FactureProduit
from django.db import transaction

def sync_movements():
    print("--- 1. Synchronizing Mouvement Descriptions with Actual Invoice Numbers ---")
    movements = MouvementStock.objects.filter(type_mouvement='SORTIE', facture__isnull=False)
    updated_desc = 0
    
    with transaction.atomic():
        for m in movements:
            actual_num = m.facture.numero_facture
            if not actual_num: continue
            
            # Pattern to find #ID or FAC-ID
            # We want to replace the old number with the actual numero_facture
            new_description = m.description
            
            # Check if description mentions a number
            match = re.search(r'#(?:FAC-)?(\d+)', m.description) or re.search(r'FAC-(\d+)', m.description)
            
            if match:
                old_num_part = match.group(0) # e.g. "#245" or "FAC-000245"
                if actual_num not in m.description:
                    # Replace only the number part to keep the rest of the description (Date, Client, etc.)
                    new_description = m.description.replace(old_num_part, f"#{actual_num}")
                    
                    if new_description != m.description:
                        print(f"Updating Mouvement {m.id}:")
                        print(f"  Old: {m.description}")
                        print(f"  New: {new_description}")
                        m.description = new_description
                        m.save(update_fields=['description'])
                        updated_desc += 1

    print(f"\nTotal descriptions updated: {updated_desc}")

    print("\n--- 2. Cleaning Ghost Movements (Stock moved but not in Invoice) ---")
    # A ghost movement is a SORTIE linked to a FACTURE where the PRODUCT is NOT in FactureProduit
    ghost_ids = []
    for m in movements:
        exists = FactureProduit.objects.filter(facture=m.facture, produit=m.produit).exists()
        if not exists:
            # Check if it was a recent movement (within same day as invoice) to be sure
            ghost_ids.append(m.id)
            print(f"Deleting Ghost Mouvement {m.id}: Product {m.produit_id} not in Facture {m.facture_id} ({m.facture.numero_facture})")

    if ghost_ids:
        # We don't delete them immediately, we could also just unlink them or mark them.
        # But for stock consistency, if they aren't in the invoice, they shouldn't exist as SORTIE.
        # NOTE: Be careful if there are partial validations, but usually SORTIE = Validated Invoice.
        MouvementStock.objects.filter(id__in=ghost_ids).delete()
        print(f"\nDeleted {len(ghost_ids)} ghost movements.")
    else:
        print("No ghost movements to delete.")

if __name__ == "__main__":
    sync_movements()
