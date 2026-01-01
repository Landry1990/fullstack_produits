import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from django.db.models import Sum, F, Q, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal

print('=' * 80)
print('DEBUG - CALCUL DES CREANCES DANS LE RAPPORT')
print('=' * 80)
print()

# Récupérer toutes les factures à crédit
toutes_factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct()

print(f'Nombre de factures à crédit: {toutes_factures_credit.count()}')
print()

# Calcul avec annotation
factures_annotees = toutes_factures_credit.annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
        Decimal('0.00'),
        output_field=DecimalField()
    ),
    remainder=F('total_ttc') - F('paid_amount')
)

print('DETAIL PAR FACTURE:')
print('-' * 80)
for f in factures_annotees:
    print(f'Facture {f.numero_facture}:')
    print(f'  Total TTC: {f.total_ttc:,.2f} F')
    print(f'  Montant payé (calculé): {f.paid_amount:,.2f} F')
    print(f'  Reste (calculé): {f.remainder:,.2f} F')
    print()

# Agrégation finale
result = factures_annotees.filter(remainder__gt=0).aggregate(
    total_creances=Sum('remainder'),
    nb_factures=Sum(1)
)

print('=' * 80)
print('RESULTAT FINAL:')
print(f'  Total créances: {result["total_creances"] or Decimal("0.00"):,.2f} F')
print(f'  Nb factures: {result["nb_factures"] or 0}')
print('=' * 80)
