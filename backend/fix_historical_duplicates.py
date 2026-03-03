import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from django.db import transaction
from django.db.models import Count

def fix_duplicates():
    print("Starting robust historical duplicate cleanup...")
    
    # 1. Identify all factures with FAC- prefix
    factures = Facture.objects.filter(numero_facture__startswith='FAC-')
    print(f"Checking {factures.count()} invoices...")

    total_fixed = 0
    
    with transaction.atomic():
        # Pass 1: Rename everything to a temporary unique name to avoid intermediate collisions
        # e.g. ID 174 having FAC-000245 while ID 245 also has FAC-000245.
        # If we try to rename 174 to its correct FAC-000174, it's fine unless another record already has FAC-000174.
        
        for f in factures:
            expected_num = f"FAC-{f.id:06d}"
            if f.numero_facture != expected_num:
                old_num = f.numero_facture
                # Change to temp first to avoid collision with existing correct numbers
                f.numero_facture = f"TEMP-{f.id}-{old_num}"
                f.save(update_fields=['numero_facture'])
                total_fixed += 1

        print(f"Pass 1 complete: {total_fixed} records moved to temp state.")

        # Pass 2: Set them to their correct FINAL numbers
        temp_factures = Facture.objects.filter(numero_facture__startswith='TEMP-')
        for f in temp_factures:
            # Extract ID from the temp name correctly or just use f.id
            correct_num = f"FAC-{f.id:06d}"
            f.numero_facture = correct_num
            f.save(update_fields=['numero_facture'])
            
    print(f"\nCleanup complete. Total records re-aligned: {total_fixed}")

if __name__ == "__main__":
    fix_duplicates()
