from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from django.db.models import Sum
from django.utils import timezone

from api.models import Facture, FactureProduit


def get_replenishment_metrics(produit_id):
    now = timezone.now()
    sales = FactureProduit.objects.filter(
        produit_id=produit_id,
        facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
    )
    sales_90_days = sales.filter(facture__date__gte=now - timedelta(days=90)).aggregate(
        total=Sum('quantity')
    )['total'] or 0
    sales_recent_28_days = sales.filter(facture__date__gte=now - timedelta(days=28)).aggregate(
        total=Sum('quantity')
    )['total'] or 0
    sales_previous_28_days = sales.filter(
        facture__date__gte=now - timedelta(days=56),
        facture__date__lt=now - timedelta(days=28),
    ).aggregate(total=Sum('quantity'))['total'] or 0

    vmd_historique = float(sales_90_days) / 90.0
    if sales_previous_28_days > 0:
        tendance = float(sales_recent_28_days) / float(sales_previous_28_days)
    else:
        tendance = 1.0 if sales_recent_28_days > 0 else 0.0
    tendance = max(0.5, min(tendance, 2.0))
    vmd_ajustee = vmd_historique * tendance

    return {
        'ventes_90j': int(sales_90_days),
        'vmd_historique': vmd_historique,
        'vmd_ajustee': vmd_ajustee,
        'consommation_mensuelle': vmd_ajustee * 30.0,
        'tendance': tendance,
    }


def calculate_stock_thresholds(produit, coverage_days=30):
    metrics = get_replenishment_metrics(produit.id)
    fournisseur = produit.fournisseur
    delai_livraison = getattr(fournisseur, 'delai_livraison_jours', None) or 2
    marge_retard = getattr(fournisseur, 'marge_retard_jours', None) or 2
    vmd_ajustee = metrics['vmd_ajustee']
    stock_minimum = ceil(vmd_ajustee * (delai_livraison + marge_retard))
    # Arrondi au plus proche pour le max : ceil() gonflait les produits
    # dormants (rotation 0,3/mois → max 2, soit ~7 mois de stock).
    stock_maximum = int(
        Decimal(str(stock_minimum + vmd_ajustee * coverage_days)).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP
        )
    )

    if vmd_ajustee > 0:
        stock_minimum = max(1, stock_minimum)
        # Rotation < 1/mois : le max peut égaler le min (on garde l'unité de
        # sécurité, pas de couverture additionnelle pour un dormant).
        floor_max = (
            stock_minimum
            if metrics['consommation_mensuelle'] < 1
            else stock_minimum + 1
        )
        stock_maximum = max(floor_max, stock_maximum)

    return {
        **metrics,
        'stock_minimum': stock_minimum,
        'stock_maximum': stock_maximum,
        'delai_livraison': delai_livraison,
        'marge_retard': marge_retard,
    }
