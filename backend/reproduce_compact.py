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
r1 = client.get('/api/stock-adjustments/', {'page': 1, 'page_size': 20})
print(f"P1: {r1.status_code}, count: {r1.data.get('count') if r1.status_code==200 else 'N/A'}")
r2 = client.get('/api/stock-adjustments/', {'page': 2, 'page_size': 20})
print(f"P2: {r2.status_code}")
if r2.status_code != 200:
    print(f"P2 Error: {r2.data}")
