import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Commande

c = Commande.objects.filter(numero_facture='FAC 346 BAS').first()
if c:
    print(f"Order #{c.id} - status={c.status}")
    for cp in c.produits.all():
        print(f" - {cp.produit.name} | lot={cp.lot} | exp={cp.date_expiration}")
else:
    print("Order FAC 346 BAS not found!")
