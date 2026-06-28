import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\Projet Fullstack\fullstack_produits\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models.billing import Facture, Caisse, CouponMonnaie

def analyze_march():
    month = 3
    year = 2026
    
    print(f"--- Analyse du mois {month}/{year} ---")
    
    factures = Facture.objects.filter(
        date_facture__month=month,
        date_facture__year=year,
        is_cancelled=False
    )
    
    ca_ttc = sum(f.total_ttc for f in factures)
    part_client_total = sum(f.part_client for f in factures)
    part_assurance_total = ca_ttc - part_client_total
    
    print(f"CA TTC: {ca_ttc}")
    print(f"Part Client: {part_client_total}")
    print(f"Part Assurance (Calculée): {part_assurance_total}")
    
    # Encaissements (hors recouvrements et hors coupons)
    paiements = Caisse.objects.filter(
        date_paiement__month=month,
        date_paiement__year=year,
        is_cancelled=False
    ).exclude(mode='recouvrement')
    
    total_enc = sum(p.montant for p in paiements)
    print(f"Total Encaissements (Caisse): {total_enc}")
    
    # DEBUG: Inspect fields of CouponMonnaie
    print("\nDEBUG CouponMonnaie fields:")
    try:
        from api.models.billing import CouponMonnaie
        fields = [f.name for f in CouponMonnaie._meta.get_fields()]
        print(f"Champs: {fields}")
    except Exception as e:
        print(f"Erreur d'inspection: {e}")

    # Coupons
    # On va essayer de filtrer sans date_creation pour voir si ça passe
    coupons = CouponMonnaie.objects.all()
    # On filtrera en python si besoin
    total_coupons = Decimal('0.00')
    for c in coupons:
        pass
    print(f"Total Coupons (TBC): {total_coupons}")
    
    # Ventes à crédit (En compte)
    ventes_credit = factures.filter(is_credit=True)
    total_credit = sum(f.reste_a_payer for f in ventes_credit)
    print(f"Ventes à crédit (Reste à payer): {total_credit}")
    
    # Balance
    # CA TTC doit être = Enc + Credit + Coupons + Assurances
    somme_elements = total_enc + total_credit + total_coupons + part_assurance_total
    difference = ca_ttc - somme_elements
    
    print(f"Somme des éléments identifiés: {somme_elements}")
    print(f"Différence: {difference}")
    
    if abs(difference) > 0:
        print("\nRECHERCHE DE L'ÉCART...")
        # L'ecart vient peut être des remises de coupons ?
        # Ou des factures mixtes (Cash + Crédit)
        
        # Vérifions les factures dont part_client != montant encaissé immediat
        print("\nAnomalies potentielles (Factures où part_client != somme paiements liés):")
        for f in factures:
            somme_paiements = sum(p.montant for p in f.paiements.all() if not p.is_cancelled)
            # Pour une facture au comptant, part_client doit être payé
            if not f.is_credit:
                if f.part_client != somme_paiements:
                    print(f"Facture #{f.id} ({f.numero_facture}): Part Client={f.part_client}, Payé={somme_paiements}, Diff={f.part_client - somme_paiements}")
            else:
                # Pour crédit, part_client = somme_paiements + reste_a_payer
                diff = f.part_client - (somme_paiements + f.reste_a_payer)
                if abs(diff) > 0.01:
                    print(f"Factures CRÉDIT #{f.id}: Part Client={f.part_client}, Payé={somme_paiements}, Reste={f.reste_a_payer}, Diff={diff}")

if __name__ == "__main__":
    analyze_march()
