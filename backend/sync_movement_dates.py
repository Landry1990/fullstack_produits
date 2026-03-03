import os
import django
import sys
from datetime import timedelta

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.stock import MouvementStock
from django.db import transaction

def sync_movement_dates():
    print("--- Synchronizing MouvementStock dates with Facture dates ---")
    
    # Get all movements linked to a facture
    movements = MouvementStock.objects.filter(type_mouvement='SORTIE', facture__isnull=False).select_related('facture')
    
    updated_count = 0
    
    # We use a batch approach to be efficient
    # Note: date = auto_now_add=True can only be overridden via .update() in some Django versions
    # or by manually setting it and saving if we disable the auto_now_add logic temporarily (complex)
    # The safest way is .update() on individual IDs or batches.
    
    with transaction.atomic():
        for m in movements:
            facture_date = m.facture.date
            # If dates differ by more than a few minutes, update it
            if abs((m.date - facture_date).total_seconds()) > 60:
                # Use .filter(id=m.id).update(date=...) to bypass auto_now_add
                MouvementStock.objects.filter(id=m.id).update(date=facture_date)
                updated_count += 1
                if updated_count % 50 == 0:
                    print(f"Updated {updated_count} movement dates...")

    print(f"\nSuccessfully synchronized {updated_count} movement dates.")

if __name__ == "__main__":
    sync_movement_dates()
