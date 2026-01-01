import os
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse, FactureProduitAllocation
from django.db.models import Sum, F, Q, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

# Paramètres du rapport (décembre 2025)
mois = '2025-12'
date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
if date_debut.month == 12:
    date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
else:
    date_fin = date_debut.replace(month=date_debut.month + 1, day=1)

date_debut = timezone.make_aware(date_debut)
date_fin = timezone.make_aware(date_fin)

print('=' * 80)
print(f'VERIFICATION RAPPORT MENSUEL - {mois}')
print('=' * 80)
print(f'Période: {date_debut.strftime("%d/%m/%Y")} au {date_fin.strftime("%d/%m/%Y")}')
print()

# 1. Factures du mois
factures = Facture.objects.filter(
    status__in=['VAL', 'PAY'],
    date__gte=date_debut,
    date__lt=date_fin
)

print(f'1. FACTURES DU MOIS: {factures.count()} factures')
print('-' * 80)

ca_ttc = Decimal('0.00')
ca_ht = Decimal('0.00')

for f in factures:
    ca_ttc += f.total_ttc
    ca_ht += f.total_ht
    print(f'  Facture {f.numero_facture}: TTC={f.total_ttc:,.2f} F, HT={f.total_ht:,.2f} F')

print(f'\nCA TTC: {ca_ttc:,.2f} F')
print(f'CA HT: {ca_ht:,.2f} F')
print()

# 2. Marge via allocations FIFO
print('2. MARGE (via allocations FIFO)')
print('-' * 80)

allocations = FactureProduitAllocation.objects.filter(
    facture_produit__facture__in=factures
)

cout_achat_total = Decimal('0.00')
for alloc in allocations:
    cout_achat_total += alloc.cost_price * alloc.quantity

marge_brute = ca_ht - cout_achat_total
marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')

print(f'Coût d\'achat: {cout_achat_total:,.2f} F')
print(f'Marge brute: {marge_brute:,.2f} F')
print(f'Marge %: {marge_pct:.2f}%')
print()

# 3. Encaissements réels
print('3. ENCAISSEMENTS REELS (hors "en compte")')
print('-' * 80)

encaissements = Caisse.objects.filter(
    facture__in=factures,
    statut='completee'
).exclude(
    mode_paiement='en_compte'
).values('mode_paiement').annotate(
    total=Sum('montant')
).order_by('-total')

total_encaissements = Decimal('0.00')
for enc in encaissements:
    total_encaissements += enc['total']
    print(f'  {dict(Caisse.MODES_PAIEMENT).get(enc["mode_paiement"])}: {enc["total"]:,.2f} F')

print(f'\nTotal encaissements: {total_encaissements:,.2f} F')
print()

# 4. Créances à percevoir (TOUTES les factures à crédit)
print('4. CREANCES A PERCEVOIR (toutes factures à crédit)')
print('-' * 80)

toutes_factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct()

creances_data = toutes_factures_credit.annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
        Decimal('0.00'),
        output_field=DecimalField()
    ),
    remainder=F('total_ttc') - F('paid_amount')
).filter(
    remainder__gt=0
)

total_creances = Decimal('0.00')
for f in creances_data:
    reste = f.total_ttc - f.paid_amount
    total_creances += reste
    print(f'  Facture {f.numero_facture}: Reste {reste:,.2f} F')

print(f'\nTotal créances: {total_creances:,.2f} F')
print()

print('=' * 80)
print('RESUME')
print('=' * 80)
print(f'CA TTC: {ca_ttc:,.2f} F')
print(f'CA HT: {ca_ht:,.2f} F')
print(f'Marge brute: {marge_brute:,.2f} F ({marge_pct:.2f}%)')
print(f'Encaissements réels: {total_encaissements:,.2f} F')
print(f'Créances à percevoir: {total_creances:,.2f} F')
print('=' * 80)
