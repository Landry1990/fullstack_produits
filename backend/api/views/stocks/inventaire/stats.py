"""
Statistiques et audit pour les inventaires.
"""
from typing import Dict, Any, List, Optional
from decimal import Decimal
from django.db.models import (
    F, Sum, Count, DecimalField, Case, When, Value, ExpressionWrapper
)
from django.db.models.functions import Cast, Coalesce
from rest_framework.response import Response

from api.models import Inventaire, LigneInventaire


def get_inventaire_stats(inventaire: Inventaire) -> Response:
    """
    Retourne les statistiques de l'inventaire pour l'onglet Analyse.

    Args:
        inventaire: Instance de l'inventaire

    Returns:
        Response DRF avec les statistiques
    """
    # 1. Top 10 Pertes (en valeur)
    lignes = inventaire.lignes.annotate(
        valeur_ecart=ExpressionWrapper(
            F('ecart') * Case(
                When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                default=F('produit__cost_price'),
                output_field=DecimalField()
            ),
            output_field=DecimalField()
        )
    ).filter(valeur_ecart__lt=0).select_related('produit').order_by('valeur_ecart')[:10]

    top_pertes = []
    for l in lignes:
        top_pertes.append({
            'produit_nom': l.produit.name if l.produit else l.produit_nom,
            'ecart': float(l.ecart),
            'valeur': float(l.valeur_ecart)
        })

    # 1.5. Top 10 Surplus (en valeur)
    lignes_surplus = inventaire.lignes.annotate(
        valeur_ecart=ExpressionWrapper(
            F('ecart') * Case(
                When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                default=F('produit__cost_price'),
                output_field=DecimalField()
            ),
            output_field=DecimalField()
        )
    ).filter(valeur_ecart__gt=0).select_related('produit').order_by('-valeur_ecart')[:10]

    top_surplus = []
    for l in lignes_surplus:
        top_surplus.append({
            'produit_nom': l.produit.name if l.produit else l.produit_nom,
            'ecart': float(l.ecart),
            'valeur': float(l.valeur_ecart)
        })

    # 2. Ecarts par Rayon
    stats_rayon_qs = inventaire.lignes.annotate(
        valeur_ecart_line=ExpressionWrapper(
            F('ecart') * Case(
                When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                default=F('produit__cost_price'),
                output_field=DecimalField()
            ),
            output_field=DecimalField()
        )
    ).values('produit__rayon__name').annotate(
        total_ecart=Sum('valeur_ecart_line')
    ).order_by('total_ecart')

    stats_rayon = []
    for s in stats_rayon_qs:
        stats_rayon.append({
            'rayon': s['produit__rayon__name'] or 'Sans Rayon',
            'total': s['total_ecart'] or 0
        })

    return Response({
        'top_pertes': top_pertes,
        'top_surplus': top_surplus,
        'par_rayon': stats_rayon
    })


def audit_discrepancies(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Response:
    """
    Audit global des écarts sur tous les inventaires validés.

    Args:
        start_date: Date de début (optionnel, format ISO)
        end_date: Date de fin (optionnel, format ISO)

    Returns:
        Response DRF avec les statistiques d'audit
    """
    queryset = LigneInventaire.objects.filter(inventaire__status=Inventaire.Status.VALIDEE)

    if start_date:
        queryset = queryset.filter(inventaire__date__date__gte=start_date)
    if end_date:
        queryset = queryset.filter(inventaire__date__date__lte=end_date)

    # Annotation de la valeur de l'écart (ecart * pmp)
    queryset = queryset.annotate(
        valeur_ecart=ExpressionWrapper(
            Cast(F('ecart'), output_field=DecimalField(max_digits=12, decimal_places=2)) * Case(
                When(pmp_snapshot__gt=Decimal('0'), then=F('pmp_snapshot')),
                default=Coalesce(
                    F('produit__cost_price'),
                    Value(Decimal('0'), output_field=DecimalField(max_digits=12, decimal_places=2))
                ),
                output_field=DecimalField(max_digits=12, decimal_places=2)
            ),
            output_field=DecimalField(max_digits=12, decimal_places=2)
        )
    )

    # 1. Top Produits par Pertes (somme des écarts négatifs)
    top_pertes = queryset.filter(valeur_ecart__lt=Decimal('0')).values(
        'produit__id', 'produit__name', 'produit__cip1'
    ).annotate(
        total_valeur=Sum('valeur_ecart'),
        total_quantite=Sum('ecart'),
        occurrence=Count('id')
    ).order_by('total_valeur')[:20]

    # 2. Top Produits par Surplus
    top_surplus = queryset.filter(valeur_ecart__gt=Decimal('0')).values(
        'produit__id', 'produit__name'
    ).annotate(
        total_valeur=Sum('valeur_ecart'),
        total_quantite=Sum('ecart'),
        occurrence=Count('id')
    ).order_by('-total_valeur')[:20]

    # 3. Répartition par Rayon
    par_rayon = queryset.values('produit__rayon__name').annotate(
        total_valeur=Coalesce(Sum('valeur_ecart'), Value(Decimal('0'), output_field=DecimalField())),
        perte_valeur=Coalesce(
            Sum(Case(
                When(valeur_ecart__lt=Decimal('0'), then=F('valeur_ecart')),
                default=Value(Decimal('0'), output_field=DecimalField())
            )),
            Value(Decimal('0'), output_field=DecimalField())
        ),
        gain_valeur=Coalesce(
            Sum(Case(
                When(valeur_ecart__gt=Decimal('0'), then=F('valeur_ecart')),
                default=Value(Decimal('0'), output_field=DecimalField())
            )),
            Value(Decimal('0'), output_field=DecimalField())
        ),
        nombre_lignes=Count('id')
    ).order_by('total_valeur')

    # 4. Répartition par Groupe
    par_groupe = queryset.values(produit__groupe__name=F('produit__groupe__nom')).annotate(
        total_valeur=Coalesce(Sum('valeur_ecart'), Value(Decimal('0'), output_field=DecimalField())),
        perte_valeur=Coalesce(
            Sum(Case(
                When(valeur_ecart__lt=Decimal('0'), then=F('valeur_ecart')),
                default=Value(Decimal('0'), output_field=DecimalField())
            )),
            Value(Decimal('0'), output_field=DecimalField())
        ),
        gain_valeur=Coalesce(
            Sum(Case(
                When(valeur_ecart__gt=Decimal('0'), then=F('valeur_ecart')),
                default=Value(Decimal('0'), output_field=DecimalField())
            )),
            Value(Decimal('0'), output_field=DecimalField())
        ),
    ).order_by('total_valeur')

    return Response({
        'top_pertes': top_pertes,
        'top_surplus': top_surplus,
        'par_rayon': par_rayon,
        'par_groupe': par_groupe,
        'stats_globales': queryset.aggregate(
            total_perte=Coalesce(
                Sum(Case(
                    When(valeur_ecart__lt=Decimal('0'), then=F('valeur_ecart')),
                    default=Value(Decimal('0'), output_field=DecimalField())
                )),
                Value(Decimal('0'), output_field=DecimalField())
            ),
            total_gain=Coalesce(
                Sum(Case(
                    When(valeur_ecart__gt=Decimal('0'), then=F('valeur_ecart')),
                    default=Value(Decimal('0'), output_field=DecimalField())
                )),
                Value(Decimal('0'), output_field=DecimalField())
            ),
            net=Coalesce(Sum('valeur_ecart'), Value(Decimal('0'), output_field=DecimalField())),
            nombre_inventaires=Count('inventaire', distinct=True),
            nombre_lignes=Count('id')
        )
    })
