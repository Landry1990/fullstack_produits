
import os
import sys
import django
from decimal import Decimal

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Promis, Facture, Produit
from django.contrib.auth.models import User
from api.serializers import PromisSerializer

def test_promis_creation():
    print("--- Starting Promis Creation Verification ---")
    
    # 1. Setup Data
    user, _ = User.objects.get_or_create(username='test_admin')
    
    # Create or get a product
    produit, _ = Produit.objects.get_or_create(
        name="Test Product Promis",
        defaults={
            'stock': 0,
            'selling_price': Decimal('1000.00'),
            'cost_price': Decimal('500.00'),
            'tva': Decimal('19.25')
        }
    )
    
    # Create a dummy Facture
    facture = Facture.objects.create(
        total_ttc=Decimal('1000.00'),
        created_by=user,
        status=Facture.Status.VALIDEE,
        client_name_override="Test Manual Client"
    )
    
    print(f"Created Facture #{facture.id}")

    # 2. Simulate Payload from Frontend
    # Frontend sends: client_name from the modal input
    payload = {
        'facture': facture.id,
        'client_name': "Client From Modal",
        'client_phone': "07000000",
        'produit': produit.id,
        'quantite': 5,
        'status': 'ATT',
        'created_by': user.id
    }
    
    print(f"Testing Payload: {payload}")

    # 3. Test Serializer Validation & Save
    serializer = PromisSerializer(data=payload)
    if serializer.is_valid():
        promis = serializer.save()
        print(f"SUCCESS: Promis created with ID {promis.id}")
        print(f"  - Client Name: {promis.client_name}")
        print(f"  - Phone: {promis.client_phone}")
        print(f"  - Product: {promis.produit.name}")
        print(f"  - Status: {promis.status}")
        
        if promis.client_name == "Client From Modal":
             print("VERIFICATION PASSED: client_name was correctly saved.")
        else:
             print(f"VERIFICATION FAILED: Expected 'Client From Modal', got '{promis.client_name}'")

        # Cleanup
        promis.delete()
        facture.delete()
        # We assume product can stay or be deleted if strictly needed.
    else:
        print("ERROR: Serializer Validation Failed")
        print(serializer.errors)

if __name__ == "__main__":
    test_promis_creation()
