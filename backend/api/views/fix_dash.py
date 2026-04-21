import os

file_path = r'c:\Projet Fullstack\fullstack_produits\backend\api\views\dashboard.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern for replacing exclude(status='VAL', paiements__isnull=True)
new_content = content.replace(
    "exclude(status='VAL', paiements__isnull=True)",
    "annotate(has_paiements=Exists(Caisse.objects.filter(facture=OuterRef('pk')))).exclude(status='VAL', has_paiements=False)"
)

# And the facture_produit variant
# Wait, Exists inside OuterRef for a deep join is tricky. 
# We can just do Caisse.objects.filter(facture=OuterRef('facture_produit__facture_id'))
new_content = new_content.replace(
    "exclude(facture_produit__facture__status='VAL', facture_produit__facture__paiements__isnull=True)",
    "annotate(has_paiements=Exists(Caisse.objects.filter(facture=OuterRef('facture_produit__facture_id')))).exclude(facture_produit__facture__status='VAL', has_paiements=False)"
)

# Ensure OuterRef, Exists, Caisse are imported
imports_to_add = []
if 'from django.db.models import Exists, OuterRef' not in new_content:
    imports_to_add.append('from django.db.models import Exists, OuterRef')

if 'from ..models import Caisse' not in new_content and 'from .models import Caisse' not in new_content:
    # Actually just add it after standard django imports
    imports_to_add.append('from ..models import Caisse')

if imports_to_add:
    # Insert safely at the top after "from rest_framework" or similar
    lines = new_content.split('\n')
    insert_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('from django.db.models'):
            insert_idx = i + 1
            break
    
    lines = lines[:insert_idx] + imports_to_add + lines[insert_idx:]
    new_content = '\n'.join(lines)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Replacements done in {file_path}")
