#!/usr/bin/env python3
"""
Générateur de code journalier (Keyday) pour le support.

Usage :
    python keyday_generator.py --secret="VOTRE_SECRET_KEY"
    python keyday_generator.py --secret="VOTRE_SECRET_KEY" --date=2026-08-05

Le secret correspond au DJANGO_SECRET_KEY du serveur du client (dans .env).
Il faut le récupérer une fois (lors de l'installation) et le garder précieusement.

Le code généré est valide pour le jour spécifié ET le lendemain (tolérance minuit).
"""
import argparse
import hashlib
import hmac
from datetime import date, datetime, timedelta

_SALT = b"zenith-pharma-keyday-v1"


def get_keyday_for_date(secret: str, target_date: date) -> str:
    """Génère le code keyday pour une date donnée."""
    date_str = target_date.strftime('%Y-%m-%d')
    payload = f"{date_str}:{_SALT.decode()}".encode()
    digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return digest[:6].upper()


def main():
    parser = argparse.ArgumentParser(description="Générateur de code journalier (Keyday)")
    parser.add_argument('--secret', required=True, help='DJANGO_SECRET_KEY du serveur client')
    parser.add_argument('--date', help='Date au format YYYY-MM-DD (défaut: aujourd\'hui)')
    args = parser.parse_args()

    if args.date:
        target = datetime.strptime(args.date, '%Y-%m-%d').date()
    else:
        target = date.today()

    today_code = get_keyday_for_date(args.secret, target)
    tomorrow_code = get_keyday_for_date(args.secret, target + timedelta(days=1))

    print(f"========================================")
    print(f"  Code Keyday pour le {target.strftime('%d/%m/%Y')}")
    print(f"========================================")
    print(f"  Aujourd'hui : {today_code}")
    print(f"  Demain      : {tomorrow_code}")
    print(f"========================================")
    print(f"  Valable 24h -- change a minuit")
    print(f"========================================")


if __name__ == '__main__':
    main()
