"""Bornes datetime pour remplacer les lookups `__date` sur les DateTimeField.

Contexte : USE_TZ=False — les datetimes DB sont naïves en heure locale
(Africa/Douala) et `timezone.make_aware` est patché en identité (apps.py).

Pourquoi : `field__date__gte=d` force un cast `::date` en SQL qui neutralise
l'index btree sur la colonne. Utiliser des bornes datetime réactive l'index :

    # au lieu de : qs.filter(date__date__gte=d, date__date__lte=d2)
    qs.filter(date__gte=day_start(d), date__lt=day_start(d2 + 1 day))
"""

from datetime import date, datetime, time, timedelta
from typing import Tuple

from django.utils import timezone


def day_start(d: date) -> datetime:
    """Début du jour local d (00:00:00)."""
    return timezone.make_aware(datetime.combine(d, time.min))


def day_end(d: date) -> datetime:
    """Fin du jour local d (23:59:59.999999)."""
    return timezone.make_aware(datetime.combine(d, time.max))


def day_bounds(d: date) -> Tuple[datetime, datetime]:
    """Bornes [start, next_start) couvrant le jour local d (borne haute exclue)."""
    return day_start(d), day_start(d + timedelta(days=1))
