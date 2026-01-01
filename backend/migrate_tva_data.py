import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import FactureProduit
from decimal import Decimal

print('=' * 80)
print('MIGRATION DES DONNEES - TVA LIGNE PAR LIGNE')
print('=' * 80)
print()

# Récupérer toutes les lignes de facture
lignes = FactureProduit.objects.select_related('produit').all()

print(f'Nombre de lignes de facture: {lignes.count()}')
print()

updated_count = 0
skipped_count = 0

for ligne in lignes:
    if ligne.tva == Decimal('0.00') and ligne.produit:
        # Copier la TVA du produit
        ligne.tva = ligne.produit.tva
        ligne.save(update_fields=['tva'])
        updated_count += 1
        
        if updated_count <= 5:  # Afficher les 5 premières
            print(f'Ligne {ligne.id}: TVA mise à jour à {ligne.tva}% (produit: {ligne.produit.name})')
    else:
        skipped_count += 1

print()
print('=' * 80)
print(f'Migration terminée:')
print(f'  - Lignes mises à jour: {updated_count}')
print(f'  - Lignes ignorées: {skipped_count}')
print('=' * 80)
