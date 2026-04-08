import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Commande

c = Commande.objects.filter(numero_facture='FAC 346 BAS').first()
items = c.produits.all()

for i, item in enumerate(items):
    item.lot = f"TEST_CACHE_{i}"

items_with_lot = [item for item in items if item.lot]
print(f"Number of items with lot: {len(items_with_lot)}")
for item in items_with_lot:
    print(item.lot)
