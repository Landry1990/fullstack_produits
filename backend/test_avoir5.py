import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils.translation import activate
activate('fr')

# test possible errors and print their byte lengths
payloads = [
    {"fournisseur": "", "type_avoir": "PERIME"},
    {"fournisseur": None, "type_avoir": "PERIME"},
    {"fournisseur": 1, "type_avoir": ""},
    {"fournisseur": 1, "type_avoir": None},
    {"type_avoir": "PERIME"},
]

from rest_framework.test import APIRequestFactory, force_authenticate
from api.views.commandes.avoirs import AvoirViewSet
from django.contrib.auth.models import User

user = User.objects.first()
factory = APIRequestFactory()
view = AvoirViewSet.as_view({'post': 'create'})

for p in payloads:
    req = factory.post('/api/avoirs/', p, format='json')
    force_authenticate(req, user=user)
    resp = view(req)
    resp.render()
    print(p, "-> status:", resp.status_code, "len:", len(resp.content))
    if resp.status_code == 400:
        print("   Body:", resp.content)
