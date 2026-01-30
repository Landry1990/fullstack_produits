import os
import sys
import django

sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse
from django.contrib.auth.models import User

def inspect_laure_case():
    print("--- User Check: laure ---")
    try:
        laure = User.objects.get(username='laure')
        print(f"User: laure (ID: {laure.id})")
    except User.DoesNotExist:
        print("User 'laure' does NOT exist.")
        return

    print("\n--- Invoice Check: FAC-000090 ---")
    try:
        inv = Facture.objects.get(numero_facture='FAC-000090')
        creator = inv.created_by.username if inv.created_by else "None"
        print(f"Invoice: {inv.numero_facture} (ID: {inv.id})")
        print(f"Date: {inv.date}")
        print(f"Status: {inv.status}")
        print(f"Created By: {creator}")
        
        print("\nPayments:")
        payments = Caisse.objects.filter(facture=inv)
        for p in payments:
            p_user = p.user.username if p.user else "None"
            print(f"- Amount: {p.montant}, Date: {p.date_paiement}, User: {p_user}")
            
    except Facture.DoesNotExist:
        print("Invoice FAC-000090 not found.")

if __name__ == "__main__":
    inspect_laure_case()
