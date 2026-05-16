# -*- coding: utf-8 -*-
"""
Services de calcul des marges (allocated + unallocated).
"""
from decimal import Decimal
from django.db.models import Sum, F, Value, DecimalField, Exists, OuterRef
from django.db.models.functions import TruncMonth, Coalesce

from ..models import FactureProduitAllocation, FactureProduit
from .finance_base_queries import get_allocations_base_queryset, get_unallocated_products_base_queryset


def build_monthly_margin_map(start_date, end_date=None):
    """
    Construit un dict {YYYY-MM: {'ca': float, 'marge': float}} pour la période.
    """
    margin_map = {}

    # Allocated items
    alloc_stats = get_allocations_base_queryset(
        start_date=start_date, end_date=end_date
    ).annotate(
        month=TruncMonth('facture_produit__facture__date')
    ).values('month').annotate(
        ca_ht=Sum(
            (F('quantity') * (F('selling_price') - F('facture_produit__discount'))) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100),
            output_field=DecimalField()
        ),
        marge=Sum(
            ((F('selling_price') - F('facture_produit__discount')) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100) - F('cost_price')) * F('quantity'),
            output_field=DecimalField()
        )
    )

    for item in alloc_stats:
        key = item['month'].strftime('%Y-%m')
        margin_map[key] = {
            'ca': float(item['ca_ht'] or 0),
            'marge': float(item['marge'] or 0)
        }

    # Unallocated items
    unalloc_items = get_unallocated_products_base_queryset(
        start_date=start_date, end_date=end_date
    ).annotate(
        has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
    ).filter(has_alloc=False).annotate(
        month=TruncMonth('facture__date')
    ).values('month').annotate(
        ca_ht=Sum(
            (F('quantity') * (F('selling_price') - F('discount'))) / (1 + Coalesce(F('tva'), Value(0)) / 100),
            output_field=DecimalField()
        ),
        marge=Sum(
            ((F('selling_price') - F('discount')) / (1 + Coalesce(F('tva'), Value(0)) / 100) - F('produit__pmp')) * F('quantity'),
            output_field=DecimalField()
        )
    )

    for item in unalloc_items:
        key = item['month'].strftime('%Y-%m')
        if key in margin_map:
            margin_map[key]['ca'] += float(item['ca_ht'] or 0)
            margin_map[key]['marge'] += float(item['marge'] or 0)
        else:
            margin_map[key] = {
                'ca': float(item['ca_ht'] or 0),
                'marge': float(item['marge'] or 0)
            }

    return margin_map


def calculate_margin_for_invoices(invoices):
    """
    Calcule le CA HT et la marge totale pour un QuerySet de factures données.
    """
    alloc = FactureProduitAllocation.objects.filter(
        facture_produit__facture__in=invoices
    ).aggregate(
        marge=Sum(
            ((F('selling_price') - F('facture_produit__discount')) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100) - F('cost_price')) * F('quantity'),
            output_field=DecimalField()
        ),
        ca_ht=Sum(
            (F('quantity') * (F('selling_price') - F('facture_produit__discount'))) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100),
            output_field=DecimalField()
        )
    )

    unalloc = FactureProduit.objects.filter(
        facture__in=invoices
    ).annotate(
        has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
    ).filter(has_alloc=False).aggregate(
        marge=Sum(
            ((F('selling_price') - F('discount')) / (1 + Coalesce(F('tva'), Value(0)) / 100) - F('produit__pmp')) * F('quantity'),
            output_field=DecimalField()
        ),
        ca_ht=Sum(
            (F('quantity') * (F('selling_price') - F('discount'))) / (1 + Coalesce(F('tva'), Value(0)) / 100),
            output_field=DecimalField()
        )
    )

    total_ca = (alloc['ca_ht'] or 0) + (unalloc['ca_ht'] or 0)
    total_marge = (alloc['marge'] or 0) + (unalloc['marge'] or 0)
    return float(total_ca), float(total_marge)
