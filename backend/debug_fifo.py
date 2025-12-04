import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Commande, StockLot, Facture, FactureProduitAllocation, Produit

def debug_fifo():
    print("--- DEBUG FIFO ---")
    
    # 1. Check Last Command
    last_commande = Commande.objects.order_by('-date').first()
    if not last_commande:
        print("Aucune commande trouvée.")
        return

    print(f"Dernière Commande: ID={last_commande.id}, Status={last_commande.status}, Date={last_commande.date}")
    print(f"Fournisseur: {last_commande.fournisseur.name}")
    
    for item in last_commande.produits.all():
        print(f"  - Produit: {item.produit.name} (ID: {item.produit.id}), Qte: {item.quantity}")
        
        # Check StockLot for this item
        lots = StockLot.objects.filter(commande_produit=item)
        if lots.exists():
            for lot in lots:
                print(f"    -> Lot créé: ID={lot.id}, Qte Init={lot.quantity_initial}, Reste={lot.quantity_remaining}, Date Recep={lot.date_reception}")
        else:
            print("    -> ⚠️ AUCUN LOT CRÉÉ pour ce produit !")

    # 2. Check Last Invoice
    last_facture = Facture.objects.order_by('-date').first()
    if not last_facture:
        print("\nAucune facture trouvée.")
        return

    print(f"\nDernière Facture: ID={last_facture.id}, Status={last_facture.status}, Date={last_facture.date}")
    
    for item in last_facture.produits.all():
        print(f"  - Produit: {item.produit.name} (ID: {item.produit.id}), Qte: {item.quantity}")
        
        # Check Allocations
        allocs = FactureProduitAllocation.objects.filter(facture_produit=item)
        if allocs.exists():
            for alloc in allocs:
                print(f"    -> Allocation: Lot ID={alloc.stock_lot.id}, Qte={alloc.quantity}, Fournisseur={alloc.stock_lot.fournisseur.name}")
        else:
            print("    -> ⚠️ AUCUNE ALLOCATION (Pas de traçabilité fournisseur)")
            
            # Check available lots for this product
            avail_lots = StockLot.objects.filter(produit=item.produit, quantity_remaining__gt=0)
            print(f"       Lots disponibles pour ce produit: {avail_lots.count()}")
            for l in avail_lots:
                 print(f"       - Lot ID={l.id}, Reste={l.quantity_remaining}, Date={l.date_reception}")

if __name__ == "__main__":
    debug_fifo()
