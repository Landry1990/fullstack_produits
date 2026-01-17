"""
Script to fix N/A lot numbers in StockLot records.
Uses commande_id from the associated commande_produit to generate lot numbers.
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import StockLot
from django.db.models import Q

# Find lots with NULL, empty, or N/A lot numbers
lots_to_fix = StockLot.objects.filter(
    Q(lot__isnull=True) | Q(lot='') | Q(lot='N/A')
).select_related('commande_produit__commande', 'produit')

print(f"Lots to fix: {lots_to_fix.count()}")

fixed_count = 0
for lot in lots_to_fix:
    if lot.commande_produit and lot.commande_produit.commande_id:
        new_lot_number = f"LOT{lot.commande_produit.commande_id:03d}"
        print(f"  StockLot {lot.id}: {lot.lot!r} -> {new_lot_number}")
        lot.lot = new_lot_number
        lot.save(update_fields=['lot'])
        fixed_count += 1
    else:
        print(f"  StockLot {lot.id}: No commande_produit, skipping")

print(f"\nFixed {fixed_count} lots.")
