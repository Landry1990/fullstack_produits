import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from django.conf import settings
settings.ALLOWED_HOSTS.append('testserver')
client = APIClient()
user = User.objects.filter(is_superuser=True).first()
client.force_authenticate(user=user)
print("--- REQUEST PAGE 1, SIZE 20 ---")
r1 = client.get('/api/stock-adjustments/', {'page': 1, 'page_size': 20})
if r1.status_code == 200:
    print(f"Count: {r1.data.get('count')}")
    print(f"Results len: {len(r1.data.get('results', []))}")
    print(f"Next: {r1.data.get('next')}")
else:
    print(f"Error P1: {r1.status_code}")

print("\n--- REQUEST PAGE 1, SIZE 10 ---")
r1_10 = client.get('/api/stock-adjustments/', {'page': 1, 'page_size': 10})
if r1_10.status_code == 200:
    print(f"Results len: {len(r1_10.data.get('results', []))}")
else:
    print(f"Error P1_10: {r1_10.status_code}")
