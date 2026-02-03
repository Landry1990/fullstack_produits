
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Promis

def list_promis():
    print("--- Analysis of Promis Table ---")
    promis_list = Promis.objects.all().order_by('-date_promis')
    
    count = promis_list.count()
    print(f"Total Promis found: {count}")
    
    if count == 0:
        print("No Promis entries found.")
        return

    print(f"{'ID':<5} | {'Date':<19} | {'Client':<25} | {'Produit':<30} | {'Qté':<5} | {'Status':<10}")
    print("-" * 105)
    
    for p in promis_list:
        client_display = p.client_name[:25] if p.client_name else (p.client.name[:25] if p.client else "N/A")
        produit_display = p.produit.name[:30] if p.produit else (p.produit_nom[:30] if p.produit_nom else "N/A")
        date_display = p.date_promis.strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"{p.id:<5} | {date_display:<19} | {client_display:<25} | {produit_display:<30} | {p.quantite:<5} | {p.status:<10}")

if __name__ == "__main__":
    list_promis()
