import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Ordonnancier, LigneOrdonnancier

def check_ordonnancier():
    print("=== Checking Ordonnancier Table ===")
    count = Ordonnancier.objects.count()
    print(f"Total Ordonnancier entries: {count}")
    
    if count > 0:
        print("\nLast 5 entries:")
        entries = Ordonnancier.objects.all().order_by('-numero_ordre')[:5]
        for entry in entries:
            print(f"ID: {entry.numero_ordre} | Patient: {entry.patient_nom} | Date: {entry.date_delivrance}")
            print(f"  Facture ID: {entry.facture_id if entry.facture else 'None'}")
            
            lignes = entry.lignes.all()
            print(f"  Lignes ({lignes.count()}):")
            for ligne in lignes:
                print(f"    - {ligne.produit_nom} (Qty: {ligne.quantite}, Surv: {ligne.surveillance_category})")
            print("-" * 30)
    else:
        print("No entries found.")

if __name__ == '__main__':
    check_ordonnancier()
