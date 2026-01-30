import os
import sys
import django
from datetime import datetime
from decimal import Decimal

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils.timezone import make_aware
from django.db.models import Q
from api.models import Facture

def list_january_unattributed():
    print("--- Extraction des ventes non attribuées (Janvier 2026) ---")
    
    # Dates
    start_date = make_aware(datetime(2026, 1, 1))
    end_date = make_aware(datetime(2026, 2, 1)) 
    
    # Filtres: Janvier AND (No Creator OR Caissier)
    factures = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        date__gte=start_date,
        date__lt=end_date
    ).filter(
        Q(created_by__isnull=True) | 
        Q(created_by__profile__role='CAISSIER')
    ).select_related('created_by', 'created_by__profile').order_by('date')
    
    output_file = 'ventes_non_attribuees_janvier_2026.txt'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("LISTE DES VENTES NON ATTRIBUÉES - JANVIER 2026\n")
        f.write("===============================================\n")
        f.write(f"Généré le: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n")
        f.write(f"{'DATE':<20} | {'NUMÉRO':<20} | {'VENDEUR':<20} | {'MONTANT':>12}\n")
        f.write("-" * 80 + "\n")
        
        total_amount = Decimal('0.00')
        count = 0
        
        for fact in factures:
            date_str = fact.date.strftime('%d/%m/%Y %H:%M')
            num = fact.numero_facture or f"(ID: {fact.id})"
            
            vendeur = "SYSTEME/IMPORT"
            if fact.created_by:
                vendeur = f"{fact.created_by.username} (Caissier)"
                
            line = f"{date_str:<20} | {num:<20} | {vendeur:<20} | {int(fact.total_ttc):,} F".replace(',', ' ')
            
            f.write(line + "\n")
            
            total_amount += fact.total_ttc
            count += 1
            
        f.write("-" * 80 + "\n")
        f.write(f"TOTAL: {count} factures\n")
        f.write(f"MONTANT TOTAL: {int(total_amount):,} F".replace(',', ' ') + "\n")
        
    print(f"Extraction terminée. {count} factures trouvées.")
    print(f"Fichier généré : {os.path.abspath(output_file)}")

if __name__ == "__main__":
    list_january_unattributed()
