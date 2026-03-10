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
print("--- REQUEST PAGE 2, SIZE 20 ---")
r2 = client.get('/api/stock-adjustments/', {'page': 2, 'page_size': 20})
print(f"Status: {r2.status_code}")
if r2.status_code == 200:
    print(f"Results len: {len(r2.data.get('results', []))}")
else:
    print(f"Error P2: {r2.status_code} - {r2.data}")
