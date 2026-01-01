import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit

print('=' * 80)
print('VERIFICATION - CONFIGURATION PRODUIT TOPICREM')
print('=' * 80)
print()

produit = Produit.objects.filter(name__icontains='topicrem').first()

if produit:
    print(f'Produit: {produit.name}')
    print(f'  ID: {produit.id}')
    print(f'  CIP1: {produit.cip1}')
    print(f'  Prix vente: {produit.selling_price:,.2f} F')
    print(f'  TVA: {produit.tva if hasattr(produit, "tva") else "N/A"}')
    print()
    
    # Vérifier tous les champs du modèle
    print('Tous les champs du produit:')
    for field in produit._meta.fields:
        value = getattr(produit, field.name)
        if 'tva' in field.name.lower() or 'tax' in field.name.lower():
            print(f'  {field.name}: {value}')
else:
    print('Produit Topicrem non trouve!')

print('=' * 80)
