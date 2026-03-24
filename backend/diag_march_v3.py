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
    print(f"--- ANALYSE COMPLETE MARS 2026 ---")
    
    # Filter factures like the backend does
    factures = Facture.objects.filter(
        date_facture__month=month, 
        date_facture__year=year, 
        status__in=['VAL', 'PAY'],
        is_cancelled=False # Add this if it exists
    )
    # If is_cancelled doesn't exist, remove it. I'll check.
    # Actually, I saw 'is_cancelled' in previous errors but not in billing.py?
    # Wait, billing.py had Status.ANNULEE.
    # In rapport_view.py it uses is_cancelled=False.
    # Let me check if Facture has is_cancelled.
    part_client = factures.aggregate(total=models.Sum('part_client'))['total'] or Decimal('0')
    part_assurance = ca_ttc - part_client
    
    paiements_tous = Caisse.objects.filter(
        date_paiement__month=month, 
        date_paiement__year=year,
        statut='completee'
    )
    
    cash_momo_etc = paiements_tous.filter(mode_paiement__in=['especes', 'om', 'momo', 'carte', 'virement', 'cheque', 'depot']).aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    en_compte = paiements_tous.filter(mode_paiement='en_compte').aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    coupons_caisse = paiements_tous.filter(mode_paiement='coupon').aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    
    coupons_model = CouponMonnaie.objects.filter(
        date_utilisation__month=month,
        date_utilisation__year=year,
        status='UTILISE'
    ).aggregate(total=models.Sum('montant'))['total'] or Decimal('0')

    print(f"1. CA TTC TOTAL: {ca_ttc}")
    print(f"2. PART CLIENT (THEORIQUE): {part_client}")
    print(f"3. PART ASSURANCE (CALCULEE): {part_assurance}")
    print(f"4. ENCAISSEMENTS (CASH/ETC): {cash_momo_etc}")
    print(f"5. EN COMPTE (CAISSE): {en_compte}")
    print(f"6. COUPONS (CAISSE): {coupons_caisse}")
    print(f"7. COUPONS (MODEL): {coupons_model}")
    
    somme = cash_momo_etc + en_compte + coupons_caisse + part_assurance
    gap = ca_ttc - somme
    
    print(f"\n--- BALANCE ---")
    print(f"SOMME DES COMPOSANTS: {somme}")
    print(f"GAP (CA - SOMME): {gap}")
    
    if abs(gap) > 0:
        # Est-ce que EN COMPTE est déjà dans PART CLIENT ?
        # Souvent, si on fait une vente en compte, c'est pour un client pro sans assurance?
        # Ou alors c'est la part client qui est mise 'en compte'
        print(f"\nVérification: Part Client ({part_client}) vs (Encaissement {cash_momo_etc} + En Compte {en_compte} + Coupons {coupons_caisse})")
        comp_client = cash_momo_etc + en_compte + coupons_caisse
        print(f"Différence Client: {part_client - comp_client}")

if __name__ == "__main__":
    run()
