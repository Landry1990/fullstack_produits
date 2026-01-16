"""
Script pour importer les produits manquants du fichier UBIPHARM
"""
import csv
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from api.models import Produit
from decimal import Decimal

# Lire le CSV
with open('UBIPHARM_traite_clean.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

print(f"Total lignes CSV: {len(rows) - 1}")

# Recuperer tous les identifiants existants
db_cip1 = set(Produit.objects.exclude(cip1__isnull=True).exclude(cip1='').values_list('cip1', flat=True))
db_cip2 = set(Produit.objects.exclude(cip2__isnull=True).exclude(cip2='').values_list('cip2', flat=True))
db_cip3 = set(Produit.objects.exclude(cip3__isnull=True).exclude(cip3='').values_list('cip3', flat=True))
db_names = set(n.upper() for n in Produit.objects.values_list('name', flat=True))

print(f"Produits existants: {Produit.objects.count()}")

created = 0
errors = []

for i, row in enumerate(rows[1:], start=2):
    if len(row) < 7:
        continue
    
    cip1 = row[0].strip()
    cip2 = row[1].strip() 
    cip3 = row[2].strip()
    name = row[3].strip()
    tvcode = row[4].strip()
    cession = row[5].strip()
    public = row[6].strip()
    
    # Nettoyer les CIP (enlever .0)
    if '.' in cip1: cip1 = cip1.split('.')[0]
    if '.' in cip2: cip2 = cip2.split('.')[0]
    if '.' in cip3: cip3 = cip3.split('.')[0]
    
    # Verifier si existe deja
    found = False
    if cip1 and cip1 != '0' and cip1 in db_cip1:
        found = True
    if not found and cip2 and cip2 != '0' and cip2 in db_cip2:
        found = True
    if not found and cip3 and cip3 != '0' and cip3 in db_cip3:
        found = True
    if not found and name.upper() in db_names:
        found = True
    
    if found:
        continue  # Deja existant
    
    # Creer le produit
    try:
        # TVA: tvcode=0 -> 0%, tvcode=2 -> 19.25%
        tva = Decimal('19.25') if tvcode == '2' else Decimal('0')
        
        cost_price = Decimal(cession) if cession else Decimal('0')
        selling_price = Decimal(public) if public else Decimal('0')
        
        Produit.objects.create(
            name=name,
            cip1=cip1 if cip1 and cip1 != '0' else None,
            cip2=cip2 if cip2 and cip2 != '0' else None,
            cip3=cip3 if cip3 and cip3 != '0' else None,
            cost_price=cost_price,
            selling_price=selling_price,
            tva=tva,
            stock=0
        )
        created += 1
        
        # Ajouter aux sets pour eviter les doublons dans ce meme import
        if cip1 and cip1 != '0': db_cip1.add(cip1)
        if cip2 and cip2 != '0': db_cip2.add(cip2)
        if cip3 and cip3 != '0': db_cip3.add(cip3)
        db_names.add(name.upper())
        
    except Exception as e:
        errors.append(f"L{i} ({name[:30]}): {str(e)}")
        if len(errors) > 50:
            break

print(f"\nProduits crees: {created}")
print(f"Erreurs: {len(errors)}")

if errors:
    print("\nPremieres erreurs:")
    for e in errors[:10]:
        print(f"  {e}")

print(f"\nTotal produits apres import: {Produit.objects.count()}")
