"""
Sémantique de la péremption des lots.

Deux conventions existent chez les pharmacies :
- LAST_DAY (défaut, comportement historique) : un lot est périmé quand sa
  date d'expiration est dépassée. Les dates étant saisies en MM/AA et
  stockées au dernier jour du mois, un lot « 11/2026 » est vendable tout
  novembre.
- FIRST_DAY : un lot est périmé dès le 1er jour de son mois d'expiration —
  « 11/2026 » n'est plus vendable le 01/11/2026.

`expired_before()` renvoie la date butoir à comparer avec
`StockLot.date_expiration` :
    lot périmé     ⇔ date_expiration <  expired_before()
    lot valide     ⇔ date_expiration >= expired_before()  (ou NULL)

Fenêtres « expire bientôt » : la borne basse (`date_expiration__gt/lte`)
doit utiliser `expired_before()` pour ne pas mélanger lots déjà périmés
avec lots « qui vont expirer ».
"""
from datetime import timedelta


def expired_before(today=None):
    """Date butoir de péremption selon PharmacySettings.expiry_cutoff."""
    if today is None:
        from django.utils import timezone
        today = timezone.localdate()

    from ..models import PharmacySettings
    ps = PharmacySettings.objects.first()
    if ps and ps.expiry_cutoff == PharmacySettings.ExpiryCutoff.FIRST_DAY:
        # Périmé dès le mois d'expiration : tout lot expirant jusqu'à la fin
        # du mois courant est déjà périmé.
        first = today.replace(day=1)
        if first.month == 12:
            return first.replace(year=first.year + 1, month=1)
        return first.replace(month=first.month + 1)
    return today


def is_expired(date_expiration, today=None):
    """True si le lot est périmé selon le réglage courant."""
    if date_expiration is None:
        return False
    return date_expiration < expired_before(today)
