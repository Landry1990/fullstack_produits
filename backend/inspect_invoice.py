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
    # Find an invoice with insurance
    f = Facture.objects.filter(part_client__lt=models.F('total_ttc'), status='PAY').first()
    if not f:
        print("No insurance invoice found.")
        return
    
    print(f"Facture #{f.numero_facture} (ID: {f.id})")
    print(f"Total TTC: {f.total_ttc}")
    print(f"Part Client: {f.part_client}")
    print(f"Part Assurance (Théorique): {f.total_ttc - f.part_client}")
    
    paiements = Caisse.objects.filter(facture=f, statut='completee')
    for p in paiements:
        print(f"  - Paiement: {p.montant} F, Mode: {p.mode_paiement}")

if __name__ == "__main__":
    from django.db import models
    run()
