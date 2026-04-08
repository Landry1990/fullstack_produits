import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings') # or whatever the settings is
django.setup()

from api.serializers import AvoirSerializer

data = {
    "fournisseur": 1,
    "type_avoir": "PERIME",
    "observations": "Test observation"
}

serializer = AvoirSerializer(data=data)
print("Is valid:", serializer.is_valid())
if not serializer.is_valid():
    print("Errors:", serializer.errors)
