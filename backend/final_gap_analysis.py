import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\Projet Fullstack\fullstack_produits\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Facture, Caisse, CouponMonnaie
from django.db import models

def run():
    month = 3
    year = 2026
    factures = Facture.objects.filter(date__month=month, date__year=year, status__in=['VAL', 'PAY'], is_cancelled=False)
    
    global_gap = Decimal('0')
    print(f"Checking {factures.count()} invoices...")
    
    for f in factures:
        paiements = Caisse.objects.filter(facture=f, statut='completee').exclude(mode_paiement='recouvrement')
        total_p = sum(p.montant for p in paiements)
        
        # Part assurance
        p_ass = f.total_ttc - f.part_client
        
        gap = f.total_ttc - (total_p + p_ass)
        
        if abs(gap) > 0.01:
            print(f"Facture #{f.numero_facture}: TTC={f.total_ttc}, Payé={total_p}, Ass={p_ass}, Gap={gap}")
            global_gap += gap
            
    print(f"\nGAP TOTAL CALCULE: {global_gap}")

if __name__ == "__main__":
    run()
