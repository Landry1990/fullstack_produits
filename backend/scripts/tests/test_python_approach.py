import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from django.db.models import Sum
from decimal import Decimal

print('=' * 80)
print('TEST - NOUVELLE APPROCHE PYTHON POUR LES CREANCES')
print('=' * 80)
print()

toutes_factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().prefetch_related('paiements')

print(f'Nombre de factures à crédit: {toutes_factures_credit.count()}')
print()

total_creances = Decimal('0.00')
nb_factures_impayees = 0

for facture in toutes_factures_credit:
    # Calculer le montant payé (hors "en_compte")
    montant_paye = facture.paiements.filter(
        statut='completee'
    ).exclude(
        mode_paiement='en_compte'
    ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
    
    # Calculer le reste à payer
    reste = facture.total_ttc - montant_paye
    
    print(f'Facture {facture.numero_facture}:')
    print(f'  Total TTC: {facture.total_ttc:,.2f} F')
    print(f'  Montant payé (réel): {montant_paye:,.2f} F')
    print(f'  Reste à payer: {reste:,.2f} F')
    
    if reste > 0:
        total_creances += reste
        nb_factures_impayees += 1
        print(f'  [INCLUS] dans les creances')
    else:
        print(f'  [EXCLU] paye integralement')
    print()

print('=' * 80)
print('RESULTAT FINAL:')
print(f'  Total créances: {total_creances:,.2f} F')
print(f'  Nb factures impayées: {nb_factures_impayees}')
print('=' * 80)
