import os
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.serializers import CreanceSerializer
from api.models import Facture
from django.db.models import Sum, F, Q, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal

print('=' * 80)
print('ANALYSE DES CRÉANCES - COMPARAISON BASE DE DONNÉES vs API')
print('=' * 80)
print()

# 1. Données brutes de la base de données
print('1. DONNÉES BRUTES DE LA BASE DE DONNÉES')
print('-' * 80)

factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct().select_related('client')

factures_annotees = factures_credit.annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee')),
        Decimal('0.00'),
        output_field=DecimalField()
    ),
    remainder=F('total_ttc') - F('paid_amount')
)

total_db = Decimal('0.00')
count_db = 0

for f in factures_annotees:
    reste = f.total_ttc - f.paid_amount
    if reste > 0:
        count_db += 1
        total_db += reste
        print(f'  Facture {f.numero_facture}: {reste:,.2f} F')

print(f'\nTotal DB: {count_db} factures = {total_db:,.2f} F')
print()

# 2. Données via le serializer (comme l'API)
print('2. DONNÉES VIA LE SERIALIZER (comme l\'API)')
print('-' * 80)

serializer = CreanceSerializer(factures_credit, many=True)
data = serializer.data

total_api = Decimal('0.00')
count_api = 0

for item in data:
    reste = Decimal(str(item['reste_a_payer']))
    if reste > 0:
        count_api += 1
        total_api += reste
        print(f'  Facture {item["numero_facture"]}: {reste:,.2f} F (montant_paye: {item["montant_paye"]})')

print(f'\nTotal API: {count_api} factures = {total_api:,.2f} F')
print()

# 3. Comparaison
print('3. COMPARAISON')
print('-' * 80)
print(f'Base de données: {total_db:,.2f} F')
print(f'API (Serializer): {total_api:,.2f} F')
difference = total_api - total_db
print(f'Différence: {difference:,.2f} F')

if abs(difference) < 0.01:
    print('✅ Les valeurs correspondent !')
else:
    print('❌ Il y a une différence !')
    
print('=' * 80)
