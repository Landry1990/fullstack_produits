from django.db.models import Q

from ..models import ClotureCaisse


def is_invoice_period_closed(facture):
    facture_date = getattr(facture, 'date', None)
    if facture_date is None:
        return False

    return ClotureCaisse.objects.filter(
        Q(date_debut__isnull=False, date_fin__isnull=False,
          date_debut__lte=facture_date, date_fin__gte=facture_date)
        | Q(date_debut__isnull=True, date_fin__isnull=False,
            date_fin__gte=facture_date)
        | Q(date_debut__isnull=False, date_fin__isnull=True,
            date_debut__lte=facture_date)
    ).exists()
