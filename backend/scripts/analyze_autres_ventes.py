import os
import django
import sys
from django.db.models import Sum, Count, Q
from decimal import Decimal

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture

def analyze_autres():
    print("--- Analyse des ventes 'Autres' ---")
    
    # Critères pour "Autres" : Created By Null OU Role Caissier
    factures = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
    ).select_related('created_by', 'created_by__profile')
    
    null_creator = 0
    caissier_creator = 0
    null_amount = Decimal('0.00')
    caissier_amount = Decimal('0.00')
    
    caissiers_details = {}

    for f in factures:
        if not f.created_by:
            null_creator += 1
            null_amount += f.total_ttc
        elif hasattr(f.created_by, 'profile') and f.created_by.profile.role == 'CAISSIER':
            caissier_creator += 1
            caissier_amount += f.total_ttc
            
            name = f.created_by.username
            if name not in caissiers_details:
                caissiers_details[name] = Decimal('0.00')
            caissiers_details[name] += f.total_ttc
            
    print(f"Total Factures sans créateur (Système/Import): {null_creator} - Montant: {null_amount}")
    
    # Afficher quelques exemples
    if null_creator > 0:
        examples = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            created_by__isnull=True
        ).values_list('numero_facture', 'id', 'date')[:5]
        
        print("\nExemples de factures SANS VENDEUR (Inconnu):")
        for num, fid, date in examples:
            print(f"- Facture #{num or fid} du {date.strftime('%d/%m/%Y')}")

    print(f"Total Factures créées par Caissiers: {caissier_creator} - Montant: {caissier_amount}")
    
    if caissiers_details:
        print("\nDétails Caissiers:")
        for name, amount in caissiers_details.items():
            print(f"- {name}: {amount}")

if __name__ == "__main__":
    analyze_autres()
