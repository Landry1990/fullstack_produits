import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_api_create_ayant_droit():
    print("Testing API...")
    
    # 1. Create a client first (Need auth for this? No, I only changed AyantDroitViewSet)
    # So I need to pick an existing client ID.
    # I'll assume client ID 1 exists (from my previous script or existing data).
    # Or I can try to list clients if I had access.
    
    # Let's try to create an AyantDroit for Client ID 1.
    # If Client 1 doesn't exist, it will fail with 400.
    
    client_id = 1 
    
    payload = {
        "client": client_id,
        "matricule": "API_TEST_MAT",
        "nom": "API Test Beneficiary"
    }
    
    print(f"Sending POST to {BASE_URL}/ayants-droit/ with payload: {payload}")
    
    try:
        response = requests.post(f"{BASE_URL}/ayants-droit/", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 201:
            print("SUCCESS: Ayant Droit created via API.")
        else:
            print("FAILURE: Could not create Ayant Droit.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_api_create_ayant_droit()
