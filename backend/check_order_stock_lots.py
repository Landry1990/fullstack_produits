import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Commande, StockLot, CommandeProduit

c = Commande.objects.filter(numero_facture='FAC 346 BAS').first()
if c:
    print(f"Order #{c.id} - status={c.status}")
    for cp in c.produits.all():
        print(f" - CommandeProduit(id={cp.id}): {cp.produit.name} | lot={cp.lot} | exp={cp.date_expiration}")
        
    print("\nStockLots associated with this order:")
    for lot in StockLot.objects.filter(commande_produit__commande=c):
        print(f" - StockLot(id={lot.id}): {lot.produit.name} | lot={lot.lot} | qty={lot.quantity_initial}")
else:
    print("Order FAC 346 BAS not found!")
