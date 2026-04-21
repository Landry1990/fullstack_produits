import re

file_path = r'c:\Projet Fullstack\fullstack_produits\backend\api\views\dashboard.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Facture ... has_paiements=False
p1 = r"\.(?:annotate|alias)\(has_paiements=Exists\(Caisse\.objects\.filter\(facture=OuterRef\('pk'\)\)\)\)\.exclude\(status='VAL', has_paiements=False\)"
content = re.sub(p1, ".exclude(status='VAL', ~Q(id__in=Caisse.objects.values('facture_id')))", content)

p2 = r"\.(?:annotate|alias)\(has_paiements=Exists\(Caisse\.objects\.filter\(facture=OuterRef\('facture_produit__facture_id'\)\)\)\)\.exclude\(facture_produit__facture__status='VAL', has_paiements=False\)"
content = re.sub(p2, ".exclude(facture_produit__facture__status='VAL', ~Q(facture_produit__facture_id__in=Caisse.objects.values('facture_id')))", content)

# Remove the Exists, OuterRef imports if they are unused (optional, Django won't throw if unused except lint warnings)
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Optimized dashboard.py with id__in instead of Exists')
