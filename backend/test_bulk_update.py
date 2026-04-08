import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import CommandeProduit

cp = CommandeProduit.objects.filter(id=1498).first()
cp.lot = "TEST_UPDATE"
CommandeProduit.objects.bulk_update([cp], ['lot'])
print(f"Updated lot to {cp.lot}")

# Verify 
cp2 = CommandeProduit.objects.filter(id=1498).first()
print(f"Verified lot from DB: {cp2.lot}")
