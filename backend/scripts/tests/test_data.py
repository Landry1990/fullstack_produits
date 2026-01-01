"""Script de test pour vérifier les données du dashboard et journal de caisse"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse
from django.db.models import Count, Sum
from decimal import Decimal

print("=" * 60)
print("FACTURES VALIDÉES/PAYÉES (Recent Transactions)")
print("=" * 60)
factures = Facture.objects.filter(status__in=['VAL', 'PAY']).order_by('-date')[:10]
print(f"Total factures VAL/PAY: {factures.count()}\n")
for f in factures:
    client_name = f.client.name if f.client else "Client de passage"
    print(f"ID: {f.id:4d} | Client: {client_name:20s} | Total TTC: {f.total_ttc:10.2f} F | Status: {f.status} | Date: {f.date}")

print("\n" + "=" * 60)
print("ENTRÉES CAISSE (Cash Journal)")
print("=" * 60)
caisses = Caisse.objects.filter(statut='completee').order_by('-date_paiement')[:15]
print(f"Total entrées caisse: {caisses.count()}\n")
for c in caisses:
    facture_id = f"F#{c.facture.id}" if c.facture else "N/A"
    print(f"Facture: {facture_id:6s} | Mode: {c.mode_paiement:10s} | Montant: {c.montant:10.2f} F | Date: {c.date_paiement}")

print("\n" + "=" * 60)
print("STATISTIQUES PAR MODE DE PAIEMENT")
print("=" * 60)
modes = Caisse.objects.filter(statut='completee').values('mode_paiement').annotate(
    count=Count('id'),
    total=Sum('montant')
).order_by('-total')

for m in modes:
    print(f"{m['mode_paiement']:15s}: {m['count']:3d} transactions, Total: {m['total']:12.2f} F")

print("\n" + "=" * 60)
print("CRÉANCES (Factures avec paiement en_compte)")
print("=" * 60)
factures_creances = Facture.objects.filter(
    status__in=['VAL', 'PAY'],
    paiements__mode_paiement='en_compte'
).distinct()[:10]

print(f"Factures avec en_compte: {factures_creances.count()}\n")
for f in factures_creances:
    total_paye = sum([p.montant for p in f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte')])
    reste = f.total_ttc - total_paye
    client_name = f.client.name if f.client else "Passage"
    print(f"ID: {f.id:4d} | Client: {client_name:20s} | Total TTC: {f.total_ttc:10.2f} F | Payé: {total_paye:10.2f} F | Reste: {reste:10.2f} F")

print("\n" + "=" * 60)
print("COMPARAISON TOTAUX")
print("=" * 60)
total_factures = Facture.objects.filter(status__in=['VAL', 'PAY']).aggregate(total=Sum('total_ttc'))['total'] or Decimal('0.00')
total_caisse_all = Caisse.objects.filter(statut='completee').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
total_caisse_no_compte = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')

print(f"Total Factures VAL/PAY (Dashboard CA): {total_factures:15.2f} F")
print(f"Total Caisse (TOUS modes):              {total_caisse_all:15.2f} F")
print(f"Total Caisse (SANS en_compte):          {total_caisse_no_compte:15.2f} F")
print(f"\nDifférence (Dashboard - Caisse):        {total_factures - total_caisse_no_compte:15.2f} F")
print(f"(Cette différence devrait être la part assurance)")
