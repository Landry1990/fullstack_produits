#!/usr/bin/env python
"""Import substances from COMPO.txt into the Substance table."""
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import django
django.setup()

from api.models import Substance

def import_substances():
    compo_path = os.path.join(os.path.dirname(__file__), 'COMPO.txt')
    if not os.path.exists(compo_path):
        print(f"ERROR: {compo_path} not found")
        return

    # Parse COMPO.txt (tab-separated)
    # Format: CIS\tforme\tsubstance_code\tsubstance_name\tdosage\tunit\ttype\tnum
    substances = set()
    for encoding in ['utf-8', 'latin-1', 'cp1252']:
        try:
            with open(compo_path, 'r', encoding=encoding) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split('\t')
                    if len(parts) >= 4:
                        nom = parts[3].strip()
                        if nom:
                            substances.add(nom)
            break
        except UnicodeDecodeError:
            continue

    print(f"Found {len(substances)} unique substances in COMPO.txt")

    # Create in database (skip existing)
    created_count = 0
    existing_count = 0
    for nom in sorted(substances):
        obj, created = Substance.objects.get_or_create(
            nom__iexact=nom,
            defaults={'nom': nom}
        )
        if created:
            created_count += 1
        else:
            existing_count += 1

    print(f"Created: {created_count}")
    print(f"Already existing: {existing_count}")
    print(f"Total in DB: {Substance.objects.count()}")

if __name__ == '__main__':
    import_substances()
