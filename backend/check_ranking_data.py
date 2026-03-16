import os
import sys
import django
from django.utils import timezone
from datetime import datetime
from django.db.models import Sum

sys.path.insert(0, os.path.abspath(os.curdir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture

def check_data(year, month):
    date_debut = timezone.make_aware(datetime(year, month, 1))
    if month == 12:
        date_fin = timezone.make_aware(datetime(year + 1, 1, 1))
    else:
        date_fin = timezone.make_aware(datetime(year, month + 1, 1))
    
    print(f"\nChecking factures from {date_debut} to {date_fin}")
    
    factures = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        date__gte=date_debut,
        date__lt=date_fin
    )
    
    count = factures.count()
    print(f"Total factures found: {count}")
    
    null_total = factures.filter(total_ttc__isnull=True).count()
    print(f"Factures with NULL total_ttc: {null_total}")
    
    # Check aggregation
    agg = factures.values('created_by').annotate(ca=Sum('total_ttc'))
    for row in agg:
        print(f"Vendeur ID: {row['created_by']}, CA: {row['ca']} (Type: {type(row['ca'])})")
        if row['ca'] is None:
            print("!!! Found NULL Sum !!!")

if __name__ == "__main__":
    print("--- Global Check ---")
    null_count = Facture.objects.filter(total_ttc__isnull=True).count()
    print(f"Total Factures with NULL total_ttc: {null_count}")
    
    null_created_by = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], created_by__isnull=True).count()
    print(f"Validated/Paid Factures with NULL created_by: {null_created_by}")

    print("\n--- Current Month (March 2026) ---")
    check_data(2026, 3)
    print("\n--- Previous Month (February 2026) ---")
    check_data(2026, 2)
