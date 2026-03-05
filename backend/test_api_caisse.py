import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from django.utils import timezone

c = Client(SERVER_NAME='127.0.0.1')
superusers = User.objects.filter(is_superuser=True)
if not superusers.exists():
    print("No superuser found")
    exit(1)
c.force_login(superusers.first())

date_str = timezone.now().strftime('%Y-%m-%d')
date_debut = f"{date_str}T00:00:00"
date_fin = f"{date_str}T23:59:59"

print(f"Testing with date_debut={date_debut}, date_fin={date_fin}")
res = c.get(f'/api/factures/caisse_par_tranche_horaire/?date_debut={date_debut}&date_fin={date_fin}')

print(f"Response ({res.status_code}):")
print(res.json() if res.status_code == 200 else res.content)
