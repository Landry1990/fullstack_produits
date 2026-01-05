import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Facture, Client

print("--- VÉRIFICATION PART CLIENT ---")

# Trouver un client avec couverture
client = Client.objects.filter(taux_couverture__gt=0).first()

if client:
    print(f"Client trouvé: {client.name} (Couverture: {client.taux_couverture}%)")
    factures = Facture.objects.filter(client=client)[:3]
    for f in factures:
        print(f"Facture #{f.numero_facture}: Total TTC={f.total_ttc}, Part Client={f.part_client}")
        expected_part = (f.total_ttc * (100 - client.taux_couverture) / 100).quantize(f.total_ttc) 
        # Approx check since decimal contexts might differ slightly in print
        print(f"Check: {f.part_client} ~= {expected_part} ?")
else:
    print("Aucun client avec taux de couverture > 0 trouvé pour test.")
