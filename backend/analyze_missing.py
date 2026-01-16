import csv
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from api.models import Produit

# Lire le CSV
with open('UBIPHARM_traite_clean.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

# Recuperer tous les CIP de la base
db_cip1 = set(Produit.objects.exclude(cip1__isnull=True).exclude(cip1='').values_list('cip1', flat=True))
db_cip2 = set(Produit.objects.exclude(cip2__isnull=True).exclude(cip2='').values_list('cip2', flat=True))
db_cip3 = set(Produit.objects.exclude(cip3__isnull=True).exclude(cip3='').values_list('cip3', flat=True))
db_names = set(n.upper() for n in Produit.objects.values_list('name', flat=True))

# Analyser les lignes du CSV qui ne correspondent a rien en base
missing_count = 0
for i, row in enumerate(rows[1:], start=2):
    if len(row) < 7:
        continue
    cip1 = row[0].strip()
    cip2 = row[1].strip()
    cip3 = row[2].strip()
    name = row[3].strip().upper()
    
    # Verifier si au moins un des identifiants existe
    found = False
    if cip1 and cip1 != '0' and cip1 in db_cip1:
        found = True
    if not found and cip2 and cip2 != '0' and cip2 in db_cip2:
        found = True
    if not found and cip3 and cip3 != '0' and cip3 in db_cip3:
        found = True
    if not found and name in db_names:
        found = True
    
    if not found:
        missing_count += 1
        if missing_count <= 10:
            print(f"L{i}: CIP1={cip1}, CIP2={cip2}, CIP3={cip3}, Nom={row[3][:40]}")

print(f"\nTotal lignes du CSV sans correspondance en base: {missing_count}")
