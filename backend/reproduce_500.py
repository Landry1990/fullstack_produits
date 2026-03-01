import os
import django
import sys
import json

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit
from api.serializers import ProduitSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
request = factory.patch('/api/produits/8/')

print("Attempting to reproduce 500 error on Product 8...")

try:
    p = Produit.objects.get(pk=8)
    # Payload similar to what frontend sends
    payload = {
        "name": p.name,
        "has_reserve_storage": True,
        "capacite_rayon": 50,
        "min_rayon": 10
    }
    
    print(f"Updating product {p.id} with payload: {payload}")
    
    serializer = ProduitSerializer(p, data=payload, partial=True, context={'request': request})
    if serializer.is_valid():
        print("Serializer is valid. Saving...")
        instance = serializer.save()
        print(f"Save success! Updated product: {instance.name}")
    else:
        print(f"Validation Error: {serializer.errors}")

except Exception as e:
    print(f"CRASH DETECTED: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
