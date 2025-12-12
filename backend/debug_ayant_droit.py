import os
import django
import sys

# Setup Django environment
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Client, AyantDroit
from api.serializers import ClientSerializer
from rest_framework.test import APIRequestFactory

def test_ayant_droit_flow():
    print("--- Starting Ayant Droit Flow Test ---")
    
    # 1. Create Client with 1 AD
    print("\n1. Creating Client with 1 Ayant Droit...")
    data_create = {
        "name": "Test Client Pro",
        "phone": "0000000001",
        "email": "testpro@example.com",
        "address": "Test Address",
        "client_type": "PROFESSIONNEL",
        "plafond": "100000",
        "ayants_droit": [
            {"matricule": "MAT001", "nom": "Beneficiary 1", "societe": "Soc 1"}
        ]
    }
    
    serializer = ClientSerializer(data=data_create)
    if serializer.is_valid():
        client = serializer.save()
        print(f"Client Created: {client.id}")
        ads = client.ayants_droit.all()
        print(f"Ayants Droit count: {ads.count()}")
        for ad in ads:
            print(f" - {ad.nom} (ID: {ad.id})")
    else:
        print("Create Validation Error:", serializer.errors)
        return

    # 2. Update Client: Add a SECOND AD
    print("\n2. Updating Client: Adding a 2nd Ayant Droit...")
    # We must construct the payload like the frontend does:
    # It sends existing items (WITH IDs) and new items (WITHOUT IDs)
    
    current_ads_data = ClientSerializer(client).data['ayants_droit']
    # Add a new one to the list
    new_ad_data = {"matricule": "MAT002", "nom": "Beneficiary 2", "societe": "Soc 2"}
    update_payload = {
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "address": client.address,
        "client_type": client.client_type,
        "plafond": client.plafond,
        "ayants_droit": current_ads_data + [new_ad_data]
    }
    
    serializer_update = ClientSerializer(client, data=update_payload)
    if serializer_update.is_valid():
        client = serializer_update.save()
        print(f"Client Updated.")
        ads = client.ayants_droit.all()
        print(f"Ayants Droit count: {ads.count()}")
        for ad in ads:
            print(f" - {ad.nom} (ID: {ad.id})")
            
        if ads.count() != 2:
            print("FAILURE: Expected 2 Ayants Droit.")
    else:
        print("Update Validation Error:", serializer_update.errors)

    # 3. Verify Deletion (Optional, but good to check)
    print("\n3. Updating Client: Removing the 1st Ayant Droit...")
    # Keep only the last one (which should now have an ID)
    # We need to re-fetch to get the ID of the second one
    refresh_data = ClientSerializer(client).data['ayants_droit']
    last_ad = refresh_data[-1]
    
    update_payload_delete = update_payload.copy()
    update_payload_delete['ayants_droit'] = [last_ad] # Only keep the second one
    
    serializer_delete = ClientSerializer(client, data=update_payload_delete)
    if serializer_delete.is_valid():
        client = serializer_delete.save()
        print(f"Client Updated (Deletion).")
        ads = client.ayants_droit.all()
        print(f"Ayants Droit count: {ads.count()}")
        for ad in ads:
             print(f" - {ad.nom} (ID: {ad.id})")
        
        if ads.count() != 1:
             print("FAILURE: Expected 1 Ayant Droit.")
        else:
            print("SUCCESS: Deletion worked.")

    # 4. Verify Final Serialization
    print("\n4. Verifying Final Serialization (API Response Simulation)...")
    final_data = ClientSerializer(client).data
    import json
    print(json.dumps(final_data, indent=2, default=str)) # default=str for decimals/dates

    # Cleanup
    print("\nCleaning up...")
    client.delete()
    print("Done.")

if __name__ == "__main__":
    try:
        test_ayant_droit_flow()
    except Exception as e:
        print(f"An error occurred: {e}")
