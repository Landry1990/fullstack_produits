import os
import django
from decimal import Decimal
from django.db.models import Sum, Q

def analyze():
    import sys
    sys.path.append(os.getcwd())
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()
    
    from api.models import Facture, Caisse
    
    feb_start = '2026-02-01'
    feb_end = '2026-02-28 23:59:59'
    
    # Dashboard CA
    dashboard_ca = Facture.objects.filter(
        status__in=['VAL', 'PAY'], 
        date__range=[feb_start, feb_end]
    ).aggregate(total=Sum('total_ttc'))['total'] or Decimal('0')
    
    # Recouvrement Logic (From get_totals)
    recouvrement_q = Q(facture__client__client_type='PROFESSIONNEL') | Q(reference__icontains='[RECOUV]')
    
    transactions_feb = Caisse.objects.filter(
        statut='completee', 
        date_paiement__range=[feb_start, feb_end]
    )
    
    caisse_sales_in_feb = transactions_feb.exclude(recouvrement_q).aggregate(total=Sum('montant'))['total'] or Decimal('0')
    
    # Unpaid for FEB invoices
    invoices_feb = Facture.objects.filter(
        status__in=['VAL', 'PAY'], 
        date__range=[feb_start, feb_end]
    )
    
    total_unpaid_feb = Decimal('0')
    for f in invoices_feb:
        paid = Caisse.objects.filter(facture=f, statut='completee').exclude(mode_paiement='en_compte').aggregate(s=Sum('montant'))['s'] or Decimal('0')
        total_unpaid_feb += (f.total_ttc - paid)

    print(f"Dashboard CA (Feb invoices): {dashboard_ca}")
    print(f"Caisse 'Ventes' (Feb payments, non-rec): {caisse_sales_in_feb}")
    print(f"Reste à payer (Feb invoices): {total_unpaid_feb}")
    
    sum_check = caisse_sales_in_feb + total_unpaid_feb
    gap = dashboard_ca - sum_check
    print(f"Somme (Ventes + Reste): {sum_check}")
    print(f"GAP IDENTIFIE: {gap}")
    
    # Detail of FEB invoices paid in FEB but marked as RECOUVREMENT
    print("\n--- DETAILS RECOUVREMENTS SUR FACTURES DE FEVRIER ---")
    rec_on_feb_invoices = transactions_feb.filter(recouvrement_q).filter(facture__date__range=[feb_start, feb_end])
    total_rec_on_feb = Decimal('0')
    for r in rec_on_feb_invoices:
        client_name = r.facture.client.name if r.facture.client else "N/A"
        print(f"- Facture {r.facture.numero_facture} (Client: {client_name}): {r.montant} F [Ref: {r.reference}]")
        total_rec_on_feb += r.montant
    print(f"Total des recouvrements de factures de FEVRIER: {total_rec_on_feb}")
    
    print(f"\nExplication finale de l'écart : {gap} - {total_rec_on_feb} = {gap - total_rec_on_feb}")

if __name__ == "__main__":
    analyze()
