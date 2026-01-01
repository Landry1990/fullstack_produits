import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

print('=' * 80)
print('TEST - NOUVELLE LOGIQUE CA HT (avec soustraction des remises)')
print('=' * 80)
print()

mois = '2025-12'
date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
date_debut = timezone.make_aware(date_debut)
date_fin = timezone.make_aware(date_fin)

factures = Facture.objects.filter(
    status__in=['VAL', 'PAY'],
    date__gte=date_debut,
    date__lt=date_fin
)

ca_ttc_old = Decimal('0.00')
ca_ht_old = Decimal('0.00')
ca_ttc_new = Decimal('0.00')
ca_ht_new = Decimal('0.00')

for facture in factures:
    ca_ttc_old += facture.total_ttc
    ca_ht_old += facture.total_ht
    
    ca_ttc_new += facture.total_ttc
    ca_ht_new += (facture.total_ht - facture.remise)

print('ANCIENNE LOGIQUE (INCORRECTE):')
print(f'  CA TTC: {ca_ttc_old:,.2f} F')
print(f'  CA HT: {ca_ht_old:,.2f} F')
print(f'  Difference: {ca_ttc_old - ca_ht_old:,.2f} F')
print()

print('NOUVELLE LOGIQUE (CORRECTE):')
print(f'  CA TTC: {ca_ttc_new:,.2f} F')
print(f'  CA HT: {ca_ht_new:,.2f} F')
print(f'  Difference: {ca_ttc_new - ca_ht_new:,.2f} F')
print()

if ca_ttc_new == ca_ht_new:
    print('[OK] CA TTC = CA HT (pas de TVA)')
elif ca_ttc_new > ca_ht_new:
    print('[OK] CA TTC > CA HT (avec TVA)')
else:
    print('[ERREUR] CA HT > CA TTC (impossible!)')

print('=' * 80)
