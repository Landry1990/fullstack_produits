
import os
import django
import json
import sys
from rest_framework.test import APIClient
from django.contrib.auth.models import User

# Configuration de Django
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def test_pagination():
    client = APIClient()
    
    # Créer un utilisateur si nécessaire ou utiliser un compte existant
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser(username='admin_test_temp', email='test@test.com', password='password_test')
    
    client.force_authenticate(user=user)
    
    endpoints = [
        '/api/produits/',
        '/api/factures/',
        '/api/caisses/',
        '/api/creances/',
        '/api/mouvement-caisses/',
        '/api/commandes/',
        '/api/audit-logs/',
        '/api/stock-adjustments/',
        '/api/inventaires/',
    ]
    
    results = {}
    
    print(f"{'Endpoint':\u003c40} | {'Status':\u003c10} | {'Count':\u003c10} | {'Page Size 2':\u003c15}")
    print("-" * 85)
    
    for endpoint in endpoints:
        try:
            # Test simple list
            response = client.get(endpoint)
            status_code = response.status_code
            
            if status_code == 200:
                data = response.data
                total_count = data.get('count', 0)
                
                # Test with page_size=2 to see if it's respected
                response_p2 = client.get(f"{endpoint}?page_size=2")
                if response_p2.status_code == 200:
                    results_count = len(response_p2.data.get('results', []))
                    page_size_respected = "YES (2)" if results_count == 2 or (results_count < 2 and total_count == results_count) else f"NO ({results_count})"
                else:
                    page_size_respected = f"ERR ({response_p2.status_code})"
                
                print(f"{endpoint:\u003c40} | {status_code:\u003c10} | {total_count:\u003c10} | {page_size_respected:\u003c15}")
                results[endpoint] = {'status': status_code, 'count': total_count, 'page_size_ok': page_size_respected}
            else:
                print(f"{endpoint:\u003c40} | {status_code:\u003c10} | {'-':\u003c10} | {'-':\u003c15}")
                results[endpoint] = {'status': status_code, 'error': response.data if hasattr(response, 'data') else 'N/A'}
                
        except Exception as e:
            print(f"{endpoint:\u003c40} | {'ERROR':\u003c10} | {'-':\u003c10} | {str(e)[:15]}")
            results[endpoint] = {'error': str(e)}

    # Clean up temp user
    if user.username == 'admin_test_temp':
        user.delete()

if __name__ == "__main__":
    test_pagination()
