import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rest_framework.routers import DefaultRouter
from api.urls import router

print("=== Routes enregistrées dans le Router ===")
for prefix, viewset, basename in router.registry:
    print(f"  - {prefix:30} | {viewset.__name__:30} | {basename}")

print(f"\nTotal: {len(router.registry)} routes")

# Vérifier si stats-ug est présent
stats_ug_present = any(prefix == 'stats-ug' for prefix, _, _ in router.registry)
print(f"\n'stats-ug' présent: {stats_ug_present}")

if stats_ug_present:
    # Trouver le ViewSet
    for prefix, viewset, basename in router.registry:
        if prefix == 'stats-ug':
            print(f"\nViewSet trouvé: {viewset}")
            print(f"Actions disponibles:")
            for attr in dir(viewset):
                if hasattr(getattr(viewset, attr), 'mapping'):
                    print(f"  - {attr}")
