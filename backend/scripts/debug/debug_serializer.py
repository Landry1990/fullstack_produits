import os
import sys
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Force reload of serializers module
if 'api.serializers' in sys.modules:
    del sys.modules['api.serializers']

from api.serializers import CreanceSerializer
from api.models import Facture
from decimal import Decimal

print('=' * 80)
print('DEBUG - TOUTES LES DONNEES DU SERIALIZER')
print('=' * 80)
print()

factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().select_related('client')

print(f'Nombre de factures trouvees: {factures_credit.count()}')
print()

serializer = CreanceSerializer(factures_credit, many=True)
data = serializer.data

print(f'Nombre de factures serialisees: {len(data)}')
print()

for item in data:
    print(f"Facture {item['numero_facture']}:")
    print(f"  Total TTC: {item['total_ttc']}")
    print(f"  Montant paye: {item['montant_paye']}")
    print(f"  Reste a payer: {item['reste_a_payer']}")
    print(f"  Nombre de paiements: {len(item.get('paiements', []))}")
    print()

print('=' * 80)
