import os
import sys

import django

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()


from api.views.commandes.suggestions import calculer_ventes_tranche_horaire

print("Starting test...")
try:
    # Use a wide range covering yesterday and today
    dt_debut = '2026-04-02T00:00'
    dt_fin = '2026-04-03T23:59'
    res, total = calculer_ventes_tranche_horaire(dt_debut, dt_fin)
    print(f"Success! Suggestions found: {len(res)}")
    for s in res[:5]:
        print(f" - {s['produit_nom']}: {s['quantite_suggeree']}")
except Exception as e:
    print(f"CRASHED: {type(e).__name__}: {e!s}")
    import traceback
    traceback.print_exc()
