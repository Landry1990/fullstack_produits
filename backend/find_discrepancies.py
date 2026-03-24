import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\Projet Fullstack\fullstack_produits\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Facture, Caisse

def run():
    month = 3
    year = 2026
    factures = Facture.objects.filter(date__month=month, date__year=year, status='PAY')
    
    print(f"Checking {factures.count()} invoices for March 2026...")
    for f in factures:
        paiements = Caisse.objects.filter(facture=f, statut='completee').exclude(mode_paiement='recouvrement')
        total_paye = sum(p.montant for p in paiements)
        
        if total_paye != f.total_ttc:
            print(f"Facture #{f.numero_facture} (ID: {f.id})")
            print(f"  Total TTC: {f.total_ttc}")
            print(f"  Total Payé: {total_paye}")
            print(f"  Différence: {f.total_ttc - total_paye}")
            for p in paiements:
                print(f"    - {p.montant} F ({p.mode_paiement})")

if __name__ == "__main__":
    run()
