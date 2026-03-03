import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.inventory import Inventaire
from django.db import transaction

def populate_refs():
    print("Populating references for existing inventories...")
    inventaires = Inventaire.objects.filter(reference__isnull=True).order_by('date', 'id')
    
    if not inventaires:
        print("All inventories already have references.")
        return

    with transaction.atomic():
        for inv in inventaires:
            inv.save() # The save() method we added will handle the generation
            print(f"Generated reference for ID {inv.id}: {inv.reference}")

if __name__ == "__main__":
    populate_refs()
