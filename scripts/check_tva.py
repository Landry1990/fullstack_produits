
import os
import django
import sys

# Setup Django environment
sys.path.append('backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import FactureProduit, Facture
from django.db.models import Count, Q

def check_tva_inconsistency():
    print("Checking for FactureProduit with tva=0 but connected to a product with tva > 0...")
    
    # Filter: tva = 0 AND produit exists AND produit.tva > 0
    inconsistent_lines = FactureProduit.objects.filter(
        tva=0,
        produit__isnull=False,
        produit__tva__gt=0
    )
    
    count = inconsistent_lines.count()
    print(f"Found {count} inconsistent lines.")
    
    if count > 0:
        print("Sample of inconsistent lines:")
        for line in inconsistent_lines[:5]:
            print(f"  - Line ID: {line.id}, Facture: {line.facture}, Product: {line.produit.name}, Product TVA: {line.produit.tva}, Line TVA: {line.tva}")
            
    # Also check breakdown by invoice date (month)
    from django.db.models.functions import TruncMonth
    breakdown = inconsistent_lines.annotate(
        month=TruncMonth('facture__date')
    ).values('month').annotate(
        count=Count('id')
    ).order_by('month')
    
    print("\nBreakdown by month:")
    for entry in breakdown:
        month_str = entry['month'].strftime('%Y-%m') if entry['month'] else "Unknown"
        print(f"  - {month_str}: {entry['count']} lines")
        
    print("-" * 50)
    print("General Stats:")
    print(f"Total FactureProduit: {FactureProduit.objects.count()}")
    print(f"FactureProduit with tva > 0: {FactureProduit.objects.filter(tva__gt=0).count()}")
    print(f"FactureProduit with tva = 0: {FactureProduit.objects.filter(tva=0).count()}")
    print(f"Total Produit: {len(list(p for p in FactureProduit.objects.all() if p.produit))}") # inefficient but safe for now
    
    print(f"Produit with tva > 0: {django.apps.apps.get_model('api', 'Produit').objects.filter(tva__gt=0).count()}")
    
    print("-" * 50)
    print("Products in FactureProduit with tva=0:")
    zero_tva_lines = FactureProduit.objects.filter(tva=0).select_related('produit')
    product_names = set()
    for line in zero_tva_lines:
        if line.produit:
            product_names.add(f"{line.produit.name} (Ref: {line.produit.id}, ProdTVA: {line.produit.tva})")
        else:
            product_names.add(f"Unknown (Nom: {line.produit_nom})")
            
    for name in sorted(list(product_names))[:20]:
        print(f"  - {name}")
        
    print("-" * 50)
    print("Checking Discount usage:")
    discount_lines = FactureProduit.objects.filter(discount__gt=0).count()
    print(f"FactureProduit with discount > 0: {discount_lines}")
    
    if discount_lines > 0:
        sample = FactureProduit.objects.filter(discount__gt=0).first()
        print(f"Sample: Qty={sample.quantity}, Price={sample.selling_price}, Discount={sample.discount}, Total={sample.quantity * sample.selling_price}")

if __name__ == '__main__':
    check_tva_inconsistency()
