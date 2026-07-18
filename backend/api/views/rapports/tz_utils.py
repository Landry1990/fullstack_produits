"""
Utilitaires timezone pour les rapports.

Problème : Django stocke toutes les dates en UTC (USE_TZ=True).
Avec TIME_ZONE='Africa/Douala' (WAT = UTC+1), une facture créée à
00h30 WAT est stockée comme 23h30 UTC du jour précédent.

=> Toujours utiliser local_trunc_date() au lieu de TruncDate() sans tz
   pour grouper les données par jour LOCAL (WAT) et non par jour UTC.

=> Toujours utiliser parse_api_datetime() pour parser les dates reçues
   de l'API frontend — cette fonction respecte les offsets timezone
   inclus dans la chaîne (ex: +01:00 ou Z).
"""
from django.conf import settings
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import datetime
import logging
import zoneinfo

logger = logging.getLogger(__name__)


def get_local_tz():
    """Retourne le timezone local configuré dans Django settings."""
    return zoneinfo.ZoneInfo(settings.TIME_ZONE)


def local_trunc_date(field: str) -> TruncDate:
    """
    TruncDate avec le timezone local Django explicite.
    Utiliser à la place de TruncDate(field) dans tous les rapports
    pour éviter le décalage UTC vs heure locale.
    """
    return TruncDate(field, tzinfo=get_local_tz())


def parse_api_datetime(value: str | None, end_of_day: bool = False):
    """
    Parse une chaîne de date reçue de l'API frontend.

    Gère tous les formats possibles :
      - ISO avec offset   : "2026-07-10T00:00:00+01:00"  (frontend toApiDateTime)
      - ISO avec Z        : "2026-07-10T00:00:00Z"
      - ISO sans timezone : "2026-07-10T00:00:00"         (legacy — interprété comme heure locale)
      - Date seule        : "2026-07-10"

    Retourne un datetime aware (avec timezone) ou None si la valeur est vide/invalide.
    Si end_of_day=True et que seule une date (YYYY-MM-DD) est fournie, met l'heure à 23:59:59.
    """
    if not value:
        return None

    # Cas 1 : parse_datetime gère ISO 8601 complet avec offset ou Z
    dt = parse_datetime(value)
    if dt is not None:
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, get_local_tz())
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
            return timezone.make_aware(dt, get_local_tz())
        except ValueError:
            continue

    logger.warning(f"parse_api_datetime: impossible de parser '{value}'")
    return None
