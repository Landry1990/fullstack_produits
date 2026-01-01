import os
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse
from django.db.models import Sum, F, Q, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal

# Récupérer toutes les factures à crédit
factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().select_related('client')

# Annoter avec les montants payés et reste à payer
factures_annotees = factures_credit.annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee')),
        Decimal('0.00'),
        output_field=DecimalField()
    ),
    remainder=F('total_ttc') - F('paid_amount')
)

print('=' * 80)
print('FACTURES À CRÉDIT AVEC RESTE À PAYER')
print('=' * 80)
print()

total_general = Decimal('0.00')
count = 0

for f in factures_annotees:
    reste = f.total_ttc - f.paid_amount
    if reste > 0:
        count += 1
        total_general += reste
        client_name = f.client.name if f.client else 'Client de passage'
        print(f'Facture #{f.numero_facture or f.id}')
        print(f'  Client: {client_name}')
        print(f'  Date: {f.date.strftime("%d/%m/%Y")}')
        print(f'  Total TTC: {f.total_ttc:,.2f} F')
        print(f'  Payé: {f.paid_amount:,.2f} F')
        print(f'  RESTE À PAYER: {reste:,.2f} F')
        print()

print('=' * 80)
print(f'TOTAL: {count} facture(s) avec créances')
print(f'MONTANT TOTAL DES CRÉANCES: {total_general:,.2f} F')
print('=' * 80)
