import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit, StockLot

# Chercher les produits avec stock=1
produits_stock_1 = Produit.objects.filter(stock=1)
print(f'Nombre de produits avec stock=1: {produits_stock_1.count()}\n')

for p in produits_stock_1[:5]:
    print(f'{p.name} (ID: {p.id})')
    print(f'  Stock: {p.stock}')
    print(f'  PMP: {p.pmp}')
    
    lots = StockLot.objects.filter(produit=p)
    print(f'  Nombre de lots: {lots.count()}')
    
    for lot in lots:
        print(f'    - Payé: {lot.quantity_paid}, Gratuit: {lot.quantity_free}, Initial: {lot.quantity_initial}, Restant: {lot.quantity_remaining}')
    print()
