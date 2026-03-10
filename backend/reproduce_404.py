import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Now import after setup
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from api.models import StockAdjustment

def run_test():
    client = APIClient()
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("No superuser found")
        return
        
    client.force_authenticate(user=user)
    
    # Test page 2
    print("Testing /api/stock-adjustments/?page=2&page_size=20")
    response = client.get('/api/stock-adjustments/', {'page': 2, 'page_size': 20})
    print(f"Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Content: {response.content.decode('utf-8')}")
    else:
        print(f"Count in response: {response.data.get('count')}")
        print(f"Number of results: {len(response.data.get('results', []))}")
        
    # Test total count directly
    actual_count = StockAdjustment.objects.count()
    print(f"Actual StockAdjustment count in DB: {actual_count}")

if __name__ == "__main__":
    run_test()
