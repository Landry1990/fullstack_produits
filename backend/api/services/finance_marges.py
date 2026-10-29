"""
Services de calcul des marges (allocated + unallocated).
"""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from ..models import Produit
from ..utils.dates import day_start
from .ventes_lots import collect_sales_records


def finance_sales_records(start_date=None, end_date=None, invoices=None):
    return collect_sales_records(
        day_start(start_date) if start_date else None,
        day_start(end_date + timedelta(days=1)) - timedelta(microseconds=1) if end_date else None,
        invoices=invoices,
    )


def group_finance_records(records, dimension='produit'):
    fields = {
        'rayon': ('rayon_id', 'rayon__name'),
        'groupe': ('groupe_id', 'groupe__nom'),
        'forme': ('forme_id', 'forme__nom'),
    }
    metadata = {}
    if dimension in fields:
        id_field, name_field = fields[dimension]
        metadata = {
            p['id']: (p[id_field], p[name_field])
            for p in Produit.objects.filter(pk__in={r['produit_id'] for r in records}).values('id', id_field, name_field)
        }
    grouped = {}
    for r in records:
        if dimension == 'produit':
            key, name = r['produit_id'], r['p_nom']
            if key is None:
                continue
        elif dimension == 'fournisseur':
            key, name = r['f_id'] or 0, r['f_nom']
        else:
            key, name = metadata.get(r['produit_id'], (0, None))
            key = key or 0
        entry = grouped.setdefault(key, {
            'id': key, 'nom': name or 'Inconnu', 'cip': r['cip'],
            'ca': Decimal(0), 'marge': Decimal(0), 'achat': Decimal(0),
            'quantite': 0, 'nb_ventes': 0, 'months': {},
        })
        entry['ca'] += r['vente_ht']
        entry['marge'] += r['vente_ht'] - r['achat']
        entry['achat'] += r['achat']
        entry['quantite'] += r['qte']
        entry['nb_ventes'] += 1
        month = timezone.localtime(r['date']).strftime('%Y-%m')
        entry['months'][month] = entry['months'].get(month, Decimal(0)) + r['vente']
    for entry in grouped.values():
        entry['taux_marge'] = round(float(entry['marge'] / entry['ca'] * 100), 1) if entry['ca'] > 0 else 0
    return grouped


def build_monthly_margin_map(start_date, end_date=None):
    """
    Construit un dict {YYYY-MM: {'ca': float, 'marge': float}} pour la période.
    """
    margin_map = {}

    # Allocated items
    # Unallocated items
    for r in finance_sales_records(start_date, end_date):
        key = timezone.localtime(r['date']).strftime('%Y-%m')
        entry = margin_map.setdefault(key, {'ca': Decimal(0), 'marge': Decimal(0)})
        entry['ca'] += r['vente_ht']
        entry['marge'] += r['vente_ht'] - r['achat']
    return {key: {k: float(v) for k, v in entry.items()} for key, entry in margin_map.items()}


def calculate_margin_for_invoices(invoices):
    """
    Calcule le CA HT et la marge totale pour un QuerySet de factures données.
    """
    records = finance_sales_records(invoices=invoices)
    total_ca = sum((r['vente_ht'] for r in records), Decimal(0))
    total_marge = sum((r['vente_ht'] - r['achat'] for r in records), Decimal(0))
    return float(total_ca), float(total_marge)
