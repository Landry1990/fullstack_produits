import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Now import after setup
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from api.models import StockAdjustment
from django.conf import settings

# Allow testserver
settings.ALLOWED_HOSTS.append('testserver')

def run_test():
    client = APIClient()
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("No superuser found")
        return
        
    client.force_authenticate(user=user)
    
    # Test page 1
    print("Testing /api/stock-adjustments/?page=1&page_size=20")
    response = client.get('/api/stock-adjustments/', {'page': 1, 'page_size': 20})
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.data
        print(f"Count: {data.get('count')}")
        print(f"Results len: {len(data.get('results', []))}")
        print(f"Next: {data.get('next')}")
    else:
        print(f"Content: {response.content.decode('utf-8')}")
        
    # Test page 2
    print("\nTesting /api/stock-adjustments/?page=2&page_size=20")
    response = client.get('/api/stock-adjustments/', {'page': 2, 'page_size': 20})
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.data
        print(f"Results len: {len(data.get('results', []))}")
    else:
        print(f"Content: {response.content.decode('utf-8') if response.status_code != 404 else response.data}")

if __name__ == "__main__":
    run_test()
