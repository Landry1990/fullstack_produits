"""
Système de mot de passe journalier (Keyday).

Principe :
- Chaque jour, un code à 6 caractères est généré à partir de la date + un secret.
- Le support peut générer ce code avec le même algorithme et le donner au client.
- Le code n'est valide que pour le jour en question (change à minuit).
- Permet de débloquer une situation (licence, admin) sans accès au serveur.

Usage côté support :
    python -m api.keyday
    # ou
    python -c "from api.keyday import get_today_keyday; print(get_today_keyday())"

Usage côté API :
    from api.keyday import validate_keyday
    if validate_keyday(code):
        # autoriser l'action
"""

import hashlib
import hmac
from datetime import date

from django.conf import settings

# Secret dérivé de SECRET_KEY — pas besoin d'une variable supplémentaire.
# Le support doit connaître DJANGO_SECRET_KEY pour générer les codes.
# En prod, SECRET_KEY est dans le .env du serveur.
_KEYDAY_SALT = b"zenith-pharma-keyday-v1"


def _get_secret() -> bytes:
    """Récupère le secret pour le keyday (dérivé de SECRET_KEY Django)."""
    secret_key = getattr(settings, 'SECRET_KEY', '')
    return secret_key.encode() if secret_key else b'fallback-secret'


def get_keyday_for_date(target_date: date) -> str:
    """
    Génère le code keyday pour une date donnée.
    Format : 6 caractères alphanumériques majuscules (A-Z, 0-9).
    """
    date_str = target_date.strftime('%Y-%m-%d')
    payload = f"{date_str}:{_KEYDAY_SALT.decode()}".encode()
    digest = hmac.new(_get_secret(), payload, hashlib.sha256).hexdigest()
    # Prendre les 6 premiers caractères, en majuscules
    return digest[:6].upper()


def get_today_keyday() -> str:
    """Retourne le code keyday du jour."""
    return get_keyday_for_date(date.today())


def get_tomorrow_keyday() -> str:
    """Retourne le code keyday de demain (utile après minuit)."""
    from datetime import timedelta
    return get_keyday_for_date(date.today() + timedelta(days=1))


def validate_keyday(code: str) -> bool:
    """
    Valide un code keyday.
    Accepte le code du jour ET celui de demain (tolérance minuit).
    """
    if not code:
        return False
    code = code.strip().upper()
    today = get_today_keyday()
    tomorrow = get_tomorrow_keyday()
    return hmac.compare_digest(code, today) or hmac.compare_digest(code, tomorrow)


if __name__ == '__main__':
    import os
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()
    print(f"Keyday du jour       : {get_today_keyday()}")
    print(f"Keyday de demain     : {get_tomorrow_keyday()}")
