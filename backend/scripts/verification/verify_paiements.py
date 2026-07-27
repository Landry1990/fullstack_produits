import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from decimal import Decimal

from api.models import Facture

print('=' * 80)
print('VERIFICATION DES PAIEMENTS REELS')
print('=' * 80)
print()

factures = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().prefetch_related('paiements')

for f in factures:
    print(f'Facture {f.numero_facture}:')
    
    # Méthode 1: Via Python
    paiements_reels = f.paiements.filter(
        statut='completee'
    ).exclude(
        mode_paiement='en_compte'
    )
    
    total_python = sum(p.montant for p in paiements_reels)
    
    print(f'  Paiements réels (via Python): {total_python:,.2f} F')
    print('  Détail:')
    for p in paiements_reels:
        print(f'    - {p.get_mode_paiement_display()}: {p.montant:,.2f} F')
    
    # Méthode 2: Via ORM aggregate
    from django.db.models import Sum
    total_orm = f.paiements.filter(
        statut='completee'
    ).exclude(
        mode_paiement='en_compte'
    ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
    
    print(f'  Paiements réels (via ORM): {total_orm:,.2f} F')
    print()

print('=' * 80)
