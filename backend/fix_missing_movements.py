import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.stock import MouvementStock
from api.models.billing import Facture, FactureProduit
from django.db import transaction

def fix_missing_movements():
    print("--- Restoring Missing Stock Movements for Valid Invoices ---")
    
    # We look for all products in validated invoices that don't have a SORTIE movement
    valid_statuses = ['VALIDE', 'PAY', 'PARTIEL']
    lines = FactureProduit.objects.filter(facture__status__in=valid_statuses).select_related('facture', 'produit', 'facture__client')
    
    created_count = 0
    with transaction.atomic():
        for l in lines:
            # Check if a movement already exists
            exists = MouvementStock.objects.filter(
                facture=l.facture, 
                produit=l.produit, 
                type_mouvement='SORTIE'
            ).exists()
            
            if not exists:
                print(f"Creating missing movement for Product {l.produit_id} in Facture {l.facture.numero_facture} (ID {l.facture_id})")
                
                # Create the movement
                client_name = l.facture.client.name if l.facture.client else "Clients Divers"
                description = f"Vente Facture #{l.facture.numero_facture} - Client: {client_name}"
                
                MouvementStock.objects.create(
                    produit=l.produit,
                    produit_nom=l.produit.name if l.produit else l.produit_nom,
                    facture=l.facture,
                    type_mouvement='SORTIE',
                    quantite=-l.quantity, # Negative for sale
                    description=description,
                    user=l.facture.created_by,
                    date=l.facture.date
                    # Note: stock_apres might be tricky to calculate perfectly for historical data, 
                    # but the system usually handles it on current movements.
                )
                created_count += 1

    print(f"\nSuccessfully restored {created_count} missing movements.")

if __name__ == "__main__":
    fix_missing_movements()
