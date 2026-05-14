import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from api.models import Caisse, Facture

print('=== DEBUG CAISSE - TOUTES LES FACTURES ===')

# Toutes les dernières factures (pas de filtre status)
print('\n--- 10 dernières factures (tous statuts) ---')
factures = Facture.objects.order_by('-id')[:10]
for f in factures:
    paiements = Caisse.objects.filter(facture=f)
    total_paiements = sum([p.montant for p in paiements])
    print(f'Facture {f.id}: {f.numero_facture or "N/A"} - Status: {f.status} - Total: {f.total_ttc} - Paiements: {paiements.count()} - Montant payé: {total_paiements}')

# Derniers paiements (plus de détails)
print('\n--- 10 derniers paiements ---')
paiements = Caisse.objects.order_by('-id')[:10]
if paiements:
    for p in paiements:
        print(f'Paiement {p.id}: Facture {p.facture_id} ({p.facture.numero_facture if p.facture else "N/A"}) - Mode: {p.mode_paiement} - Montant: {p.montant} - Date: {p.date_paiement}')
else:
    print('AUCUN PAIEMENT')

# Factures sans paiement
print('\n--- Factures récentes sans paiement ---')
factures_recentes = Facture.objects.filter(status__in=['VALIDEE', 'PAYEE']).order_by('-id')[:10]
factures_sans_paiement = []
for f in factures_recentes:
    if not Caisse.objects.filter(facture=f).exists():
        factures_sans_paiement.append(f)

if factures_sans_paiement:
    for f in factures_sans_paiement:
        print(f'⚠️ Facture {f.id}: {f.numero_facture or "N/A"} - Status: {f.status} - Total: {f.total_ttc} - SANS PAIEMENT')
else:
    print('✅ Toutes les factures récentes ont des paiements')
