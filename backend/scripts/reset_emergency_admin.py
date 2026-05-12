#!/usr/bin/env python3
"""
Script pour gérer le compte super-admin de secours.

Usage:
    python scripts/reset_emergency_admin.py --password "NouveauMotDePasse123!"
    python scripts/reset_emergency_admin.py --status
    python scripts/reset_emergency_admin.py --enable
    python scripts/reset_emergency_admin.py --disable
"""

import os
import sys
import argparse
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, str(Path(__file__).parent.parent))

import django
django.setup()

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist

User = get_user_model()
DEFAULT_USERNAME = 'sysadmin'


def reset_password(username, new_password):
    """Change le mot de passe du compte de secours."""
    try:
        user = User.objects.get(username=username)
        user.set_password(new_password)
        user.save()
        print(f"✅ Mot de passe changé pour '{username}'")
        return True
    except ObjectDoesNotExist:
        print(f"❌ Utilisateur '{username}' non trouvé")
        return False


def check_status(username):
    """Vérifie le statut du compte de secours."""
    try:
        user = User.objects.get(username=username)
        print(f"{'='*50}")
        print(f"Compte de secours: {username}")
        print(f"Actif: {'✅ Oui' if user.is_active else '❌ Non'}")
        print(f"Superuser: {'✅ Oui' if user.is_superuser else '❌ Non'}")
        print(f"Staff: {'✅ Oui' if user.is_staff else '❌ Non'}")
        print(f"Dernière connexion: {user.last_login or 'Jamais'}")
        print(f"Date création: {user.date_joined}")
        print(f"{'='*50}")
        return True
    except ObjectDoesNotExist:
        print(f"❌ Compte '{username}' n'existe pas")
        return False


def enable_account(username):
    """Active le compte de secours."""
    try:
        user = User.objects.get(username=username)
        user.is_active = True
        user.save()
        print(f"✅ Compte '{username}' activé")
        return True
    except ObjectDoesNotExist:
        print(f"❌ Utilisateur '{username}' non trouvé")
        return False


def disable_account(username):
    """Désactive le compte de secours."""
    try:
        user = User.objects.get(username=username)
        user.is_active = False
        user.save()
        print(f"✅ Compte '{username}' désactivé")
        return True
    except ObjectDoesNotExist:
        print(f"❌ Utilisateur '{username}' non trouvé")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Gère le compte super-admin de secours',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
    %(prog)s --password "MonSuperMotDePasse123!"
    %(prog)s --status
    %(prog)s --disable
        """
    )
    
    parser.add_argument('-u', '--username', default=DEFAULT_USERNAME,
                        help=f"Nom d'utilisateur (défaut: {DEFAULT_USERNAME})")
    parser.add_argument('-p', '--password', help="Nouveau mot de passe")
    parser.add_argument('-s', '--status', action='store_true',
                        help="Vérifier le statut du compte")
    parser.add_argument('--enable', action='store_true',
                        help="Activer le compte")
    parser.add_argument('--disable', action='store_true',
                        help="Désactiver le compte")
    
    args = parser.parse_args()
    
    if args.password:
        if len(args.password) < 12:
            print("❌ Le mot de passe doit faire au moins 12 caractères")
            sys.exit(1)
        reset_password(args.username, args.password)
    elif args.status:
        check_status(args.username)
    elif args.enable:
        enable_account(args.username)
    elif args.disable:
        disable_account(args.username)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
