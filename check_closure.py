import os, sys
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.config.settings')
import django
django.setup()

from api.models import ClotureCaisse, MouvementCaisse
from django.utils import timezone
from datetime import datetime, timezone as dt_timezone

print('=== TOUTES LES CLOTURES (5 dernieres) ===')
for c in ClotureCaisse.objects.order_by('-date')[:5]:
    debut = c.date_debut.strftime('%d/%m %H:%M') if c.date_debut else '-'
    print('ID:%s | %s | Caissier:%s | Theo:%s | Reel:%s | Ecart:%s | Debut:%s' % (c.id, c.date.strftime('%d/%m %H:%M'), c.user, c.montant_theorique, c.montant_reel, c.ecart_caisse, debut))

print()
print('=== MOUVEMENTS CAISSE DANS LA PERIODE 21:40-22:13 ===')
start = datetime(2026, 6, 4, 21, 40, 23, tzinfo=dt_timezone.utc)
end = datetime(2026, 6, 4, 22, 13, 14, tzinfo=dt_timezone.utc)
mvs = MouvementCaisse.objects.filter(date__gte=start, date__lte=end)
for m in mvs:
    print('  %s | %s | %s | %s | User:%s' % (m.date.strftime('%H:%M'), m.type, m.montant, m.motif, m.user))
if not mvs:
    print('  Aucun mouvement')

print()
print('=== TOUTES LES CLOTURES DE LAURE ===')
for c in ClotureCaisse.objects.filter(user__username='Laure').order_by('-date')[:3]:
    debut = c.date_debut.strftime('%d/%m %H:%M') if c.date_debut else '-'
    fin = c.date_fin.strftime('%d/%m %H:%M') if c.date_fin else '-'
    print('ID:%s | %s | Theo:%s | Reel:%s | Ecart:%s | Debut:%s | Fin:%s' % (c.id, c.date.strftime('%d/%m %H:%M'), c.montant_theorique, c.montant_reel, c.ecart_caisse, debut, fin))
