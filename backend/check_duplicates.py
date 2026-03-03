import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings') # Adjust if necessary
django.setup()

from api.models import Facture
from django.db.models import Count

duplicates = Facture.objects.values('numero_facture').annotate(count=Count('id')).filter(count__gt=1)

print(f"Found {len(duplicates)} duplicate invoice numbers:")
for d in duplicates:
    num = d['numero_facture']
    count = d['count']
    print(f"\nNumber: {num} (appears {count} times)")
    factures = Facture.objects.filter(numero_facture=num).order_by('date')
    for f in factures:
        print(f"  - ID: {f.id}, Date: {f.date}, Total: {f.total_ttc}, Status: {f.get_status_display()}")

print("\nSpecific check for FAC-000219:")
factures_219 = Facture.objects.filter(numero_facture__icontains='219').order_by('date')
for f in factures_219:
    print(f"  - ID: {f.id}, Number: {f.numero_facture}, Date: {f.date}, Total: {f.total_ttc}, Status: {f.get_status_display()}")
