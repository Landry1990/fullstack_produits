import os
import django
from decimal import Decimal
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Facture, FactureProduit, Caisse
from django.db.models import Sum, F, Q, Value, DecimalField, OuterRef, Subquery, Count
from django.db.models.functions import Coalesce

print("--- COMPARAISON DES CRÉANCES ---")

# 1. LOGIQUE DASHBOARD (Calcul reconstitué depuis les lignes)
print("\n1. Logique Dashboard (Calcul dynamique TTC depuis les produits)...")

produits_subquery = FactureProduit.objects.filter(
    facture=OuterRef('pk')
).values('facture').annotate(
    total_ht_calc=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
).values('total_ht_calc')

paiements_subquery = Caisse.objects.filter(
    facture=OuterRef('pk'),
    statut='completee'
).exclude(
    mode_paiement='en_compte'
).values('facture').annotate(
    total_paye_calc=Sum('montant')
).values('total_paye_calc')

factures_annotated = Facture.objects.annotate(
    annotated_total_ht=Coalesce(Subquery(produits_subquery), Value(Decimal('0.00'))),
    annotated_total_paye=Coalesce(Subquery(paiements_subquery), Value(Decimal('0.00')))
).annotate(
    annotated_total_ttc=(
        F('annotated_total_ht') - F('remise')
    )
)

receivables_aggs = factures_annotated.filter(
    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).annotate(
    reste_a_payer=F('annotated_total_ttc') - F('annotated_total_paye')
).filter(
    reste_a_payer__gt=Decimal('0.1')
).aggregate(
    total_receivables=Sum('reste_a_payer'),
    receivables_count=Count('id', distinct=True)
)

dash_total = receivables_aggs['total_receivables'] or Decimal('0.00')
dash_count = receivables_aggs['receivables_count'] or 0

print(f"DASHBOARD: {dash_total} F ({dash_count} factures)")


# 2. LOGIQUE LISTE CRÉANCES (Utilise les champs stockés total_ttc)
print("\n2. Logique Liste Créances (Basé sur le champ stocké total_ttc)...")

list_queryset = Facture.objects.filter(
    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).annotate(
    paid_amount=Coalesce(
        Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
        Value(0, output_field=DecimalField())
    ),
    remainder=F('total_ttc') - F('paid_amount')
).filter(
    remainder__gt=Decimal('0.1')
)

list_aggs = list_queryset.aggregate(
    total_list=Sum('remainder'),
    count_list=Count('id', distinct=True)
)

list_total = list_aggs['total_list'] or Decimal('0.00')
list_count = list_aggs['count_list'] or 0

print(f"LISTE:     {list_total} F ({list_count} factures)")

# 3. ANALYSE ECRIT
diff = dash_total - list_total
print(f"\nÉCART: {diff} F")

if abs(diff) > Decimal('0.1'):
    print("\n DÉTAIL DES DIFFÉRENCES (Stocké vs Calculé) :")
    # On compare facture par facture dans le subset Dashboard
    # Note: On itère sur le queryset Dashboard car il recalcul tout
    for f in factures_annotated.filter(status__in=['VAL', 'PAY']):
        # Calcul dashboard pour cette facture
        # (On refait le calcul python pour simplifier l'affichage debug)
        annotated_ttc = f.annotated_total_ttc # Computed by annotation
        stored_ttc = f.total_ttc
        
        if abs(annotated_ttc - stored_ttc) > Decimal('0.1'):
            print(f"Facture #{f.numero_facture or f.id}: Stocké={stored_ttc} vs Calculé={annotated_ttc} (Diff: {stored_ttc-annotated_ttc})")

print("\n--- FIN ---")
