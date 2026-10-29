"""
Finance Statistics ViewSet - Refactorisé.
Les services sous-jacents sont dans api/services/finance_*.py
"""
from datetime import timedelta
from decimal import Decimal

import numpy as np
from dateutil.relativedelta import relativedelta
from django.core.cache import cache
from django.db.models import (
    Avg,
    Count,
    DecimalField,
    Exists,
    F,
    OuterRef,
    Q,
    Sum,
)
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    FactureProduit,
    FactureProduitAllocation,
    Produit,
)
from ..services.finance_base_queries import get_validated_invoices_queryset
from ..services.finance_formatters import (
    build_monthly_labels,
    build_prediction_labels,
    fill_monthly_series,
)
from ..services.finance_marges import (
    build_monthly_margin_map,
    calculate_margin_for_invoices,
    finance_sales_records,
    group_finance_records,
)
from ..services.finance_predictions import (
    combined_prediction,
    compute_confidence,
    compute_trend,
    linear_regression,
    moving_average,
)
from ..utils.dates import day_start
from ..utils.validation import parse_date_param, parse_int


class FinanceStatsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _parse_iso_date(value, field='date'):
        """Parse une date ISO (YYYY-MM-DD).

        Retourne None si absente ; lève ValidationError (400) si la valeur
        fournie est invalide — plus de fallback silencieux.
        """
        return parse_date_param(value, field=field)

    # ── 1. CA Evolution ──────────────────────────────────
    @action(detail=False, methods=['get'])
    def ca_evolution(self, request):
        today = timezone.localtime(timezone.now()).date()
        start_date = (today - relativedelta(months=11)).replace(day=1)
        start_date_n1 = start_date - relativedelta(years=1)

        current_map = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        ).annotate(month=TruncMonth('date')).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal(0))
        )
        current_map = {item['month'].strftime('%Y-%m'): float(item['total']) for item in current_map}

        n1_map = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date_n1), date__lt=day_start(start_date)
        ).annotate(month=TruncMonth('date')).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal(0))
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
        today = timezone.localtime(timezone.now()).date()
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

        total_ca = sum(ca_values)
        avg_taux = round(sum(marge_brute) / total_ca * 100, 1) if total_ca else 0
        return Response({
            'labels': labels, 'marge_brute': marge_brute, 'taux_marge': taux_marge,
            'ca': ca_values, 'taux_moyen': avg_taux, 'total_marge': sum(marge_brute)
        })

    # ── 3. Predictions ───────────────────────────────────
    @action(detail=False, methods=['get'])
    def predictions(self, request):
        today = timezone.localtime(timezone.now()).date()
        start_date = (today - relativedelta(months=11)).replace(day=1)

        ca_data = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        ).annotate(month=TruncMonth('date')).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal(0))
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
        cache_key = f'finance_kpis_v2_{timezone.now().strftime("%Y-%m-%d-%H")}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        today = timezone.localtime(timezone.now()).date()
        start_of_month = today.replace(day=1)
        start_of_year = today.replace(month=1, day=1)

        monthly_invoices = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_of_month), date__lt=day_start(today + timedelta(days=1))
        )
        monthly_stats = monthly_invoices.aggregate(
            ca=Coalesce(Sum('total_ttc'), Decimal(0)), count=Count('id')
        )
        panier_moyen_mois = float(monthly_stats['ca']) / monthly_stats['count'] if monthly_stats['count'] else 0

        yearly_invoices = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_of_year), date__lt=day_start(today + timedelta(days=1))
        )
        yearly_stats = yearly_invoices.aggregate(
            ca=Coalesce(Sum('total_ttc'), Decimal(0)), count=Count('id')
        )
        panier_moyen_annee = float(yearly_stats['ca']) / yearly_stats['count'] if yearly_stats['count'] else 0

        ca_month, marge_month = calculate_margin_for_invoices(monthly_invoices)
        taux_marge = round(marge_month / ca_month * 100, 1) if ca_month else 0

        stock_value = Produit.objects.aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal(0))
        )['total']

        last_30_days = today - timedelta(days=30)
        invoices_30d = get_validated_invoices_queryset().filter(
            date__gte=day_start(last_30_days), date__lt=day_start(today + timedelta(days=1))
        )
        cogs_alloc = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=invoices_30d
        ).aggregate(total=Coalesce(Sum(F('quantity') * F('cost_price'), output_field=DecimalField()), Decimal(0)))['total']
        cogs_unalloc = FactureProduit.objects.filter(facture__in=invoices_30d).annotate(
            has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
        ).filter(has_alloc=False).aggregate(
            total=Coalesce(Sum(F('quantity') * F('produit__pmp'), output_field=DecimalField()), Decimal(0))
        )['total']
        cogs_30d = (cogs_alloc or 0) + (cogs_unalloc or 0)
        dsi = round(float(stock_value) / (float(cogs_30d) / 30), 0) if cogs_30d else 0

        prev_month_start = start_of_month - relativedelta(months=1)
        prev_month_end = start_of_month - timedelta(days=1)
        prev_month_ca = get_validated_invoices_queryset().filter(
            date__gte=day_start(prev_month_start), date__lt=day_start(prev_month_end + timedelta(days=1))
        ).aggregate(ca=Coalesce(Sum('total_ttc'), Decimal(0)))['ca'] or 0
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
        today = timezone.localtime(timezone.now()).date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        )

        stats = group_finance_records(finance_sales_records(invoices=base_qs))
        ranked = sorted(stats.values(), key=lambda p: p['marge' if critere == 'marge' else 'ca'], reverse=True)[:50]
        data = [
            {key: float(p[key]) if key in ('ca', 'marge') else p[key]
             for key in ('id', 'nom', 'cip', 'ca', 'marge', 'taux_marge', 'quantite')}
            for p in ranked
        ]

        return Response({'periode': periode, 'critere': critere, 'data': data})

    # ── 6. Repartition CA ─────────────────────────────────
    @action(detail=False, methods=['get'])
    def repartition_ca(self, request):
        by = request.query_params.get('by', 'categorie')
        periode = request.query_params.get('periode', 'mois')
        today = timezone.localtime(timezone.now()).date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        )
        records = finance_sales_records(invoices=base_qs)
        grouped = group_finance_records(records, 'fournisseur' if by == 'fournisseur' else 'rayon')
        totals = {key: sum(p['months'].values(), Decimal(0)) for key, p in grouped.items()}
        result = [
            {'id': key, 'nom': grouped[key]['nom'], 'ca': float(ca)}
            for key, ca in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:10]
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
        today = timezone.localtime(timezone.now()).date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        )
        dimension = cat_type if cat_type in ('groupe', 'forme') else 'rayon'
        grouped = group_finance_records(finance_sales_records(invoices=base_qs), dimension)
        stats = sorted(grouped.values(), key=lambda p: p['ca'], reverse=True)
        total_ca = float(sum((p['ca'] for p in stats), Decimal(0)))
        total_marge = float(sum((p['marge'] for p in stats), Decimal(0)))
        result = [
            {
                'id': p['id'], 'nom': p['nom'], 'ca': float(p['ca']),
                'marge': float(p['marge']), 'taux_marge': p['taux_marge'],
                'pourcentage_ca': round(float(p['ca']) / total_ca * 100, 1) if total_ca else 0,
                'nb_ventes': p['nb_ventes'],
            }
            for p in stats
        ]

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
        top_n = parse_int(request.query_params.get('top', 5), field='top', min_value=1, max_value=200)
        today = timezone.localtime(timezone.now()).date()
        start_date = (today - relativedelta(months=11)).replace(day=1)

        dimension = cat_type if cat_type in ('groupe', 'forme') else 'rayon'
        grouped = group_finance_records(finance_sales_records(start_date, today), dimension)
        top_categories = sorted(grouped.values(), key=lambda p: sum(p['months'].values()), reverse=True)[:top_n]
        labels = build_monthly_labels(start_date, today)
        keys = [(start_date + relativedelta(months=i)).strftime('%Y-%m') for i in range(len(labels))]
        series = [
            {'id': p['id'], 'nom': p['nom'], 'data': [float(p['months'].get(key, 0)) for key in keys]}
            for p in top_categories
        ]
        return Response({'type': cat_type, 'labels': labels, 'series': series})

    # ── 9. Analyse Marges ─────────────────────────────────
    @action(detail=False, methods=['get'])
    def analyse_marges(self, request):
        today = timezone.localtime(timezone.now()).date()
        start_date = today - relativedelta(months=3)

        grouped = group_finance_records(finance_sales_records(start_date, today))
        total_ventes_qty = sum(p['quantite'] for p in grouped.values())
        nb_produits_distincts = len(grouped) or 1
        seuil_volume_eleve = (total_ventes_qty / nb_produits_distincts) * 1.5
        produits_stats = [
            {
                'produit__id': p['id'], 'produit__name': p['nom'],
                'produit__cost_price': p['achat'] / p['quantite'] if p['quantite'] else 0,
                'volume_total': p['quantite'], 'ca_ht': p['ca'], 'marge_totale': p['marge'],
            }
            for p in grouped.values()
        ]

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
        from collections import defaultdict

        from ..models import Fournisseur, StockAdjustment, StockLot
        today = timezone.localtime(timezone.now()).date()
        start_date = self._parse_iso_date(request.query_params.get('date_debut'), 'date_debut') or today - relativedelta(months=12)
        end_date = self._parse_iso_date(request.query_params.get('date_fin'), 'date_fin') or today

        fournisseurs = list(Fournisseur.objects.filter(
            stocklot__date_reception__gte=day_start(start_date),
            stocklot__date_reception__lt=day_start(end_date + timedelta(days=1))
        ).distinct())

        if not fournisseurs:
            return Response([])

        fournisseur_ids = [f.id for f in fournisseurs]

        # 1. Récupérer TOUS les lots de ces fournisseurs en UNE SEULE requête
        all_lots = StockLot.objects.filter(
            fournisseur_id__in=fournisseur_ids,
            date_reception__gte=day_start(start_date),
            date_reception__lt=day_start(end_date + timedelta(days=1))
        ).order_by('date_reception')

        # Grouper les lots par fournisseur en mémoire
        lots_by_fournisseur = defaultdict(list)
        for lot in all_lots:
            lots_by_fournisseur[lot.fournisseur_id].append(lot)

        # 2. Récupérer TOUS les ajustements de stock groupés en UNE SEULE requête
        all_adjustments = StockAdjustment.objects.filter(
            stock_lot__fournisseur_id__in=fournisseur_ids,
            reason_type__in=['AVARIE', 'CASSE', 'ERR_ENTREE', 'PERIME'],
            created_at__gte=day_start(start_date),
            created_at__lt=day_start(end_date + timedelta(days=1))
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
        from collections import defaultdict

        from ..models import StockLot
        today = timezone.localtime(timezone.now()).date()
        start_date = self._parse_iso_date(request.query_params.get('date_debut'), 'date_debut') or today - relativedelta(months=12)
        end_date = self._parse_iso_date(request.query_params.get('date_fin'), 'date_fin') or today

        produits_multi_source = StockLot.objects.filter(
            date_reception__gte=day_start(start_date),
            date_reception__lt=day_start(end_date + timedelta(days=1))
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
            date_reception__gte=day_start(start_date),
            date_reception__lt=day_start(end_date + timedelta(days=1))
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
        today = timezone.localtime(timezone.now()).date()
        start_date = self._parse_iso_date(request.query_params.get('date_debut'), 'date_debut') or today - relativedelta(months=12)
        end_date = self._parse_iso_date(request.query_params.get('date_fin'), 'date_fin') or today

        achats = StockLot.objects.filter(
            date_reception__gte=day_start(start_date),
            date_reception__lt=day_start(end_date + timedelta(days=1))
        ).exclude(
            Q(fournisseur__isnull=True) | Q(fournisseur__name__iexact='Inconnu')
        ).values('fournisseur__id', 'fournisseur__name').annotate(
            total_achat=Coalesce(Sum(F('quantity_initial') * F('price_cost'), output_field=DecimalField()), Decimal(0)),
            quantite=Coalesce(Sum('quantity_initial'), 0)
        ).order_by('-total_achat')

        total_global = sum(a['total_achat'] for a in achats)
        data = []
        for a in achats:
            montant = float(a['total_achat'])
            pourcentage = (montant / float(total_global)) * 100 if total_global > 0 else 0
            data.append({
                'id': a['fournisseur__id'], 'nom': a['fournisseur__name'] or "Inconnu",
                'value': montant, 'pourcentage': round(pourcentage, 1),
                'quantite': int(a['quantite'])
            })

        return Response({'total_achats': total_global, 'data': data})

    # ── 13. Margin Variance Analysis ──────────────────────
    @action(detail=False, methods=['get'])
    def margin_variance_analysis(self, request):
        today = timezone.localtime(timezone.now()).date()

        # Période glissante configurable : 7j, 30j, 90j (défaut: 7j)
        period_days = parse_int(request.query_params.get('period_days', 7), field='period_days', min_value=1, max_value=3650)
        if period_days not in (7, 30, 90):
            period_days = 7

        p1_end = today
        p1_start = today - timedelta(days=period_days - 1)
        p2_end = p1_start - timedelta(days=1)
        p2_start = p2_end - timedelta(days=period_days - 1)

        # Override manuel possible (400 si la date fournie est invalide)
        p1_start = parse_date_param(request.query_params.get('p1_start'), field='p1_start') or p1_start
        p1_end = parse_date_param(request.query_params.get('p1_end'), field='p1_end') or p1_end
        p2_start = parse_date_param(request.query_params.get('p2_start'), field='p2_start') or p2_start
        p2_end = parse_date_param(request.query_params.get('p2_end'), field='p2_end') or p2_end

        def get_period_stats(start, end):
            factures = get_validated_invoices_queryset().filter(
                date__gte=day_start(start), date__lt=day_start(end + timedelta(days=1))
            )
            total_ca = factures.aggregate(s=Coalesce(Sum('total_ttc'), Decimal(0)))['s']

            records = finance_sales_records(invoices=factures)
            total_ca_ht = sum((r['vente_ht'] for r in records), Decimal(0))
            total_margin = sum((r['vente_ht'] - r['achat'] for r in records), Decimal(0))
            margin_pct = total_margin / total_ca_ht * 100 if total_ca_ht > 0 else 0
            grouped = group_finance_records(records)
            products = sorted(grouped.values(), key=lambda p: p['ca'], reverse=True)[:50]
            return {
                'ca': float(total_ca), 'margin': float(total_margin),
                'margin_pct': float(margin_pct),
                'products': {
                    p['id']: {'produit__id': p['id'], 'produit__name': p['nom'],
                              'ca': float(sum(p['months'].values())), 'qty': p['quantite']}
                    for p in products
                }
            }

        stats1 = get_period_stats(p1_start, p1_end)
        stats2 = get_period_stats(p2_start, p2_end)
        variance_pct = stats1['margin_pct'] - stats2['margin_pct']

        suspicious_products = []
        for p in group_finance_records(finance_sales_records(p1_start, p1_end)).values():
            if p['taux_marge'] > 80 or p['taux_marge'] < 5:
                suspicious_products.append({
                    'produit__id': p['id'], 'produit__name': p['nom'],
                    'unit_margin_pct': p['taux_marge'],
                    'selling_price': float(p['ca'] / p['quantite']) if p['quantite'] else 0,
                    'produit__pmp': float(p['achat'] / p['quantite']) if p['quantite'] else 0,
                })
        suspicious_products = suspicious_products[:10]

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
        if suspicious_products:
            insights.append({
                'fr': f"Détection de {len(suspicious_products)} produits avec des marges atypiques (>80% ou <5%). Cela peut fausser les résultats.",
                'en': f"Detected {len(suspicious_products)} products with abnormal margins (>80% or <5%). This may skew the results."
            })

        p1_label = f"{p1_start} → {p1_end}" if isinstance(p1_start, str) else f"{p1_start.strftime('%d/%m/%Y')} → {p1_end.strftime('%d/%m/%Y')}"
        p2_label = f"{p2_start} → {p2_end}" if isinstance(p2_start, str) else f"{p2_start.strftime('%d/%m/%Y')} → {p2_end.strftime('%d/%m/%Y')}"

        return Response({
            'period1': {'label': p1_label, 'stats': stats1},
            'period2': {'label': p2_label, 'stats': stats2},
            'variance_pct': round(variance_pct, 2),
            'suspicious_products': suspicious_products,
            'insights': insights,
            'labels': {
                'ca': {'fr': 'Chiffre d\'Affaires', 'en': 'Turnover'},
                'margin': {'fr': 'Marge Brute', 'en': 'Gross Margin'},
                'margin_pct': {'fr': 'Taux de Marge', 'en': 'Margin Rate'}
            }
        })

    # ── Marge par Produit (top/bottom 20 + négatifs) ──────────────
    @action(detail=False, methods=['get'])
    def marge_par_produit(self, request):
        """
        Retourne les top 20 et bottom 20 produits par marge,
        ainsi que les produits vendus à perte (marge négative).
        Paramètres: periode=mois|trimestre|annee
        """
        periode = request.query_params.get('periode', 'mois')
        today = timezone.localtime(timezone.now()).date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        )

        # Produits avec allocation de stock (marge précise basée sur cost_price)
        # Produits sans allocation (marge basée sur pmp)
        # Fusionner les deux sources
        grouped = group_finance_records(finance_sales_records(invoices=base_qs))
        merged = {
            pid: {key: float(p[key]) if key in ('ca', 'marge') else p[key]
                  for key in ('id', 'nom', 'cip', 'ca', 'marge', 'quantite')}
            for pid, p in grouped.items()
        }

        all_products = list(merged.values())
        for p in all_products:
            p['taux_marge'] = round((p['marge'] / p['ca']) * 100, 1) if p['ca'] > 0 else 0

        # Trier par marge décroissante
        sorted_by_marge = sorted(all_products, key=lambda x: x['marge'], reverse=True)
        top_20 = sorted_by_marge[:20]
        bottom_20 = sorted_by_marge[-20:][::-1]  # pires en premier
        negative_margin = [p for p in all_products if p['marge'] < 0]

        return Response({
            'periode': periode,
            'top_20': top_20,
            'bottom_20': bottom_20,
            'negative_margin': negative_margin,
            'total_produits': len(all_products),
            'total_ca': round(sum(p['ca'] for p in all_products), 2),
            'total_marge': round(sum(p['marge'] for p in all_products), 2),
        })

    # ── Impact Promotions sur la Marge ────────────────────────────
    @action(detail=False, methods=['get'])
    def impact_promotions(self, request):
        """
        Compare le CA et la marge des ventes avec promotion (remise > 0)
        vs sans promotion.
        Paramètres: periode=mois|trimestre|annee
        """
        periode = request.query_params.get('periode', 'mois')
        today = timezone.localtime(timezone.now()).date()

        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:
            start_date = today.replace(day=1)

        base_qs = get_validated_invoices_queryset().filter(
            date__gte=day_start(start_date), date__lt=day_start(today + timedelta(days=1))
        )

        # Ventes avec remise (au niveau facture produit)
        records = finance_sales_records(invoices=base_qs)
        promo_invoices = set(base_qs.filter(remise__gt=0).values_list('pk', flat=True))

        # Avec promotion = discount > 0 ou facture avec remise globale
        with_promo = {'ca': Decimal(0), 'marge': Decimal(0), 'quantite': 0, 'count': 0}
        without_promo = dict(with_promo)
        for r in records:
            target = with_promo if r['discount'] > 0 or r['facture_id'] in promo_invoices else without_promo
            target['ca'] += r['vente_ht']
            target['marge'] += r['vente_ht'] - r['achat']
            target['quantite'] += r['qte']
            target['count'] += 1

        ca_promo = float(with_promo['ca'] or 0)
        ca_normal = float(without_promo['ca'] or 0)
        marge_promo = float(with_promo['marge'] or 0)
        marge_normal = float(without_promo['marge'] or 0)
        total_ca = ca_promo + ca_normal

        taux_marge_promo = round((marge_promo / ca_promo) * 100, 1) if ca_promo > 0 else 0
        taux_marge_normal = round((marge_normal / ca_normal) * 100, 1) if ca_normal > 0 else 0

        # CA "perdu" = ce qu'on aurait gagné sans la remise
        ca_perdu = 0
        remise_totale = float(sum((r['discount'] * r['qte'] for r in records), Decimal(0)))
        # Remise globale des factures avec remise
        remise_globale = float(
            base_qs.filter(remise__gt=0).aggregate(
                total=Coalesce(Sum('remise', output_field=DecimalField()), Decimal(0))
            )['total'] or 0
        )
        ca_perdu = round(remise_totale + remise_globale, 2)

        return Response({
            'periode': periode,
            'avec_promotion': {
                'ca': round(ca_promo, 2),
                'marge': round(marge_promo, 2),
                'taux_marge': taux_marge_promo,
                'quantite': int(with_promo['quantite'] or 0),
                'nb_lignes': with_promo['count'] or 0,
                'pct_ca': round((ca_promo / total_ca) * 100, 1) if total_ca > 0 else 0,
            },
            'sans_promotion': {
                'ca': round(ca_normal, 2),
                'marge': round(marge_normal, 2),
                'taux_marge': taux_marge_normal,
                'quantite': int(without_promo['quantite'] or 0),
                'nb_lignes': without_promo['count'] or 0,
                'pct_ca': round((ca_normal / total_ca) * 100, 1) if total_ca > 0 else 0,
            },
            'ca_perdu_remises': ca_perdu,
            'ecart_taux_marge': round(taux_marge_normal - taux_marge_promo, 1),
            'total_ca': round(total_ca, 2),
        })
