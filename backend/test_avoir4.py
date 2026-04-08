import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils.translation import activate
activate('fr')

from rest_framework.test import APIRequestFactory, force_authenticate
from api.views.commandes.avoirs import AvoirViewSet
from django.contrib.auth.models import User

user = User.objects.first()
factory = APIRequestFactory()
view = AvoirViewSet.as_view({'post': 'create'})

# Simulate frontend payload where fournisseur might be string 'NaN' or empty?
tests = [
    {"desc": "Invalid fournisseur ID", "data": {"fournisseur": 9999, "type_avoir": "PERIME"}},
    {"desc": "Invalid string type for fournisseur", "data": {"fournisseur": "NaN", "type_avoir": "PERIME"}},
    {"desc": "Invalid type_avoir choices", "data": {"fournisseur": 1, "type_avoir": "INVALID"}},
    {"desc": "Missing type_avoir", "data": {"fournisseur": 1}},
]

results = []
for t in tests:
    try:
        req = factory.post('/api/avoirs/', t["data"], format='json')
        force_authenticate(req, user=user)
        resp = view(req)
        resp.render()
        results.append({
            "desc": t["desc"],
            "status": resp.status_code,
            "len": len(resp.content),
            "content": resp.content.decode('utf-8')
        })
    except Exception as e:
         results.append({"desc": t["desc"], "error": str(e)})

with open("test_results2.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
