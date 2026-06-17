#!/usr/bin/env python
"""
Audit complet de tous les serializers du projet.
Vérifie que tous les serializers peuvent être instanciés sans erreur.
"""
import os
import sys
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '/app')

import django
django.setup()

from rest_framework import serializers
from inspect import isclass

# Import dynamique de tous les modules serializers
import api.serializers
import api.serializers_optimized
import api.serializers_monolithic

# Collecter toutes les classes de serializer
all_serializers = []

def collect_serializers(module, prefix):
    for name in dir(module):
        obj = getattr(module, name)
        if (isclass(obj) and issubclass(obj, serializers.Serializer) and
            obj is not serializers.Serializer and
            obj is not serializers.ModelSerializer and
            not name.startswith('_')):
            all_serializers.append((f"{prefix}.{name}", obj))

collect_serializers(api.serializers, 'api.serializers')
collect_serializers(api.serializers_optimized, 'api.serializers_optimized')
collect_serializers(api.serializers_monolithic, 'api.serializers_monolithic')

# Dédoublonner
seen = set()
unique_serializers = []
for full_name, cls in all_serializers:
    if cls not in seen:
        seen.add(cls)
        unique_serializers.append((full_name, cls))

print("=" * 70)
print(f"AUDIT COMPLET DES SERIALIZERS ({len(unique_serializers)} trouvés)")
print("=" * 70)

errors = []
ok_count = 0

for full_name, cls in sorted(unique_serializers, key=lambda x: x[0]):
    try:
        instance = cls()
        fields = instance.get_fields()
        ok_count += 1
        print(f"✅ {full_name:<70} {len(fields):>3} champs")
    except Exception as e:
        errors.append((full_name, str(e)))
        print(f"❌ {full_name:<70} {str(e)[:60]}")

print("=" * 70)
if errors:
    print(f"\n❌ {len(errors)} ERREUR(S) TROUVÉE(S) sur {len(unique_serializers)} serializers:")
    for name, msg in errors:
        print(f"   • {name}")
        print(f"     {msg}")
    sys.exit(1)
else:
    print(f"\n✅ {ok_count}/{len(unique_serializers)} serializers sont valides !")
    sys.exit(0)
