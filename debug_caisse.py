import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from api.models import Caisse, Facture
from django.db import connection

print('=== DEBUG CAISSE ===')

# Dernières factures
print('\n--- 5 dernières factures ---')
factures = Facture.objects.filter(status='VALIDEE').order_by('-id')[:5]
for f in factures:
    paiements = Caisse.objects.filter(facture=f)
    total_paiements = sum([p.montant for p in paiements])
    print(f'Facture {f.id}: {f.numero_facture or "N/A"} - Total: {f.total_ttc} - Paiements: {paiements.count()} - Montant payé: {total_paiements}')

# Derniers paiements
print('\n--- 5 derniers paiements caisse ---')
paiements = Caisse.objects.order_by('-id')[:5]
if paiements:
    for p in paiements:
        print(f'Paiement {p.id}: Facture {p.facture_id} - Mode: {p.mode_paiement} - Montant: {p.montant} - Statut: {p.statut}')
else:
    print('AUCUN PAIEMENT TROUVÉ')

# Total des paiements du jour
from django.utils import timezone
from datetime import datetime, timedelta
today = timezone.now().date()
paiements_jour = Caisse.objects.filter(date_paiement__date=today, statut='completee')
total_jour = sum([p.montant for p in paiements_jour])
print(f'\n--- Total caisse aujourd\'hui ({today}) ---')
print(f'Nombre de paiements: {paiements_jour.count()}')
print(f'Total encaissé: {total_jour}')
