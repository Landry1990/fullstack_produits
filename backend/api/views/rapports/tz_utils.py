"""
Utilitaires timezone pour les rapports.

Problème : Django stocke toutes les dates en UTC (USE_TZ=True).
Avec TIME_ZONE='Africa/Douala' (WAT = UTC+1), une facture créée à
00h30 WAT est stockée comme 23h30 UTC du jour précédent.

=> Toujours utiliser local_trunc_date() au lieu de TruncDate() sans tz
   pour grouper les données par jour LOCAL (WAT) et non par jour UTC.
"""
from django.conf import settings
from django.db.models.functions import TruncDate
import zoneinfo


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
