import os
import sys

import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Force reload of serializers module
if 'api.serializers' in sys.modules:
    del sys.modules['api.serializers']

from decimal import Decimal

from api.models import Facture
from api.serializers import CreanceSerializer

print('=' * 80)
print('VERIFICATION FINALE - CREANCES')
print('=' * 80)
print()

factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().select_related('client')

serializer = CreanceSerializer(factures_credit, many=True)
data = serializer.data

print('DONNEES VIA LE SERIALIZER (API):')
print('-' * 80)

total_api = Decimal('0.00')
for item in data:
    reste = Decimal(str(item['reste_a_payer']))
    if reste > 0:
        total_api += reste
        print(f"Facture {item['numero_facture']}:")
        print(f"  Total TTC: {item['total_ttc']} F")
        print(f"  Montant paye: {item['montant_paye']} F")
        print(f"  Reste a payer: {item['reste_a_payer']} F")
        print()

print('=' * 80)
print(f'TOTAL DES CREANCES (API): {total_api:,.2f} F')
print('=' * 80)
