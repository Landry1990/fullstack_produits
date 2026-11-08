from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from api.models import Facture, FactureProduit, Produit

# Plancher d'observation : une VMD calculée sur < 7 j amplifie le bruit
# (3 ventes le jour J → VMD=3 u/j). On extrapole toujours sur ≥ 7 j.
MIN_JOURS_OBSERVATION = 7

_STATUTS_VENTE = [Facture.Status.VALIDEE, Facture.Status.PAYEE]


def get_jours_donnees(today=None):
    """
    Âge réel des données de vente : jours depuis la première facture
    validée/payée, borné à 90 j et planché à MIN_JOURS_OBSERVATION.
    Avant 90 j d'utilisation, la VMD doit être divisée par cet âge
    (sinon ventes/90 sous-estime systématiquement les quantités).
    Mis en cache 1 h (granularité journalière).
    """
    cached = cache.get('stock_jours_donnees')
    if cached is not None:
        return cached

    today = today or timezone.localtime(timezone.now()).date()
    first_sale = Facture.objects.filter(
        status__in=_STATUTS_VENTE
    ).order_by('date').values_list('date', flat=True).first()
    if not first_sale:
        jours = 90
    else:
        age = (today - timezone.localtime(first_sale).date()).days + 1
        jours = min(90, max(MIN_JOURS_OBSERVATION, age))
    cache.set('stock_jours_donnees', jours, 3600)
    return jours


def compute_jours_dispo(created_at=None, today=None, jours_donnees=None):
    """
    Jours pendant lesquels le produit a réellement pu être vendu :
    borné par l'âge des données globales ET l'âge du produit
    (plancher MIN_JOURS_OBSERVATION, plafond 90).
    """
    if jours_donnees is None:
        jours_donnees = get_jours_donnees(today)
    age_produit = 90
    if created_at:
        today = today or timezone.localtime(timezone.now()).date()
        created_date = created_at.date() if hasattr(created_at, 'date') else created_at
        age = (today - created_date).days + 1
        age_produit = min(90, max(MIN_JOURS_OBSERVATION, age))
    return max(1, min(jours_donnees, age_produit))


def compute_vmd_tendance(ventes_90j, ventes_4s, ventes_8s_4s, jours_dispo):
    """
    VMD proratisée + tendance en taux/jour.

    La tendance compare les taux journaliers des 4 dernières semaines
    vs les 4 précédentes sur les fenêtres réellement disponibles —
    strictement équivalent à ventes_4s/ventes_8s_4s quand les deux
    fenêtres de 28 j sont pleines.

    Retourne (vmd_historique, vmd_ajustee, tendance) — tendance déjà
    bornée dans [0.5, 2.0].
    """
    jours_dispo = max(1, jours_dispo)
    vmd_historique = float(ventes_90j) / jours_dispo

    jours_4s = min(28, jours_dispo)
    jours_8s_4s = min(28, max(0, jours_dispo - 28))
    taux_4s = float(ventes_4s) / jours_4s if jours_4s > 0 else 0.0
    taux_8s_4s = float(ventes_8s_4s) / jours_8s_4s if jours_8s_4s > 0 else 0.0
    if taux_8s_4s > 0:
        tendance = taux_4s / taux_8s_4s
    else:
        tendance = 1.0 if taux_4s > 0 else 0.0
    tendance = max(0.5, min(tendance, 2.0))

    return vmd_historique, vmd_historique * tendance, tendance


def get_replenishment_metrics(produit_id, produit=None):
    now = timezone.now()
    sales = FactureProduit.objects.filter(
        produit_id=produit_id,
        facture__status__in=_STATUTS_VENTE,
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

    if produit is None:
        produit = Produit.objects.only('created_at').filter(id=produit_id).first()
    jours_dispo = compute_jours_dispo(getattr(produit, 'created_at', None))
    vmd_historique, vmd_ajustee, tendance = compute_vmd_tendance(
        sales_90_days, sales_recent_28_days, sales_previous_28_days, jours_dispo
    )

    return {
        'ventes_90j': int(sales_90_days),
        'vmd_historique': vmd_historique,
        'vmd_ajustee': vmd_ajustee,
        'consommation_mensuelle': vmd_ajustee * 30.0,
        'tendance': tendance,
        'jours_base': jours_dispo,
    }


def calculate_stock_thresholds(produit, coverage_days=30):
    metrics = get_replenishment_metrics(produit.id, produit=produit)
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
