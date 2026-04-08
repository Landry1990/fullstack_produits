import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Commande, CommandeProduit

c = Commande.objects.filter(numero_facture='FAC 346 BAS').first()

# EXACT query
items = c.produits.select_related('produit', 'produit__fournisseur').all()

for item in items:
    if not item.lot:
        item.lot = f"TEST_CMD{c.id}-{item.id}"

items_with_lot = [item for item in items if item.lot]
print(f"Modifying {len(items_with_lot)} items in bulk_update")

CommandeProduit.objects.bulk_update(items_with_lot, ['lot'], batch_size=100)

print("Bulk updated completed.")

# Verify DB
c2 = Commande.objects.filter(numero_facture='FAC 346 BAS').first()
items2 = c2.produits.all()
for p in items2:
    print(f"ID={p.id} Lot is {p.lot}")

