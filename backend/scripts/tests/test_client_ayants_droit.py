import requests
import json

# URL de base de l'API
BASE_URL = "http://127.0.0.1:8000"

# Authentification (remplacez par vos identifiants)
print("Veuillez entrer vos identifiants:")
username = input("Username: ")
password = input("Password: ")

# 1. Obtenir le token
print("\n" + "=" * 50)
print("Authentification...")
print("=" * 50)

auth_response = requests.post(f"{BASE_URL}/api/token/", json={
    "username": username,
    "password": password
})

if auth_response.status_code != 200:
    print(f"❌ Erreur d'authentification: {auth_response.status_code}")
    print(auth_response.text)
    exit(1)

token = auth_response.json().get('token')
print(f"✅ Token obtenu: {token[:20]}...")

headers = {
    'Authorization': f'Token {token}'
}

# 2. Récupérer la liste des clients
print("\n" + "=" * 50)
print("TEST: Récupération des clients")
print("=" * 50)

response = requests.get(f"{BASE_URL}/api/clients/", headers=headers)
if response.status_code == 200:
    clients = response.json()
    print(f"✅ Nombre de clients: {len(clients)}")
    
    # Chercher un client professionnel
    for client in clients:
        if client.get('client_type') == 'PROFESSIONNEL':
            print(f"\n📋 Client professionnel trouvé: {client['name']} (ID: {client['id']})")
            print(f"   Type: {client.get('client_type')}")
            print(f"   Plafond: {client.get('plafond')}")
            print(f"   Dette: {client.get('current_debt')}")
            
            # Vérifier les ayants droit
            ayants_droit = client.get('ayants_droit', [])
            print(f"   Ayants droit dans liste: {len(ayants_droit)}")
            
            if ayants_droit:
                for ad in ayants_droit:
                    print(f"      - {ad.get('nom')} (Mat: {ad.get('matricule')}, Société: {ad.get('societe', 'N/A')})")
            else:
                print("      ⚠️ Aucun ayant droit trouvé dans la liste")
            
            # Tester l'endpoint spécifique du client
            print(f"\n   Test endpoint spécifique: /api/clients/{client['id']}/")
            detail_response = requests.get(f"{BASE_URL}/api/clients/{client['id']}/", headers=headers)
            if detail_response.status_code == 200:
                detail_client = detail_response.json()
                detail_ayants = detail_client.get('ayants_droit', [])
                print(f"   ✅ Ayants droit dans détail: {len(detail_ayants)}")
                if detail_ayants:
                    for ad in detail_ayants:
                        print(f"      - {ad.get('nom')} (Mat: {ad.get('matricule')}, Société: {ad.get('societe', 'N/A')})")
                else:
                    print("      ⚠️ Aucun ayant droit dans le détail")
            
            print("\n" + "-" * 50)
else:
    print(f"❌ Erreur: {response.status_code}")
    print(response.text)

# 3. Récupérer tous les ayants droit
print("\n" + "=" * 50)
print("TEST: Récupération de tous les ayants droit")
print("=" * 50)

response = requests.get(f"{BASE_URL}/api/ayants-droit/", headers=headers)
if response.status_code == 200:
    ayants_droit = response.json()
    print(f"✅ Nombre total d'ayants droit: {len(ayants_droit)}")
    for ad in ayants_droit:
        print(f"   - ID: {ad.get('id')}, Nom: {ad.get('nom')}, Mat: {ad.get('matricule')}, Client: {ad.get('client')}, Société: {ad.get('societe', 'N/A')}")
else:
    print(f"❌ Erreur: {response.status_code}")
    print(response.text)
