import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.orders import Commande
from django.db import transaction
from django.db.models import Count

def fix_commande_duplicates():
    print("Checking for duplicate numero_facture in Commande...")
    
    # In PostgreSQL, many NULLs are fine for unique=True, but many '' (empty strings) are NOT.
    # However, let's just fix everything that is not NULL and is duplicated.
    
    duplicates = Commande.objects.exclude(numero_facture__isnull=True).values('numero_facture').annotate(c=Count('id')).filter(c__gt=1)
    
    if not duplicates:
        print("No duplicates found in Commande.")
        return

    fixed = 0
    with transaction.atomic():
        for d in duplicates:
            num = d['numero_facture']
            commandes = Commande.objects.filter(numero_facture=num).order_by('id')
            # Keep the first one, rename others
            for i, cmd in enumerate(commandes):
                if i == 0: continue
                old_num = cmd.numero_facture
                # Append ID to make it unique
                cmd.numero_facture = f"{old_num}-{cmd.id}"
                cmd.save(update_fields=['numero_facture'])
                print(f"Fixed Commande ID {cmd.id}: {old_num} -> {cmd.numero_facture}")
                fixed += 1
                
    print(f"Total fixed: {fixed}")

if __name__ == "__main__":
    fix_commande_duplicates()
