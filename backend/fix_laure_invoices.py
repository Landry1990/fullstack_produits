import os
import sys
import django

sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse
from django.contrib.auth.models import User

def fix_laure_invoices():
    print("Searching for unattributed invoices paid by 'laure'...")
    try:
        laure = User.objects.get(username='laure')
    except User.DoesNotExist:
        print("User 'laure' not found.")
        return

    # Find invoices with NO creator, but with a payment by Laure
    # We can query Caisse objects by laure, then check their invoices
    
    payments_by_laure = Caisse.objects.filter(user=laure)
    print(f"Total payments by laure: {payments_by_laure.count()}")
    
    fixed_count = 0
    
    for payment in payments_by_laure:
        invoice = payment.facture
        if invoice.created_by is None:
            print(f"Fixing Invoice {invoice.numero_facture} (ID: {invoice.id}) -> Attributing to laure")
            invoice.created_by = laure
            invoice.save(update_fields=['created_by'])
            fixed_count += 1
            
    print(f"Total invoices fixed for laure: {fixed_count}")

    # Double check FAC-000090
    try:
        inv90 = Facture.objects.get(numero_facture='FAC-000090')
        print(f"FAC-000090 created_by is now: {inv90.created_by.username if inv90.created_by else 'None'}")
    except:
        pass

if __name__ == "__main__":
    fix_laure_invoices()
