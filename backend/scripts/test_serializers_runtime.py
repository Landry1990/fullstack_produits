#!/usr/bin/env python
"""
Test runtime des serializers avec des données réelles de la base de données.
"""
import os
import sys
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '/app')

import django
django.setup()

from api.models import Facture, Client, Caisse, ClotureCaisse, Commande, Produit
from api.serializers import (
    FactureSerializer, ClientSerializer, CaisseSerializer,
    ClotureCaisseSerializer, CommandeSerializer, ProduitSerializer,
)
from api.serializers_optimized import (
    FactureListSerializer, FactureDetailSerializer,
    ClientListSerializer, ClientDetailSerializer,
)

def test_serializer(name, serializer_class, queryset, limit=3):
    """Teste un serializer avec des instances réelles."""
    print(f"\n🧪 Test {name}...")
    try:
        instances = queryset[:limit]
        if not instances.exists():
            print(f"   ⚠️  Aucune instance trouvée, test d'instanciation seul...")
            instance = serializer_class()
            print(f"   ✅ Instanciation OK — {len(instance.get_fields())} champs")
            return True

        for idx, obj in enumerate(instances):
            data = serializer_class(obj).data
            print(f"   ✅ Instance {idx+1} (id={obj.id}) sérialisée OK — {len(data)} champs")
        return True
    except Exception as e:
        print(f"   ❌ ERREUR: {str(e)[:100]}")
        traceback.print_exc()
        return False

print("=" * 60)
print("TEST RUNTIME DES SERIALIZERS AVEC DONNÉES RÉELLES")
print("=" * 60)

results = {}

# Facture
results['FactureSerializer'] = test_serializer(
    'FactureSerializer', FactureSerializer,
    Facture.objects.all().select_related('client', 'created_by', 'validated_by', 'ayant_droit', 'poste_caisse').prefetch_related('produits', 'paiements')
)
results['FactureDetailSerializer'] = test_serializer(
    'FactureDetailSerializer', FactureDetailSerializer,
    Facture.objects.all().select_related('client', 'created_by', 'validated_by', 'ayant_droit', 'poste_caisse').prefetch_related('produits', 'paiements')
)
results['FactureListSerializer'] = test_serializer(
    'FactureListSerializer', FactureListSerializer,
    Facture.objects.all().select_related('client', 'created_by', 'validated_by')
)

# Client
results['ClientSerializer'] = test_serializer(
    'ClientSerializer', ClientSerializer,
    Client.objects.all().prefetch_related('ayants_droit')
)
results['ClientDetailSerializer'] = test_serializer(
    'ClientDetailSerializer', ClientDetailSerializer,
    Client.objects.all().prefetch_related('ayants_droit')
)
results['ClientListSerializer'] = test_serializer(
    'ClientListSerializer', ClientListSerializer,
    Client.objects.all()
)

# Caisse
results['CaisseSerializer'] = test_serializer(
    'CaisseSerializer', CaisseSerializer,
    Caisse.objects.all().select_related('facture__client', 'facture__created_by', 'user')
)

# Cloture
results['ClotureCaisseSerializer'] = test_serializer(
    'ClotureCaisseSerializer', ClotureCaisseSerializer,
    ClotureCaisse.objects.all().select_related('user', 'cloture_par', 'poste_caisse')
)

# Commande
results['CommandeSerializer'] = test_serializer(
    'CommandeSerializer', CommandeSerializer,
    Commande.objects.all().prefetch_related('produits')
)

# Produit
results['ProduitSerializer'] = test_serializer(
    'ProduitSerializer', ProduitSerializer,
    Produit.objects.all()[:3]
)

print("\n" + "=" * 60)
errors = [name for name, ok in results.items() if not ok]
if errors:
    print(f"❌ {len(errors)} test(s) en échec:")
    for name in errors:
        print(f"   • {name}")
    sys.exit(1)
else:
    print(f"✅ {len(results)}/{len(results)} tests runtime passés avec succès !")
    sys.exit(0)
