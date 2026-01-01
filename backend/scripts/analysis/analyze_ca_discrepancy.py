import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

print('=' * 80)
print('ANALYSE DES FACTURES - CA TTC vs CA HT')
print('=' * 80)
print()

# Factures de décembre 2025
mois = '2025-12'
date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
date_debut = timezone.make_aware(date_debut)
date_fin = timezone.make_aware(date_fin)

factures = Facture.objects.filter(
    status__in=['VAL', 'PAY'],
    date__gte=date_debut,
    date__lt=date_fin
).order_by('id')

print(f'Nombre de factures: {factures.count()}')
print()

total_ttc = Decimal('0.00')
total_ht = Decimal('0.00')
factures_problematiques = []

print('DETAIL DES FACTURES:')
print('-' * 80)

for f in factures:
    total_ttc += f.total_ttc
    total_ht += f.total_ht
    
    # Vérifier si HT > TTC pour cette facture
    if f.total_ht > f.total_ttc:
        factures_problematiques.append(f)
        print(f'[PROBLEME] Facture {f.numero_facture or f.id}:')
    else:
        print(f'Facture {f.numero_facture or f.id}:')
    
    print(f'  TTC: {f.total_ttc:,.2f} F')
    print(f'  HT: {f.total_ht:,.2f} F')
    print(f'  TVA: {f.tva}%')
    print(f'  Remise: {f.remise:,.2f} F')
    
    # Calculer ce que devrait être le TTC
    tva_calculee = f.total_ht * (f.tva / 100)
    ttc_attendu = f.total_ht + tva_calculee
    
    if abs(ttc_attendu - f.total_ttc) > Decimal('0.01'):
        print(f'  TTC attendu: {ttc_attendu:,.2f} F')
        print(f'  Difference: {f.total_ttc - ttc_attendu:,.2f} F')
    
    print()

print('=' * 80)
print('TOTAUX:')
print(f'  CA TTC: {total_ttc:,.2f} F')
print(f'  CA HT: {total_ht:,.2f} F')
print(f'  Difference: {total_ttc - total_ht:,.2f} F')
print()

if factures_problematiques:
    print(f'FACTURES PROBLEMATIQUES: {len(factures_problematiques)}')
    for f in factures_problematiques:
        print(f'  - Facture {f.numero_facture or f.id}: HT={f.total_ht} > TTC={f.total_ttc}')
else:
    print('Aucune facture problematique detectee.')

print('=' * 80)
