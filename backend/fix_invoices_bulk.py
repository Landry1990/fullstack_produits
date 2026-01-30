import os
import sys
import django

# Add project root to sys.path
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')

# Set environment variable
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django
django.setup()

from api.models import Facture, Caisse

def bulk_fix_attribution():
    print("Starting bulk fix for unattributed invoices...")
    
    # 1. Find all invoices with no creator
    unattributed_invoices = Facture.objects.filter(created_by__isnull=True)
    count = unattributed_invoices.count()
    print(f"Found {count} invoices with missing 'created_by'.")
    
    fixed_count = 0
    skipped_count = 0
    
    # 2. Iterate and try to find a payment
    for invoice in unattributed_invoices:
        payments = Caisse.objects.filter(facture=invoice, user__isnull=False)
        
        if payments.exists():
            # Use the user from the first valid payment found
            # Ideally most invoices have one payment or payments by the same cashier
            payer_user = payments.first().user
            
            invoice.created_by = payer_user
            invoice.save(update_fields=['created_by'])
            
            print(f"[FIXED] Invoice {invoice.numero_facture} (ID: {invoice.id}) attributed to {payer_user.username}")
            fixed_count += 1
        else:
            print(f"[SKIP] Invoice {invoice.numero_facture} (ID: {invoice.id}) has no attributed payments.")
            skipped_count += 1
            
    print("-" * 30)
    print(f"Summary: Fixed {fixed_count}, Skipped {skipped_count}.")

if __name__ == "__main__":
    bulk_fix_attribution()
