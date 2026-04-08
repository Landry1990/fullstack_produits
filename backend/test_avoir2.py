import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from api.views.commandes.avoirs import AvoirViewSet
from django.contrib.auth.models import User

user = User.objects.first()
factory = APIRequestFactory()
view = AvoirViewSet.as_view({'post': 'create'})

tests = [
    {"desc": "Empty payload", "data": {}},
    {"desc": "Null fournisseur", "data": {"fournisseur": None, "type_avoir": "PERIME"}},
    {"desc": "Invalid type_avoir", "data": {"fournisseur": 1, "type_avoir": "INVALID_X"}},
    {"desc": "Valid", "data": {"fournisseur": 1, "type_avoir": "PERIME"}},
]

for t in tests:
    req = factory.post('/api/avoirs/', t["data"], format='json')
    force_authenticate(req, user=user)
    resp = view(req)
    resp.render()
    print(f"--- {t['desc']} ---")
    print("Status:", resp.status_code)
    print("Len:", len(resp.content))
    print("Content:", resp.content)
