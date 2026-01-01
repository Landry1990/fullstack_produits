import os
import django
import json

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse, FactureProduitAllocation
from django.db.models import Sum, F, Q, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import datetime
from decimal import Decimal

mois = '2025-12'
date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
date_debut = timezone.make_aware(date_debut)
date_fin = timezone.make_aware(date_fin)

print('=' * 80)
print('COMPARAISON: VALEURS ATTENDUES vs RAPPORT API')
print('=' * 80)
print()

# Factures du mois
factures = Facture.objects.filter(
    status__in=['VAL', 'PAY'],
    date__gte=date_debut,
    date__lt=date_fin
)

# Créances (comme dans rapport_view.py ligne 100-124)
toutes_factures_credit = Facture.objects.filter(
    paiements__mode_paiement='en_compte',
    status__in=['VAL', 'PAY']
).distinct()

creances_data = toutes_factures_credit.annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee')),
        Decimal('0.00'),
        output_field=DecimalField()
    ),
    remainder=F('total_ttc') - F('paid_amount')
).filter(
    remainder__gt=0
).aggregate(
    total_creances=Sum('remainder'),
    nb_factures_impayees=Sum(1)
)

total_creances = creances_data['total_creances'] or Decimal('0.00')

print('CREANCES (calcul actuel du rapport):')
print(f'  Total: {total_creances:,.2f} F')
print()

# Maintenant le calcul CORRECT (excluant les paiements "en_compte")
creances_correctes = toutes_factures_credit.annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
        Decimal('0.00'),
        output_field=DecimalField()
    ),
    remainder=F('total_ttc') - F('paid_amount')
).filter(
    remainder__gt=0
).aggregate(
    total_creances=Sum('remainder')
)

total_creances_correct = creances_correctes['total_creances'] or Decimal('0.00')

print('CREANCES (calcul CORRECT - excluant "en_compte"):')
print(f'  Total: {total_creances_correct:,.2f} F')
print()

print('=' * 80)
print(f'PROBLEME IDENTIFIE:')
print(f'  Valeur actuelle (rapport): {total_creances:,.2f} F')
print(f'  Valeur correcte: {total_creances_correct:,.2f} F')
print(f'  Difference: {total_creances - total_creances_correct:,.2f} F')
print('=' * 80)
