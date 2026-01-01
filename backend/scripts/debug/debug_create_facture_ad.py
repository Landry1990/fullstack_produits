
import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Client, AyantDroit, Facture
from api.serializers import FactureSerializer, ClientSerializer
from django.contrib.auth.models import User

def test_facture_creation_with_ad():
    print("--- Testing Facture Creation with Ayant Droit ---")
    
    # 1. Setup Data: Client and Ayant Droit
    client_data = {
        "name": "Test Client Facture",
        "client_type": "PROFESSIONNEL",
        "phone": "111222333",
        "address": "Test Address",
        "email": "test@example.com",
        "plafond": "100000"
    }
    client_s = ClientSerializer(data=client_data)
    if client_s.is_valid():
        client = client_s.save()
    else:
        # Get existing if exists
        client = Client.objects.filter(name="Test Client Facture").first()
        if not client:
             print("Error creating client", client_s.errors)
             return

    ad, created = AyantDroit.objects.get_or_create(
        client=client,
        matricule="TEST_MAT_FAC",
        defaults={"nom": "Test Beneficiary Facture"}
    )
    
    print(f"Client ID: {client.id}")
    print(f"Ayant Droit ID: {ad.id}")

    # 2. Test Direct Creation
    print("\nAttempting to create Facture WITH ayant_droit in payload...")
    payload = {
        "client": client.id,
        "ayant_droit": ad.id,
        "status": "BROU",
        "remise": "0",
        "tva": "0"
    }
    
    serializer = FactureSerializer(data=payload)
    if serializer.is_valid():
        facture = serializer.save()
        print(f"Facture Created: {facture.id}")
        print(f"Facture Ayant Droit: {facture.ayant_droit}")
        
        if facture.ayant_droit == ad:
            print("SUCCESS: Facture linked to Ayant Droit on creation.")
        else:
            print("FAILURE: Facture created but Ayant Droit link missing.")
            
        facture.delete()
    else:
        print("Validation Error:", serializer.errors)

    # Cleanup
    # ad.delete()
    # client.delete()

if __name__ == "__main__":
    test_facture_creation_with_ad()
