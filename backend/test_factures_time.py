import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from django.utils import timezone
from datetime import timedelta

start_dt = timezone.now().replace(hour=0, minute=0, second=0)
factures = Facture.objects.filter(date__gte=start_dt)
print("Factures today:")
for f in factures:
    print(f"Facture {f.id} at {f.date.strftime('%Y-%m-%d %H:%M:%S')} (UTC) - local: {timezone.localtime(f.date).strftime('%Y-%m-%d %H:%M:%S')}")
