# -*- coding: utf-8 -*-
"""
Finance Statistics ViewSet - Refactorisé.
Les services sous-jacents sont dans api/services/finance_*.py
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, BooleanField, Case, When, Value, Exists, OuterRef, CharField
from django.db.models.functions import TruncMonth, Coalesce
from django.utils import timezone
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import numpy as np

from django.core.cache import cache

from ..models import (
    Facture, FactureProduit, FactureProduitAllocation,
    Produit, Rayon, Caisse
)
from ..services.finance_base_queries import get_validated_invoices_queryset
from ..services.finance_formatters import (
    build_monthly_labels, fill_monthly_series, build_prediction_labels
)
from ..services.finance_predictions import (
    moving_average, linear_regression, combined_prediction,
    compute_trend, compute_confidence
)
from ..services.finance_marges import (
    build_monthly_margin_map, calculate_margin_for_invoices
)


class FinanceStatsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    # ── 1. CA Evolution ──────────────────────────────────
    @action(detail=False, methods=['get'])
    def ca_evolution(self, request):
        today = timezone.now().date()
        start_date = (today - relativedelta(months=11)).replace(day=1)
        start_date_n1 = start_date - relativedelta(years=1)

        current_map = get_validated_invoices_queryset().filter(
            date__date__gte=start_date, date__date__lte=today
        ).annotate(month=TruncMonth('date')).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        )
        current_map = {item['month'].strftime('%Y-%m'): float(item['total']) for item in current_map}

        n1_map = get_validated_invoices_queryset().filter(
            date__date__gte=start_date_n1, date__date__lt=start_date
        ).annotate(month=TruncMonth('date')).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        )
        n1_map = {
            (item['month'] + relativedelta(years=1)).strftime('%Y-%m'): float(item['total'])
            for item in n1_map
        }

        labels, data = fill_monthly_series(current_map, start_date, today)
        comparaison_n1 = [n1_map.get(key, 0) for key in [
            (start_date + relativedelta(months=i)).strftime('%Y-%m')
            for i in range(len(labels))
        ]]

        total_current = sum(data)
        total_n1 = sum(comparaison_n1)
        croissance = 0
        if total_n1 > 0:
            croissance = round(float((Decimal(str(total_current)) - Decimal(str(total_n1))) / Decimal(str(total_n1)) * 100), 1)

        return Response({
            'labels': labels, 'data': data, 'comparaison_n1': comparaison_n1,
            'total_current': total_current, 'total_n1': total_n1, 'croissance_yoy': croissance
        })

    # ── 2. Marges Evolution ──────────────────────────────
    @action(detail=False, methods=['get'])
    def marges_evolution(self, request):
        today = timezone.now().date()
        start_date = (today - relativedelta(months=11)).replace(day=1)

        margin_map = build_monthly_margin_map(start_date, today)
        labels = build_monthly_labels(start_date, today)

        marge_brute, taux_marge, ca_values = [], [], []
        for key in [(start_date + relativedelta(months=i)).strftime('%Y-%m') for i in range(len(labels))]:
            entry = margin_map.get(key, {'marge': 0, 'ca': 0})
            ca_val = entry['ca']
            marge_val = entry['marge']
            ca_values.append(ca_val)
            marge_brute.append(marge_val)
            taux_marge.append(round(marge_val / ca_val * 100, 1) if ca_val else 0)

        avg_taux = round(sum(taux_marge) / len(taux_marge), 1) if taux_marge else 0
        return Response({
            'labels': labels, 'marge_brute': marge_brute, 'taux_marge': taux_marge,
            'ca': ca_values, 'taux_moyen': avg_taux, 'total_marge': sum(marge_brute)
        })

    # ── 3. Predictions ───────────────────────────────────
    @action(detail=False, methods=['get'])
    def predictions(self, request):
        today = timezone.now().date()
        start_date = (today - relativedelta(months=11)).replace(day=1)

        ca_data = get_validated_invoices_queryset().filter(
            date__date__gte=start_date, date__date__lte=today
        ).annotate(month=TruncMonth('date')).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        ).order_by('month')

        ca_map = {item['month'].strftime('%Y-%m'): float(item['total']) for item in ca_data}
        labels, historique = fill_monthly_series(ca_map, start_date, today)

        predictions_ma = moving_average(historique)
        predictions_lr = linear_regression(historique)
        predictions_combined = combined_prediction(predictions_ma, predictions_lr)
        prediction_labels = build_prediction_labels(today + relativedelta(months=1))

        return Response({
            'labels': labels, 'historique': historique,
            'prediction_labels': prediction_labels,
            'predictions': predictions_combined,
            'predictions_ma': predictions_ma, 'predictions_lr': predictions_lr,
            'tendance': compute_trend(historique),
            'confiance': compute_confidence(historique)
        })

    # ── 4. KPIs ──────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def kpis(self, request):
        cache_key = f'finance_kpis_{timezone.now().strftime("%Y-%m-%d-%H")}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        start_of_year = today.replace(month=1, day=1)

        monthly_invoices = get_validated_invoices_queryset().filter(
            date__date__gte=start_of_month, date__date__lte=today
        )
        monthly_stats = monthly_invoices.aggregate(
            ca=Coalesce(Sum('total_ttc'), Decimal('0')), count=Count('id')
        )
        panier_moyen_mois = float(monthly_stats['ca']) / monthly_stats['count'] if monthly_stats['count'] else 0

        yearly_invoices = get_validated_invoices_queryset().filter(
            date__date__gte=start_of_year, date__date__lte=today
        )
        yearly_stats = yearly_invoices.aggregate(
            ca=Coalesce(Sum('total_ttc'), Decimal('0')), count=Count('id')
        )
        panier_moyen_annee = float(yearly_stats['ca']) / yearly_stats['count'] if yearly_stats['count'] else 0

        ca_month, marge_month = calculate_margin_for_invoices(monthly_invoices)
        taux_marge = round(marge_month / ca_month * 100, 1) if ca_month else 0

        stock_value = Produit.objects.aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']

        last_30_days = today - timedelta(days=30)
        invoices_30d = get_validated_invoices_queryset().filter(
            date__date__gte=last_30_days, date__date__lte=today
        )
        cogs_alloc = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=invoices_30d
        ).aggregate(total=Coalesce(Sum(F('quantity') * F('cost_price'), output_field=DecimalField()), Decimal('0')))['total']
        cogs_unalloc = FactureProduit.objects.filter(facture__in=invoices_30d).annotate(
            has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
        ).filter(has_alloc=False).aggregate(
            total=Coalesce(Sum(F('quantity') * F('produit__pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']
        cogs_30d = (cogs_alloc or 0) + (cogs_unalloc or 0)
        dsi = round(float(stock_value) / (float(cogs_30d) / 30), 0) if cogs_30d else 0

        prev_month_start = start_of_month - relativedelta(months=1)
        prev_month_end = start_of_month - timedelta(days=1)
        prev_month_ca = get_validated_invoices_queryset().filter(
            date__date__gte=prev_month_start, date__date__lte=prev_month_end
        ).aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca'] or 0
        croissance = round(((float(monthly_stats['ca']) - float(prev_month_ca)) / float(prev_month_ca)) * 100, 1) if prev_month_ca else 0

        data = {
            'panier_moyen': {'mois': round(panier_moyen_mois, 0), 'annee': round(panier_moyen_annee, 0)},
            'taux_marge': taux_marge, 'dsi': dsi,
            'ca_mois': float(monthly_stats['ca']), 'nb_ventes_mois': monthly_stats['count'],
            'ca_annee': float(yearly_stats['ca']), 'nb_ventes_annee': yearly_stats['count'],
            'stock_value': float(stock_value), 'croissance_mensuelle': croissance
        }
        cache.set(cache_key, data, 60 * 15)
        return Response(data)

    # ── 5. Top Products ────────────────────────────────────
    @action(detail=False, methods=['get'])
    def top_products(self, request):
        periode = request.query_params.get('periode', 'mois')
        critere = request.query_params.get('critere', 'ca')
        today = timezone.now().date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__date__gte=start_date, date__date__lte=today
        )

        stats = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=base_qs
        ).values(
            'facture_produit__produit__id',
            'facture_produit__produit__name',
            'facture_produit__produit__cip1'
        ).annotate(
            ca_ht=Sum(
                (F('quantity') * (F('selling_price') - F('facture_produit__discount'))) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100),
                output_field=DecimalField()
            ),
            marge=Sum(
                ((F('selling_price') - F('facture_produit__discount')) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100) - F('cost_price')) * F('quantity'),
                output_field=DecimalField()
            ),
            quantite=Sum('quantity')
        ).order_by('-' + ('marge' if critere == 'marge' else 'ca_ht'))[:50]

        data = []
        for item in stats:
            ca = float(item['ca_ht'] or 0)
            marge = float(item['marge'] or 0)
            data.append({
                'id': item['facture_produit__produit__id'],
                'nom': item['facture_produit__produit__name'],
                'cip': item['facture_produit__produit__cip1'],
                'ca': ca,
                'marge': marge,
                'taux_marge': round((marge / ca) * 100, 1) if ca > 0 else 0,
                'quantite': item['quantite']
            })

        return Response({'periode': periode, 'critere': critere, 'data': data})

    # ── 6. Repartition CA ─────────────────────────────────
    @action(detail=False, methods=['get'])
    def repartition_ca(self, request):
        by = request.query_params.get('by', 'categorie')
        periode = request.query_params.get('periode', 'mois')
        today = timezone.now().date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__date__gte=start_date, date__date__lte=today
        )
        alloc_qs = FactureProduitAllocation.objects.filter(facture_produit__facture__in=base_qs)

        if by == 'fournisseur':
            from django.db.models.functions import Coalesce as CoalesceFunc
            data = alloc_qs.annotate(
                is_inventory_lot=Case(
                    When(stock_lot__lot__istartswith='LOT-INV', then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField()
                ),
                fournisseur_id_resolved=CoalesceFunc(
                    'stock_lot__fournisseur__id',
                    'facture_produit__produit__fournisseur__id'
                ),
                fournisseur_name_resolved=Case(
                    When(
                        stock_lot__lot__istartswith='LOT-INV',
                        stock_lot__fournisseur__isnull=True,
                        facture_produit__produit__fournisseur__isnull=True,
                        then=Value('Stock Inventaire')
                    ),
                    default=CoalesceFunc(
                        'stock_lot__fournisseur__name',
                        'facture_produit__produit__fournisseur__name'
                    ),
                    output_field=CharField()
                )
            ).values('fournisseur_id_resolved', 'fournisseur_name_resolved').annotate(
                ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
            ).order_by('-ca')[:10]

            result = [
                {
                    'id': item['fournisseur_id_resolved'] or 0,
                    'nom': item['fournisseur_name_resolved'] or 'Inconnu',
                    'ca': float(item['ca'])
                }
                for item in data
            ]
        else:
            data = alloc_qs.values(
                'facture_produit__produit__rayon__id',
                'facture_produit__produit__rayon__name'
            ).annotate(
                ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
            ).order_by('-ca')[:10]

            result = [
                {
                    'id': item['facture_produit__produit__rayon__id'] or 0,
                    'nom': item['facture_produit__produit__rayon__name'] or 'Non catégorisé',
                    'ca': float(item['ca'])
                }
                for item in data
            ]

        total = sum(item['ca'] for item in result)
        for item in result:
            item['pourcentage'] = round((item['ca'] / total) * 100, 1) if total > 0 else 0

        return Response({'by': by, 'periode': periode, 'total': total, 'data': result})

    # ── 7. Analyse Categories ─────────────────────────────
    @action(detail=False, methods=['get'])
    def analyse_categories(self, request):
        cat_type = request.query_params.get('type', 'rayon')
        periode = request.query_params.get('periode', 'mois')
        today = timezone.now().date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__date__gte=start_date, date__date__lte=today
        )
        alloc_qs = FactureProduitAllocation.objects.filter(facture_produit__facture__in=base_qs)

        if cat_type == 'groupe':
            id_field = 'facture_produit__produit__groupe__id'
            name_field = 'facture_produit__produit__groupe__nom'
        elif cat_type == 'forme':
            id_field = 'facture_produit__produit__forme__id'
            name_field = 'facture_produit__produit__forme__nom'
        else:
            id_field = 'facture_produit__produit__rayon__id'
            name_field = 'facture_produit__produit__rayon__name'

        stats = alloc_qs.values(id_field, name_field).annotate(
            ca_ht=Sum(
                (F('quantity') * (F('selling_price') - F('facture_produit__discount'))) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100),
                output_field=DecimalField()
            ),
            marge=Sum(
                ((F('selling_price') - F('facture_produit__discount')) / (1 + Coalesce(F('facture_produit__tva'), Value(0)) / 100) - F('cost_price')) * F('quantity'),
                output_field=DecimalField()
            ),
            nb_ventes=Count('id')
        ).order_by('-ca_ht')

        total_ca = sum(float(item['ca_ht'] or 0) for item in stats) or 1
        total_marge = sum(float(item['marge'] or 0) for item in stats)

        result = []
        for item in stats:
            ca = float(item['ca_ht'] or 0)
            marge = float(item['marge'] or 0)
            result.append({
                'id': item[id_field] or 0,
                'nom': item[name_field] or 'Inconnu',
                'ca': ca,
                'marge': marge,
                'taux_marge': round((marge / ca) * 100, 1) if ca > 0 else 0,
                'pourcentage_ca': round((ca / total_ca) * 100, 1),
                'nb_ventes': item['nb_ventes']
            })

        return Response({
            'type': cat_type, 'periode': periode,
            'total_ca': total_ca, 'total_marge': total_marge,
            'taux_marge_global': round((total_marge / total_ca) * 100, 1) if total_ca > 0 else 0,
            'data': result
        })

    # ── 8. Evolution Categories ────────────────────────────
    @action(detail=False, methods=['get'])
    def evolution_categories(self, request):
        cat_type = request.query_params.get('type', 'rayon')
        top_n = int(request.query_params.get('top', 5))
        today = timezone.now().date()
        start_date = (today - relativedelta(months=11)).replace(day=1)

        if cat_type == 'groupe':
            id_field = 'facture_produit__produit__groupe__id'
            name_field = 'facture_produit__produit__groupe__nom'
        elif cat_type == 'forme':
            id_field = 'facture_produit__produit__forme__id'
            name_field = 'facture_produit__produit__forme__nom'
        else:
            id_field = 'facture_produit__produit__rayon__id'
            name_field = 'facture_produit__produit__rayon__name'

        top_categories = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=get_validated_invoices_queryset().filter(
                date__date__gte=start_date, date__date__lte=today
            )
        ).values(id_field, name_field).annotate(
            total_ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
        ).order_by('-total_ca')[:top_n]

        top_ids = [item[id_field] for item in top_categories if item[id_field]]
        category_names = {item[id_field]: item[name_field] for item in top_categories}

        monthly_data = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=get_validated_invoices_queryset().filter(
                date__date__gte=start_date, date__date__lte=today
            ),
            **{f'{id_field}__in': top_ids}
        ).annotate(
            month=TruncMonth('facture_produit__facture__date')
        ).values('month', id_field).annotate(
            ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
        ).order_by('month')

        labels = build_monthly_labels(start_date, today)
        series = {}
        for cat_id in top_ids:
            series[cat_id] = {'id': cat_id, 'nom': category_names.get(cat_id, 'Inconnu'), 'data': [0] * len(labels)}

        for item in monthly_data:
            cat_id = item[id_field]
            if cat_id in series:
                month_key = item['month'].strftime('%Y-%m')
                current = start_date
                for i, _ in enumerate(labels):
                    if current.strftime('%Y-%m') == month_key:
                        series[cat_id]['data'][i] = float(item['ca'])
                        break
                    current = current + relativedelta(months=1)

        return Response({'type': cat_type, 'labels': labels, 'series': list(series.values())})

    # ── 9. Analyse Marges ─────────────────────────────────
    @action(detail=False, methods=['get'])
    def analyse_marges(self, request):
        today = timezone.now().date()
        start_date = today - relativedelta(months=3)

        base_qs = FactureProduit.objects.filter(
            produit__isnull=False,
            facture__date__date__gte=start_date,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            num_p=Count('facture__paiements')
        ).exclude(facture__status='VAL', num_p=0)

        stats_globales = base_qs.aggregate(
            total_qty=Coalesce(Sum('quantity'), 0),
            nb_produits=Count('produit', distinct=True)
        )
        total_ventes_qty = stats_globales['total_qty']
        nb_produits_distincts = stats_globales['nb_produits'] or 1
        seuil_volume_eleve = (total_ventes_qty / nb_produits_distincts) * 1.5

        produits_stats = base_qs.values('produit__id', 'produit__name', 'produit__cost_price').annotate(
            volume_total=Sum('quantity'),
            ca_ht=Sum(
                (F('quantity') * (F('selling_price') - F('discount'))) / (1 + Coalesce(F('tva'), Value(0)) / 100),
                output_field=DecimalField()
            ),
            marge_totale=Sum(
                ((F('selling_price') - F('discount')) / (1 + Coalesce(F('tva'), Value(0)) / 100) - F('produit__cost_price')) * F('quantity'),
                output_field=DecimalField()
            )
        )

        opportunites_nego, stock_dormant, suggestions_prix = [], [], []
        for p in produits_stats:
            volume = p['volume_total']
            ca_ht = float(p['ca_ht'] or 0)
            marge_totale = float(p['marge_totale'] or 0)
            cost_price = float(p['produit__cost_price'] or 0)
            if ca_ht <= 0 or volume <= 0:
                continue
            taux_marge = (marge_totale / ca_ht) * 100
            selling_ht_moyen = ca_ht / volume

            if taux_marge < 15 and volume > seuil_volume_eleve:
                opportunites_nego.append({
                    'id': p['produit__id'], 'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1), 'volume': volume,
                    'marge_perdue': round((0.15 * ca_ht) - marge_totale, 2)
                })
            if taux_marge > 40 and volume < (seuil_volume_eleve / 4):
                stock_dormant.append({
                    'id': p['produit__id'], 'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1), 'volume': volume,
                    'prix_actuel_ht': round(selling_ht_moyen, 2)
                })
            if taux_marge < 10:
                suggestions_prix.append({
                    'id': p['produit__id'], 'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1),
                    'prix_conseille_ht': round(cost_price * 1.25, 2)
                })

        return Response({
            'opportunites_nego': opportunites_nego[:20],
            'stock_dormant': stock_dormant[:20],
            'suggestions_prix': suggestions_prix[:20],
            'stats_globales': {
                'volume_moyen': round(seuil_volume_eleve / 1.5, 1),
                'nb_produits_analyses': len(produits_stats)
            }
        })

    # ── 10. Analyse Fournisseurs ──────────────────────────
    @action(detail=False, methods=['get'])
    def analyse_fournisseurs(self, request):
        from ..models import Fournisseur, StockLot, StockAdjustment
        from collections import defaultdict
        today = timezone.now().date()
        start_date = today - relativedelta(months=12)

        fournisseurs = list(Fournisseur.objects.filter(
            stocklot__date_reception__date__gte=start_date
        ).distinct())

        if not fournisseurs:
            return Response([])

        fournisseur_ids = [f.id for f in fournisseurs]

        # 1. Récupérer TOUS les lots de ces fournisseurs en UNE SEULE requête
        all_lots = StockLot.objects.filter(
            fournisseur_id__in=fournisseur_ids,
            date_reception__date__gte=start_date
        ).order_by('date_reception')

        # Grouper les lots par fournisseur en mémoire
        lots_by_fournisseur = defaultdict(list)
        for lot in all_lots:
            lots_by_fournisseur[lot.fournisseur_id].append(lot)

        # 2. Récupérer TOUS les ajustements de stock groupés en UNE SEULE requête
        all_adjustments = StockAdjustment.objects.filter(
            stock_lot__fournisseur_id__in=fournisseur_ids,
            reason_type__in=['AVARIE', 'CASSE', 'ERR_ENTREE', 'PERIME'],
            created_at__date__gte=start_date
        ).values('stock_lot__fournisseur_id').annotate(
            count=Count('id')
        )
        adjustments_map = {item['stock_lot__fournisseur_id']: item['count'] for item in all_adjustments}

        result = []
        for f in fournisseurs:
            lots = lots_by_fournisseur[f.id]
            nb_livraisons = len(lots)
            if nb_livraisons == 0:
                continue

            # Calculs rapides en mémoire RAM
            total_achat = sum(float(lot.quantity_initial * lot.price_cost) for lot in lots)
            problemes = adjustments_map.get(f.id, 0)
            
            taux_probleme = min(1.0, problemes / nb_livraisons) if nb_livraisons > 0 else 0
            score_qualite = 100 * (1.0 - taux_probleme)

            dates_livraison = [lot.date_reception for lot in lots]
            if len(dates_livraison) > 1:
                first_date = dates_livraison[0]
                days = [(d - first_date).days for d in dates_livraison]
                diffs = np.diff(days)
                if len(diffs) > 0:
                    std_dev = np.std(diffs)
                    score_regularite = max(0, float(100 - (std_dev * 2)))
                else:
                    score_regularite = 100
            else:
                score_regularite = 50

            score_volume = min(100, (np.log10(max(1, total_achat)) / 7.0) * 100)
            score_global = (score_volume * 0.3) + (score_qualite * 0.3) + (score_regularite * 0.4)

            result.append({
                'id': f.id, 'nom': f.name,
                'score_global': round(score_global, 1),
                'details': {
                    'volume': {'valeur': total_achat, 'score': round(score_volume, 1)},
                    'qualite': {'incidents': problemes, 'score': round(score_qualite, 1)},
                    'regularite': {'nb_livraisons': nb_livraisons, 'score': round(score_regularite, 1)}
                }
            })

        result.sort(key=lambda x: x['score_global'], reverse=True)
        return Response(result)

    # ── 11. Comparaison Prix Achat ────────────────────────
    @action(detail=False, methods=['get'])
    def comparaison_prix_achat(self, request):
        from ..models import StockLot
        from collections import defaultdict
        today = timezone.now().date()
        start_date = today - relativedelta(months=12)

        produits_multi_source = StockLot.objects.filter(
            date_reception__date__gte=start_date
        ).exclude(
            Q(fournisseur__isnull=True) | Q(fournisseur__name__iexact='Inconnu')
        ).values('produit').annotate(
            nb_fournisseurs=Count('fournisseur', distinct=True)
        ).filter(nb_fournisseurs__gt=1)

        product_ids = [p['produit'] for p in produits_multi_source]
        
        if not product_ids:
            return Response([])

        # Une seule requête d'agrégation pour tous les produits d'intérêt
        all_lots = StockLot.objects.filter(
            produit_id__in=product_ids,
            date_reception__date__gte=start_date
        ).values('produit_id', 'produit__name', 'fournisseur__name').annotate(
            avg_price=Avg('price_cost')
        )

        lots_by_product = defaultdict(list)
        for lot in all_lots:
            lots_by_product[lot['produit_id']].append(lot)

        results = []
        for pid in product_ids:
            lots = lots_by_product.get(pid, [])
            if not lots:
                continue
            produit_name = lots[0]['produit__name']
            prices = [{'fournisseur': l['fournisseur__name'], 'prix_moyen': float(l['avg_price'])} for l in lots]
            
            min_price = min(p['prix_moyen'] for p in prices)
            max_price = max(p['prix_moyen'] for p in prices)
            ecart_max = ((max_price - min_price) / min_price) * 100 if min_price > 0 else 0
            
            results.append({
                'id': pid, 'produit': produit_name, 'offres': prices,
                'ecart_pourcentage': round(ecart_max, 1), 'meilleur_prix': min_price
            })

        results.sort(key=lambda x: x['ecart_pourcentage'], reverse=True)
        return Response(results)

    # ── 12. Repartition Achats ────────────────────────────
    @action(detail=False, methods=['get'])
    def repartition_achats(self, request):
        from ..models import StockLot
        today = timezone.now().date()
        start_date = today - relativedelta(months=12)

        achats = StockLot.objects.filter(
            date_reception__date__gte=start_date
        ).exclude(
            Q(fournisseur__isnull=True) | Q(fournisseur__name__iexact='Inconnu')
        ).values('fournisseur__id', 'fournisseur__name').annotate(
            total_achat=Coalesce(Sum(F('quantity_initial') * F('price_cost'), output_field=DecimalField()), Decimal('0'))
        ).order_by('-total_achat')

        total_global = sum(a['total_achat'] for a in achats)
        data = []
        for a in achats:
            montant = float(a['total_achat'])
            pourcentage = (montant / float(total_global)) * 100 if total_global > 0 else 0
            data.append({
                'id': a['fournisseur__id'], 'nom': a['fournisseur__name'] or "Inconnu",
                'value': montant, 'pourcentage': round(pourcentage, 1)
            })

        return Response({'total_achats': total_global, 'data': data})

    # ── 13. Margin Variance Analysis ──────────────────────
    @action(detail=False, methods=['get'])
    def margin_variance_analysis(self, request):
        today = timezone.now().date()
        is_english = request.query_params.get('lang', 'fr') == 'en'

        p1_start = request.query_params.get('p1_start', today.isoformat())
        p1_end = request.query_params.get('p1_end', today.isoformat())
        yesterday = today - timedelta(days=1)
        p2_start = request.query_params.get('p2_start', yesterday.isoformat())
        p2_end = request.query_params.get('p2_end', yesterday.isoformat())

        def get_period_stats(start, end):
            factures = get_validated_invoices_queryset().filter(
                date__date__gte=start, date__date__lte=end
            )
            global_remise = factures.aggregate(s=Coalesce(Sum('remise'), Decimal('0')))['s']
            total_ca = factures.aggregate(s=Coalesce(Sum('total_ttc'), Decimal('0')))['s']

            m_alloc = FactureProduitAllocation.objects.filter(
                facture_produit__facture__in=factures
            ).aggregate(
                m=Coalesce(Sum((F('facture_produit__selling_price') - F('facture_produit__discount') - F('cost_price')) * F('quantity')), Decimal('0'))
            )['m']

            m_unalloc = FactureProduit.objects.filter(
                facture__in=factures
            ).annotate(
                has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
            ).filter(has_alloc=False).aggregate(
                m=Coalesce(Sum((F('selling_price') - F('discount') - F('produit__pmp')) * F('quantity')), Decimal('0'))
            )['m']

            total_margin = m_alloc + m_unalloc - global_remise
            margin_pct = (total_margin / total_ca * 100) if total_ca > 0 else 0

            products = FactureProduit.objects.filter(facture__in=factures).values(
                'produit__id', 'produit__name'
            ).annotate(
                ca=Sum(F('quantity') * (F('selling_price') - F('discount'))),
                qty=Sum('quantity')
            ).order_by('-ca')[:50]

            return {
                'ca': float(total_ca), 'margin': float(total_margin),
                'margin_pct': float(margin_pct),
                'products': {p['produit__id']: p for p in products}
            }

        stats1 = get_period_stats(p1_start, p1_end)
        stats2 = get_period_stats(p2_start, p2_end)
        variance_pct = stats1['margin_pct'] - stats2['margin_pct']

        suspicious_products = FactureProduit.objects.filter(
            facture__date__date__gte=p1_start,
            facture__date__date__lte=p1_end,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            unit_margin=F('selling_price') - F('discount') - Coalesce(F('produit__pmp'), Value(0, output_field=DecimalField())),
            unit_margin_pct=Case(
                When(selling_price__gt=0, then=(F('selling_price') - F('discount') - F('produit__pmp')) / F('selling_price') * 100),
                default=Value(0, output_field=DecimalField())
            )
        ).filter(Q(unit_margin_pct__gt=80) | Q(unit_margin_pct__lt=5)).values(
            'produit__id', 'produit__name', 'unit_margin_pct', 'selling_price', 'produit__pmp'
        ).distinct()[:10]

        insights = []
        if variance_pct > 5:
            insights.append({
                'fr': f"Hausse significative de la marge (+{variance_pct:.1f}%). Vérifiez les produits à forte marge ou les erreurs de prix d'achat.",
                'en': f"Significant margin increase (+{variance_pct:.1f}%). Check high-margin products or potential purchase cost errors."
            })
        elif variance_pct < -5:
            insights.append({
                'fr': f"Baisse importante de la marge ({variance_pct:.1f}%). Possible augmentation des coûts ou changement de mix produit.",
                'en': f"Significant margin drop ({variance_pct:.1f}%). Possible cost increase or change in product mix."
            })
        if suspicious_products.exists():
            insights.append({
                'fr': f"Détection de {len(suspicious_products)} produits avec des marges atypiques (>80% ou <5%). Cela peut fausser les résultats.",
                'en': f"Detected {len(suspicious_products)} products with abnormal margins (>80% or <5%). This may skew the results."
            })

        return Response({
            'period1': {'label': 'Aujourd\'hui' if not is_english else 'Today', 'stats': stats1},
            'period2': {'label': 'Hier' if not is_english else 'Yesterday', 'stats': stats2},
            'variance_pct': round(variance_pct, 2),
            'suspicious_products': suspicious_products,
            'insights': insights,
            'labels': {
                'ca': {'fr': 'Chiffre d\'Affaires', 'en': 'Turnover'},
                'margin': {'fr': 'Marge Brute', 'en': 'Gross Margin'},
                'margin_pct': {'fr': 'Taux de Marge', 'en': 'Margin Rate'}
            }
        })
