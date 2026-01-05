#!/usr/bin/env python
"""Script de diagnostic pour vérifier les clients professionnels et leur taux de couverture."""

import os
import sys
import django

# Configuration Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Client

print("=" * 60)
print("DIAGNOSTIC: Clients Professionnels et Tiers Payant")
print("=" * 60)

# Récupérer tous les clients professionnels
clients_pro = Client.objects.filter(client_type='PROFESSIONNEL')

if not clients_pro.exists():
    print("\n⚠️  AUCUN CLIENT PROFESSIONNEL TROUVÉ")
    print("Créez d'abord un client professionnel pour tester le tiers payant.")
else:
    print(f"\n✅ {clients_pro.count()} client(s) professionnel(s) trouvé(s):\n")
    
    for client in clients_pro:
        print(f"📋 Client: {client.name}")
        print(f"   ID: {client.id}")
        print(f"   Type: {client.client_type}")
        print(f"   Taux couverture: {client.taux_couverture}%")
        print(f"   Plafond: {client.plafond} F")
        
        # Vérifier si le taux est valide pour le tiers payant
        if client.taux_couverture is None:
            print("   ❌ PROBLÈME: taux_couverture est NULL")
        elif client.taux_couverture == 0:
            print("   ⚠️  ATTENTION: taux_couverture = 0 (pas de tiers payant)")
        else:
            print(f"   ✅ Tiers payant actif: Patient paie {100 - float(client.taux_couverture)}%, Assurance {client.taux_couverture}%")
        
        # Vérifier les ayants droit
        ayants_droit = client.ayants_droit.all()
        if ayants_droit.exists():
            print(f"   👥 {ayants_droit.count()} ayant(s) droit")
        else:
            print("   ⚠️  Aucun ayant droit (nécessaire pour facturer)")
        
        print()

print("\n" + "=" * 60)
print("RECOMMANDATIONS:")
print("=" * 60)

if not clients_pro.exists():
    print("1. Créez un client professionnel dans l'interface Clients")
    print("2. Définissez un taux de couverture (ex: 70 pour 70%)")
    print("3. Ajoutez au moins un ayant droit")
else:
    clients_avec_taux = clients_pro.exclude(taux_couverture__isnull=True).exclude(taux_couverture=0)
    if not clients_avec_taux.exists():
        print("❌ PROBLÈME: Aucun client professionnel n'a de taux de couverture valide")
        print("\nPour corriger:")
        print("1. Allez dans Clients")
        print("2. Éditez un client professionnel")
        print("3. Définissez 'Taux de couverture' (ex: 70)")
    else:
        print("✅ Vos clients professionnels sont correctement configurés")
        print("\nSi la section ne s'affiche toujours pas:")
        print("1. Ouvrez la console du navigateur (F12)")
        print("2. Vérifiez s'il y a des erreurs")
        print("3. Regardez l'onglet Network pour voir les données chargées")

print("\n")
