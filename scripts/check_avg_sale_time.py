
import os
import sys
import django
from django.db.models import Min, Max, F
from django.utils import timezone
import statistics

# Setup Django environment
sys.path.append('c:/Projet Fullstack/fullstack_produits/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture

def calculate_average_sale_time():
    print("Analyse des durées de ventes...")
    
    # On cherche les factures valides ou payées
    factures = Facture.objects.filter(
        status__in=['VAL', 'PAY']
    ).prefetch_related('produits').order_by('-date')[:200]
    
    durations = []
    
    print(f"Échantillon: {factures.count()} dernières factures.")
    
    count_valid = 0
    count_instant = 0
    
    for f in factures:
        if f.produits.count() > 0:
            # Date de la facture = Fin de transaction (Validation)
            end_time = f.date
            
            # Date du premier produit ajouté = Début de transaction (théorique)
            first_product = f.produits.order_by('created_at').first()
            if first_product:
                start_time = first_product.created_at
                
                # Différence
                diff = (end_time - start_time).total_seconds()
                
                # Filtrer les aberrations
                # Si diff < 1s, c'est probablement un import ou une création instantanée API
                if diff > 1.0: 
                    durations.append(diff)
                    count_valid += 1
                    # print(f"Facture {f.numero_facture}: {diff:.1f}s ({f.produits.count()} articles)")
                else:
                    count_instant += 1
                    
    if not durations:
        print("Pas assez de données valides (durée > 1s) trouvées.")
        print(f"Factures instantanées (probablement imports/API sync): {count_instant}")
        return

    avg_time = statistics.mean(durations)
    median_time = statistics.median(durations)
    min_time = min(durations)
    max_time = max(durations)
    
    print("-" * 40)
    print(f"RÉSULTATS SUR {count_valid} VENTES (reelles)")
    print("-" * 40)
    print(f"Temps Moyen   : {avg_time:.1f} secondes ({avg_time/60:.1f} min)")
    print(f"Temps Médian  : {median_time:.1f} secondes")
    print(f"Minimum       : {min_time:.1f} secondes")
    print(f"Maximum       : {max_time:.1f} secondes")
    print("-" * 40)
    print(f"Note: {count_instant} ventes instantanées (<1s) ignorées.")

if __name__ == "__main__":
    calculate_average_sale_time()
