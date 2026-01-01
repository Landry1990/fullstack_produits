import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse, FactureProduitAllocation
from django.db.models import Sum, F, DecimalField
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

print('=' * 80)
print('VERIFICATION COMPLETE DU RAPPORT MENSUEL - DECEMBRE 2025')
print('=' * 80)
print()

# Paramètres
mois = '2025-12'
date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
date_debut = timezone.make_aware(date_debut)
date_fin = timezone.make_aware(date_fin)

# 1. Factures du mois
factures = Facture.objects.filter(
    status__in=['VAL', 'PAY'],
    date__gte=date_debut,
    date__lt=date_fin
)

ca_ttc = sum(f.total_ttc for f in factures)
ca_ht = sum(f.total_ht for f in factures)
nb_ventes = factures.count()

print('1. CHIFFRE D\'AFFAIRES')
print(f'   CA TTC: {ca_ttc:,.2f} F')
print(f'   CA HT: {ca_ht:,.2f} F')
print(f'   Nb ventes: {nb_ventes}')
print()

# 2. Marge
allocations = FactureProduitAllocation.objects.filter(
    facture_produit__facture__in=factures
)
cout_achat = sum(a.cost_price * a.quantity for a in allocations)
marge_brute = ca_ht - cout_achat
marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')

print('2. MARGE')
print(f'   Cout achat: {cout_achat:,.2f} F')
print(f'   Marge brute: {marge_brute:,.2f} F')
print(f'   Marge %: {marge_pct:.2f}%')
print()

# 3. Encaissements
encaissements = Caisse.objects.filter(
    facture__in=factures,
    statut='completee'
).exclude(
    mode_paiement='en_compte'
).values('mode_paiement').annotate(
    total=Sum('montant')
).order_by('-total')

print('3. ENCAISSEMENTS REELS')
total_enc = Decimal('0.00')
for enc in encaissements:
    total_enc += enc['total']
    print(f'   {dict(Caisse.MODES_PAIEMENT).get(enc["mode_paiement"])}: {enc["total"]:,.2f} F')
print(f'   TOTAL: {total_enc:,.2f} F')
print()

# 4. Créances (NOUVELLE APPROCHE PYTHON)
print('4. CREANCES A PERCEVOIR')
toutes_factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().prefetch_related('paiements')

total_creances = Decimal('0.00')
nb_factures_impayees = 0

print('   Detail:')
for facture in toutes_factures_credit:
    montant_paye = facture.paiements.filter(
        statut='completee'
    ).exclude(
        mode_paiement='en_compte'
    ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
    
    reste = facture.total_ttc - montant_paye
    
    if reste > 0:
        print(f'     Facture {facture.numero_facture}: {reste:,.2f} F')
        total_creances += reste
        nb_factures_impayees += 1

print(f'   TOTAL: {total_creances:,.2f} F ({nb_factures_impayees} factures)')
print()

print('=' * 80)
print('RESUME FINAL')
print('=' * 80)
print(f'CA TTC: {ca_ttc:,.2f} F')
print(f'CA HT: {ca_ht:,.2f} F')
print(f'Marge: {marge_brute:,.2f} F ({marge_pct:.2f}%)')
print(f'Encaissements: {total_enc:,.2f} F')
print(f'Creances a percevoir: {total_creances:,.2f} F')
print('=' * 80)
print()
print('Ces valeurs devraient correspondre exactement au rapport mensuel!')
