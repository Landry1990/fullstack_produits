import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from django.contrib.auth.models import User
from api.models import Commande
from api.views.commandes import CommandeViewSet

def test_retrieve_orphan_order():
    # 1. Get a superuser
    user = User.objects.filter(is_superuser=True).first()
    
    # 2. Test retrieve order #150
    factory = RequestFactory()
    view = CommandeViewSet.as_view({'get': 'retrieve'})
    request = factory.get('/api/commandes/150/')
    force_authenticate(request, user=user)
    
    try:
        response = view(request, pk=150)
        print(f"Retrieve Status for Order #150: {response.status_code}")
        if response.status_code == 200:
            print("SUCCESS: Order #150 retrieved successfully despite orphan items")
            # print(json.dumps(response.data, indent=2))
        else:
            print(f"FAILURE: {response.data}")
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_retrieve_orphan_order()
