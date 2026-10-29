"""
Requêtes de base factorisées pour les statistiques financières.
Centralise les filtres communs (status VAL/PAY, exclusion VAL sans paiement).
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce, TruncMonth

from ..models import FactureProduit, FactureProduitAllocation
from ..utils.dates import day_start
from .ventes_lots import factures_retenues


def get_validated_invoices_queryset():
    """
    QuerySet de base pour les factures validées/payées,
    excluant les factures VAL sans paiement.
    """
    return factures_retenues()


def get_allocations_base_queryset(start_date=None, end_date=None, invoices=None):
    """
    QuerySet de base pour FactureProduitAllocation avec filtres standards.
    """
    qs = FactureProduitAllocation.objects.filter(facture_produit__facture__in=factures_retenues())

    if start_date:
        qs = qs.filter(facture_produit__facture__date__gte=day_start(start_date))
    if end_date:
        qs = qs.filter(facture_produit__facture__date__lt=day_start(end_date + timedelta(days=1)))
    if invoices is not None:
        qs = qs.filter(facture_produit__facture__in=invoices)

    return qs


def get_unallocated_products_base_queryset(start_date=None, end_date=None, invoices=None):
    """
    QuerySet de base pour FactureProduit non-alloués avec filtres standards.
    """
    qs = FactureProduit.objects.filter(facture__in=factures_retenues())

    if start_date:
        qs = qs.filter(facture__date__gte=day_start(start_date))
    if end_date:
        qs = qs.filter(facture__date__lt=day_start(end_date + timedelta(days=1)))
    if invoices is not None:
        qs = qs.filter(facture__in=invoices)

    return qs


def get_monthly_ca_aggregated(start_date, end_date):
    """
    Agrégation mensuelle du CA TTC.
    Retourne un dict {YYYY-MM: float}.
    """
    qs = get_validated_invoices_queryset().filter(
        date__gte=day_start(start_date),
        date__lt=day_start(end_date + timedelta(days=1))
    ).annotate(
        month=TruncMonth('date')
    ).values('month').annotate(
        total=Coalesce(Sum('total_ttc'), Decimal(0))
    ).order_by('month')

    return {item['month'].strftime('%Y-%m'): float(item['total']) for item in qs}
