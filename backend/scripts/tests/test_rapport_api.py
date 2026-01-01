import os
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.rapport_view import RapportViewSet
from rest_framework.test import APIRequestFactory
from django.contrib.auth.models import User

# Créer une fausse requête
factory = APIRequestFactory()
request = factory.get('/api/rapports/rapport_mensuel/', {'mois': '2025-12'})

# Créer un utilisateur pour la requête
user = User.objects.first()
request.user = user

# Appeler la vue
viewset = RapportViewSet()
viewset.request = request
response = viewset.rapport_mensuel(request)

print('=' * 80)
print('RAPPORT MENSUEL API - DECEMBRE 2025')
print('=' * 80)
print()

data = response.data

print('CA:')
print(f'  CA TTC: {data["ca"]["ca_ttc"]:,.2f} F')
print(f'  CA HT: {data["ca"]["ca_ht"]:,.2f} F')
print(f'  Nb ventes: {data["ca"]["nb_ventes"]}')
print()

print('MARGE:')
print(f'  Coût achat: {data["marge"]["cout_achat"]:,.2f} F')
print(f'  Marge brute: {data["marge"]["marge_brute"]:,.2f} F')
print(f'  Marge %: {data["marge"]["marge_pct"]}%')
print()

print('ENCAISSEMENTS:')
for enc in data['encaissements']:
    print(f'  {enc["mode_label"]}: {enc["montant"]:,.2f} F')
print()

print('CREANCES A PERCEVOIR:')
print(f'  Montant: {data["creances_a_percevoir"]:,.2f} F')
print()

print('CREANCES (détail):')
print(f'  Total: {data["creances"]["total"]:,.2f} F')
print(f'  Nb factures: {data["creances"]["nb_factures"]}')
print()

print('=' * 80)
