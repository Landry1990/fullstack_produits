import os
import django
from django.test import RequestFactory
from api.ordonnancier_view import OrdonnancierViewSet
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Stimulate a request
factory = RequestFactory()
request = factory.get('/api/ordonnancier/')
view = OrdonnancierViewSet.as_view({'get': 'list'})

# Force authentication (bypass permission checks for test)
from django.contrib.auth.models import User
user = User.objects.first()
request.user = user

response = view(request)
print(f"Status Code: {response.status_code}")
print("Data:")
try:
    print(json.dumps(response.data, indent=2, default=str))
except:
    print(response.data)
