#!/usr/bin/env python3
"""
Script appelé à chaque démarrage du conteneur pour garantir
l'existence du compte super-admin de secours.

Usage dans entrypoint.sh:
    python scripts/ensure_emergency_admin.py
"""

import os
import sys
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, str(Path(__file__).parent.parent))

import django
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def ensure_emergency_admin():
    """
    Crée ou met à jour le compte de secours à chaque démarrage.
    Idempotent - peut être appelé plusieurs fois sans effet de bord.
    """
    username = os.getenv('EMERGENCY_ADMIN_USER', 'sysadmin')
    default_password = os.getenv('EMERGENCY_ADMIN_PASSWORD', 'ChangeMeImmediately123!')
    
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'email': 'admin@localhost',
            'first_name': 'System',
            'last_name': 'Administrator',
            'is_superuser': True,
            'is_staff': True,
            'is_active': True,
        }
    )
    
    if created:
        user.set_password(default_password)
        user.save()
        print(f"✅ Compte de secours '{username}' créé")
        print(f"⚠️  MOT DE PASSE PAR DÉFAUT: {default_password}")
        print(f"⚠️  CHANGEZ IMMÉDIATEMENT avec: python scripts/reset_emergency_admin.py --password '...'")
    else:
        # Vérifier que c'est bien un superuser
        if not user.is_superuser:
            user.is_superuser = True
            user.is_staff = True
            user.save()
            print(f"✅ Privilèges super-admin restaurés pour '{username}'")
        else:
            print(f"✓ Compte de secours '{username}' existe déjà (OK)")
    
    return user

if __name__ == '__main__':
    ensure_emergency_admin()
