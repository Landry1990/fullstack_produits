import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\Projet Fullstack\fullstack_produits\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Facture, Caisse, CouponMonnaie

def run():
    month = 3
    year = 2026
    print(f"--- Analyse {month}/{year} ---")
    
    # Check models
    print(f"Facture fields: {[f.name for f in Facture._meta.get_fields()][:5]}...")
    print(f"CouponMonnaie fields: {[f.name for f in CouponMonnaie._meta.get_fields()]}")
    
    # 1. CA TTC Total
    factures = Facture.objects.filter(date__month=month, date__year=year, status='PAY')
    ca_ttc = factures.aggregate(total=models.Sum('total_ttc'))['total'] or Decimal('0')
    print(f"CA TTC (Factures PAY): {ca_ttc}")
    
    # 2. Part Assurance (calculée par différence ou stockée dans Facture)
    # Dans les KPIs, on calcule part_assurance = ca_ttc - part_client
    part_client_total = factures.aggregate(total=models.Sum('part_client'))['total'] or Decimal('0')
    part_assurance_total = ca_ttc - part_client_total
    print(f"Part Client (Théorique): {part_client_total}")
    print(f"Part Assurance: {part_assurance_total}")
    
    # 3. Encaissements (Caisse)
    paiements = Caisse.objects.filter(
        date_paiement__month=month, 
        date_paiement__year=year,
        statut='completee'
    ).exclude(mode_paiement='recouvrement')
    
    total_enc = paiements.filter(mode_paiement__in=['especes', 'om', 'momo', 'carte', 'virement', 'cheque', 'depot']).aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    print(f"Total Encaissements (Caisse hors en_compte/coupon/recouv): {total_enc}")
    
    # 4. Coupons utilisés
    coupons_utilises = CouponMonnaie.objects.filter(
        date_utilisation__month=month,
        date_utilisation__year=year,
        status='UTILISE'
    )
    total_coupons = coupons_utilises.aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    print(f"Total Coupons Utilisés: {total_coupons}")
    
    # 5. Ventes En Compte (dans Caisse, si mode_paiement='en_compte')
    # OU restes à payer sur les factures PAY
    en_compte = paiements.filter(mode_paiement='en_compte').aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    print(f"Total En Compte (Caisse): {en_compte}")
    
    # Balance
    somme = total_enc + en_compte + total_coupons + part_assurance_total
    diff = ca_ttc - somme
    print(f"\n--- BALANCE ---")
    print(f"Somme Identifiée: {somme}")
    print(f"Différence (GAP): {diff}")
    
    if abs(diff) > 0:
        print("\nAnalyse détaillée de l'écart...")
        # L'écart vient peut être des remises générales ?
        # Ou de factures annulées qui ont des paiements ?

if __name__ == "__main__":
    from django.db import models
    run()
