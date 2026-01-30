import os
import django
import sys
from django.contrib.auth.models import User

# Setup Django environment
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse

def fix_invoice_attribution():
    try:
        # Get the problematic invoice
        f = Facture.objects.get(numero_facture='FAC-000124')
        print(f"Invoice found: {f.numero_facture}")
        
        # Determine the user from related payments
        payments = Caisse.objects.filter(facture=f)
        if payments.exists():
            first_payment = payments.first()
            if first_payment.user:
                print(f"Found user from payment: {first_payment.user.username}")
                
                # Apply fix
                f.created_by = first_payment.user
                f.save()
                print("Successfully attributed invoice to user.")
            else:
                print("Payment found but no user associated.")
        else:
            print("No payments found for this invoice to infer user.")
            
    except Facture.DoesNotExist:
        print("Invoice FAC-000124 not found.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_invoice_attribution()
