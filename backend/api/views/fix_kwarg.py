import re

file_path = r'c:\Projet Fullstack\fullstack_produits\backend\api\views\dashboard.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix positional argument following keyword argument
content = content.replace(
    "exclude(status='VAL', ~Q(id__in=Caisse.objects.values('facture_id')))",
    "exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL')"
)

content = content.replace(
    "exclude(facture_produit__facture__status='VAL', ~Q(facture_produit__facture_id__in=Caisse.objects.values('facture_id')))",
    "exclude(~Q(facture_produit__facture_id__in=Caisse.objects.values('facture_id')), facture_produit__facture__status='VAL')"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed SyntaxError order')
