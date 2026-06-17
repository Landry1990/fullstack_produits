#!/usr/bin/env python
"""
Audit rapide des serializers après refactoring.
Vérifie que tous les serializers utilisés par les ViewSets peuvent être instanciés.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '/app')
django.setup()

from rest_framework import serializers
from api.serializers import *
from api.serializers_optimized import *

def audit_serializer_class(cls, name):
    """Vérifie qu'un serializer peut être créé sans erreur."""
    try:
        # On crée une instance sans data pour valider la Meta
        instance = cls()
        # On vérifie les champs
        fields = instance.get_fields()
        return True, f"OK — {len(fields)} champs"
    except Exception as e:
        return False, str(e)

serializers_to_test = [
    # Billing
    ('FactureSerializer', FactureSerializer),
    ('FacturePrintSerializer', FacturePrintSerializer),
    ('CaisseSerializer', CaisseSerializer),
    ('ClotureCaisseSerializer', ClotureCaisseSerializer),
    ('CreanceSerializer', CreanceSerializer),
    # Optimisés
    ('FactureListSerializer', FactureListSerializer),
    ('FactureDetailSerializer', FactureDetailSerializer),
    ('FactureOmnisearchSerializer', FactureOmnisearchSerializer),
    # Clients
    ('ClientSerializer', ClientSerializer),
    ('ClientListSerializer', ClientListSerializer),
    ('ClientDetailSerializer', ClientDetailSerializer),
    # Products
    ('ProduitSerializer', ProduitSerializer),
    ('ProduitListSerializer', ProduitListSerializer),
    ('ProduitDetailSerializer', ProduitDetailSerializer),
    ('StockLotSerializer', StockLotSerializer),
    # Orders
    ('CommandeSerializer', CommandeSerializer),
    ('CommandeListSerializer', CommandeListSerializer),
    ('CommandeDetailSerializer', CommandeDetailSerializer),
    ('FournisseurSerializer', FournisseurSerializer),
    # Inventory
    ('InventaireSerializer', InventaireSerializer),
    ('AvoirSerializer', AvoirSerializer),
    # Promis
    ('PromisSerializer', PromisSerializer),
    # Users
    ('UserSerializer', UserSerializer),
    ('ProfileSerializer', ProfileSerializer),
    # Audit
    ('AuditLogSerializer', AuditLogSerializer),
    ('MouvementCaisseSerializer', MouvementCaisseSerializer),
]

print("=" * 60)
print("AUDIT DES SERIALIZERS")
print("=" * 60)

errors = []
for name, cls in serializers_to_test:
    ok, msg = audit_serializer_class(cls, name)
    status = "✅" if ok else "❌"
    print(f"{status} {name:<35} {msg}")
    if not ok:
        errors.append((name, msg))

print("=" * 60)
if errors:
    print(f"❌ {len(errors)} ERREUR(S) TROUVÉE(S):")
    for name, msg in errors:
        print(f"   • {name}: {msg}")
    sys.exit(1)
else:
    print("✅ Tous les serializers sont valides !")
    sys.exit(0)
