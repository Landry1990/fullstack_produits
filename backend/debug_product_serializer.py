import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit
from api.serializers_optimized import ProduitDetailSerializer

print("Starting serialization test with ProduitDetailSerializer...")

try:
    # Try with ALL products or a larger batch since the user might be searching anything
    # And specifically look for recently added/modified ones if ordered by id desc
    produits = Produit.objects.all().order_by('-id')[:100]
    
    print(f"Testing {produits.count()} products...")
    
    for p in produits:
        try:
           # print(f"Serializing Product ID: {p.id}")
            data = ProduitDetailSerializer(p).data
            # print(f"Success: {p.id}")
        except Exception as e:
            print(f"CRITICAL ERROR on Product {p.id} ({p.name}): {str(e)}")
            import traceback
            traceback.print_exc()
            break
            
    print("Test finished.")
except Exception as e:
    print(f"General Error: {e}")
