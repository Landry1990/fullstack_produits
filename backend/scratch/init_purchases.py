import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Commande
from api.signals_comptabilite import generer_ecriture_achat

commandes = Commande.objects.filter(status='CLOT', is_active=True)
print(f"Trouvé {commandes.count()} commandes clôturées à traiter.")

count = 0
for cmd in commandes:
    generer_ecriture_achat(None, cmd, False)
    count += 1
    if count % 10 == 0:
        print(f"Traité {count} commandes...")

print(f"Terminé. {count} écritures d'achat générées/mises à jour.")
