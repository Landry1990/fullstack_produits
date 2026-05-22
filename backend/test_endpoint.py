import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.urls import resolve
from rest_framework.test import APIRequestFactory
from api.views.ventes.factures import FactureViewSet

try:
    match = resolve('/api/factures/mobile/')
    print("Match view name:", match.view_name)
    print("Match route:", match.route)
    print("Match kwargs:", match.kwargs)
except Exception as e:
    print("Error resolving:", e)

# Test POST request directly on ViewSet
try:
    factory = APIRequestFactory()
    request = factory.post('/api/factures/mobile/', data={})
    # Set dummy user
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.filter(is_superuser=True).first()
    request.user = user
    
    view = FactureViewSet.as_view({'post': 'sync_mobile'})
    response = view(request)
    print("Response status:", response.status_code)
    print("Response data:", response.data)
except Exception as e:
    print("Error running view:", e)
