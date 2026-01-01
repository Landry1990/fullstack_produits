import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture
from decimal import Decimal

print('=' * 80)
print('RECALCUL DES TOTAUX - NOUVELLE LOGIQUE TVA LIGNE PAR LIGNE')
print('=' * 80)
print()

# Récupérer toutes les factures validées ou payées
factures = Facture.objects.filter(status__in=['VAL', 'PAY'])

print(f'Nombre de factures à recalculer: {factures.count()}')
print()

for facture in factures[:5]:  # Afficher les 5 premières
    print(f'Facture {facture.numero_facture or facture.id}:')
    print(f'  AVANT: HT={facture.total_ht}, TVA={facture.total_tva}, TTC={facture.total_ttc}')
    
    # Recalculer avec la nouvelle logique
    facture.calculate_totals(save=True)
    
    # Recharger depuis la DB
    facture.refresh_from_db()
    
    print(f'  APRES: HT={facture.total_ht}, TVA={facture.total_tva}, TTC={facture.total_ttc}')
    print()

# Recalculer toutes les autres sans affichage
remaining = factures[5:]
for facture in remaining:
    facture.calculate_totals(save=True)

print('=' * 80)
print(f'Recalcul terminé pour {factures.count()} factures')
print('=' * 80)
