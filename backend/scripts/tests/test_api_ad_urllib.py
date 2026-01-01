import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_api_create_ayant_droit():
    print("Testing API with urllib...")
    
    client_id = 1 
    
    payload = {
        "client": client_id,
        "matricule": "API_TEST_MAT_URLLIB",
        "nom": "API Test Beneficiary Urllib"
    }
    
    data = json.dumps(payload).encode('utf-8')
    
    req = urllib.request.Request(f"{BASE_URL}/ayants-droit/", data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status Code: {response.status}")
            print(f"Response: {response.read().decode('utf-8')}")
            
            if response.status == 201:
                print("SUCCESS: Ayant Droit created via API.")
            else:
                print("FAILURE: Could not create Ayant Droit.")
            
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(f"Error Content: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_api_create_ayant_droit()
