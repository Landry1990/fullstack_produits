import os
import sys
import django
from django.db.models import Sum

# Add project root to sys.path
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse

def list_remaining_unattributed():
    print("Listing remaining invoices with created_by=None...")
    
    invoices = Facture.objects.filter(created_by__isnull=True).order_by('-date')
    count = invoices.count()
    print(f"Total found: {count}")
    
    print(f"{'ID':<6} {'Number':<12} {'Date':<20} {'Status':<10} {'Total':<10} {'Payments':<5}")
    print("-" * 70)
    
    print("\nBreakdown by Status:")
    stats = invoices.values('status').annotate(total=django.db.models.Count('id'))
    for s in stats:
        print(f"- {s['status']}: {s['total']}")
        
    print("\nDetailed List (Active Invoices Only - VAL/PAY):")
    active_invoices = invoices.filter(status__in=['VAL', 'PAY', 'VALIDEE', 'PAYEE']) # Handling potential code variations
    print(f"{'ID':<6} {'Number':<12} {'Date':<20} {'Status':<10} {'Total':<10} {'Payments':<5}")
    print("-" * 70)
    for inv in active_invoices:
        payment_count = Caisse.objects.filter(facture=inv).count()
        print(f"{inv.id:<6} {inv.numero_facture or 'None':<12} {inv.date.strftime('%Y-%m-%d %H:%M') if inv.date else 'N/A':<20} {inv.status:<10} {inv.total_ttc:<10} {payment_count:<5}")
        
    print(f"\nTotal Active Unattributed: {active_invoices.count()}")

if __name__ == "__main__":
    list_remaining_unattributed()
