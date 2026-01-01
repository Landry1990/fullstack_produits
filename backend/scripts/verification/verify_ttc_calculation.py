import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, FactureProduit
from decimal import Decimal

print('=' * 80)
print('VERIFICATION - CALCUL TVA TTC (TVA INCLUSE)')
print('=' * 80)
print()

# Prendre une facture exemple
facture = Facture.objects.filter(numero_facture='FAC-000040').first()

if facture:
    print(f'Facture: {facture.numero_facture}')
    print(f'Remise: {facture.remise} F')
    print()
    
    print('Détail des lignes:')
    print('-' * 80)
    
    for ligne in facture.produits.all():
        ttc_ligne = ligne.quantity * ligne.selling_price
        
        if ligne.tva > 0:
            ht_ligne = ttc_ligne / (1 + ligne.tva / 100)
            tva_ligne = ttc_ligne - ht_ligne
        else:
            ht_ligne = ttc_ligne
            tva_ligne = Decimal('0.00')
        
        print(f'{ligne.produit.name}:')
        print(f'  Quantité: {ligne.quantity}')
        print(f'  Prix unitaire TTC: {ligne.selling_price:,.2f} F')
        print(f'  TVA produit: {ligne.tva}%')
        print(f'  Total TTC: {ttc_ligne:,.2f} F')
        print(f'  Total HT: {ht_ligne:,.2f} F')
        print(f'  Total TVA: {tva_ligne:,.2f} F')
        print()
    
    print('=' * 80)
    print('TOTAUX FACTURE:')
    print(f'  Total HT: {facture.total_ht:,.2f} F')
    print(f'  Total TVA: {facture.total_tva:,.2f} F')
    print(f'  Total TTC: {facture.total_ttc:,.2f} F')
    print('=' * 80)
    
    # Vérification
    print()
    print('VERIFICATION:')
    print(f'  HT + TVA = {facture.total_ht + facture.total_tva:,.2f} F')
    print(f'  TTC = {facture.total_ttc:,.2f} F')
    
    if abs((facture.total_ht + facture.total_tva) - facture.total_ttc) < Decimal('0.10'):
        print('  ✓ Cohérent!')
    else:
        print('  ✗ Incohérent!')

print()
