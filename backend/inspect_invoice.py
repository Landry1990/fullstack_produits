import os
import django
import sys

# Setup Django environment
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture

def inspect_invoice():
    try:
        f = Facture.objects.get(numero_facture='FAC-000124')
        print(f"Invoice: {f.numero_facture} (ID: {f.id})")
        print(f"Date: {f.date}")
        print(f"Total: {f.total_ttc}")
        # Check potential user attribution fields (adjust names based on model definition if needed)
        # Based on previous context, Facture might not have a direct user field, or it might be related via 'created_by' 
        # or it might be in a related model like 'MouvementCaisse' or 'SessionCaisse'?
        # Let's check commonly used fields for attribution.
        
        # Checking fields from model definition (I should recall or check model def if unsure, mostly likely 'created_by' or nothing)
        # Assuming created_by from typical django patterns, or checking attribute if it exists
        
        if hasattr(f, 'created_by'):
             print(f"Created By: {f.created_by}")
        else:
             print("Field 'created_by' not found on Facture model.")

        if hasattr(f, 'user'):
             print(f"User: {f.user}")
        else:
             print("Field 'user' not found on Facture model.")
             
        # Check if there are related payments logs or something that might indicate who did it
    except Facture.DoesNotExist:
        print("Invoice FAC-000124 not found.")

if __name__ == "__main__":
    inspect_invoice()
