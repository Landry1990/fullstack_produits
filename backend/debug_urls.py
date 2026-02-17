import os
import django
from django.conf import settings
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.urls import router

print("Printing URLs for router:")
for url in router.urls:
    if 'caisse' in str(url.pattern):
        print(url.pattern)

print("\nFull breakdown for caisse:")
from api.views import CaisseViewSet
from rest_framework.routers import SimpleRouter
r = SimpleRouter()
r.register('caisse', CaisseViewSet, basename='caisse')
for url in r.urls:
    print(f"{url.name}: {url.pattern}")
    if 'cloturer' in str(url.pattern):
        print("FOUND CLOTURER!")

print("\nInspecting CaisseViewSet class:")
try:
    print(f"Has cloturer: {hasattr(CaisseViewSet, 'cloturer')}")
    if hasattr(CaisseViewSet, 'cloturer'):
        cloturer_func = getattr(CaisseViewSet, 'cloturer')
        print(f"cloturer attributes: {dir(cloturer_func)}")
        print(f"bind_to_methods: {getattr(cloturer_func, 'bind_to_methods', 'N/A')}")
        print(f"detail: {getattr(cloturer_func, 'detail', 'N/A')}")
        print(f"url_path: {getattr(cloturer_func, 'url_path', 'N/A')}")
except Exception as e:
    print(f"Error inspecting class: {e}")
