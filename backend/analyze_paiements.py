import os
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse
from decimal import Decimal

print('=' * 80)
print('ANALYSE DETAILLEE DES PAIEMENTS')
print('=' * 80)
print()

factures = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().select_related('client').prefetch_related('paiements')

for f in factures:
    print(f'Facture {f.numero_facture} - Client: {f.client.name if f.client else "N/A"}')
    print(f'  Total TTC: {f.total_ttc:,.2f} F')
    print(f'  Paiements:')
    
    total_paye_reel = Decimal('0.00')
    
    for p in f.paiements.all():
        symbole = '  [FICTIF]' if p.mode_paiement == 'en_compte' else '  [REEL]'
        print(f'    - {p.get_mode_paiement_display()}: {p.montant:,.2f} F (statut: {p.statut}){symbole}')
        
        if p.statut == 'completee' and p.mode_paiement != 'en_compte':
            total_paye_reel += p.montant
    
    reste = f.total_ttc - total_paye_reel
    print(f'  Total paye (reel): {total_paye_reel:,.2f} F')
    print(f'  Reste a payer: {reste:,.2f} F')
    print()

print('=' * 80)
