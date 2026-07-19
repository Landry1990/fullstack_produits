"""
Utilitaires timezone pour les rapports.

Avec USE_TZ=False, Django utilise l'heure locale (Africa/Douala) partout.
PostgreSQL convertit automatiquement UTC ↔ heure locale via la session timezone.
Les datetimes lues depuis la DB sont naïves (sans tzinfo) en heure locale.

=> local_trunc_date() est un alias de TruncDate() — conservé pour compatibilité.
=> parse_api_datetime() retourne des datetimes naïves en heure locale.
"""
from django.db.models.functions import TruncDate
from django.utils.dateparse import parse_datetime
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def local_trunc_date(field: str) -> TruncDate:
    """
    TruncDate avec le timezone local.
    Avec USE_TZ=False, les datetimes DB sont déjà en heure locale naive,
    donc TruncDate simple suffit. Conservé pour compatibilité ascendante.
    """
    return TruncDate(field)


def parse_api_datetime(value: str | None, end_of_day: bool = False):
    """
    Parse une chaîne de date reçue de l'API frontend.

    Gère tous les formats possibles :
      - ISO avec offset   : "2026-07-10T00:00:00+01:00"  (frontend toApiDateTime)
      - ISO avec Z        : "2026-07-10T00:00:00Z"
      - ISO sans timezone : "2026-07-10T00:00:00"         (legacy — interprété comme heure locale)
      - Date seule        : "2026-07-10"

    Retourne un datetime naïf (sans tzinfo) en heure locale, ou None si la valeur est vide/invalide.
    Si end_of_day=True et que seule une date (YYYY-MM-DD) est fournie, met l'heure à 23:59:59.
    """
    if not value:
        return None

    # Cas 1 : parse_datetime gère ISO 8601 complet avec offset ou Z
    dt = parse_datetime(value)
    if dt is not None:
        # Convertir en heure locale naive si la datetime est aware
        if dt.tzinfo is not None:
            # Convertir vers Africa/Douala puis stripping tzinfo
            local_tz = __import__('zoneinfo').ZoneInfo('Africa/Douala')
            dt = dt.astimezone(local_tz).replace(tzinfo=None)
        # Si la chaîne d'entrée est une date seule (YYYY-MM-DD), parse_datetime
        # retourne 00:00:00 — appliquer end_of_day si demandé
        if end_of_day and ':' not in value and 'T' not in value:
            dt = dt.replace(hour=23, minute=59, second=59)
        return dt

    # Cas 2 : date seule YYYY-MM-DD
    clean = value.strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            dt = datetime.strptime(clean.replace('T', ' '), fmt)
            if fmt == '%Y-%m-%d' and end_of_day:
                dt = dt.replace(hour=23, minute=59, second=59)
            return dt
        except ValueError:
            continue

    logger.warning(f"parse_api_datetime: impossible de parser '{value}'")
    return None
