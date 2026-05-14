# -*- coding: utf-8 -*-
"""
Finance Statistics ViewSet - Advanced financial analytics and predictions.
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, BooleanField, Case, When, Value, Exists, OuterRef
from django.db.models.functions import TruncMonth, Coalesce, ExtractYear, ExtractMonth
from django.utils import timezone
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import statistics

from django.core.cache import cache

from ..models import Facture, FactureProduit, FactureProduitAllocation, Produit, Rayon, Caisse


class FinanceStatsViewSet(viewsets.ViewSet):
    """
    ViewSet pour les statistiques financières avancées et prédictions.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def ca_evolution(self, request):
        """
        Retourne l'évolution du CA mensuel sur 12 mois avec comparaison N-1.
        """
        today = timezone.now().date()
        # Last 12 months
        start_date = today - relativedelta(months=11)
        start_date = start_date.replace(day=1)
        
        # N-1 period (same 12 months, one year before)
        start_date_n1 = start_date - relativedelta(years=1)
        
        # Current year data
        ca_current = Facture.objects.filter(
            date__date__gte=start_date,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        ).order_by('month')
        
        # N-1 data
        ca_n1 = Facture.objects.filter(
            date__date__gte=start_date_n1,
            date__date__lt=start_date,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        ).order_by('month')
        
        # Build maps
        current_map = {item['month'].strftime('%Y-%m'): float(item['total']) for item in ca_current}
        n1_map = {}
        for item in ca_n1:
            # Shift month by +1 year to align with current
            shifted = item['month'] + relativedelta(years=1)
            n1_map[shifted.strftime('%Y-%m')] = float(item['total'])
        
        # Build response
        labels = []
        data = []
        comparaison_n1 = []
        
        month_names_fr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
                          'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        
        current = start_date
        while current <= today:
            key = current.strftime('%Y-%m')
            labels.append(f"{month_names_fr[current.month - 1]} {current.year % 100}")
            data.append(current_map.get(key, 0))
            comparaison_n1.append(n1_map.get(key, 0))
            current = current + relativedelta(months=1)
        
        # Calculate year-over-year growth using Decimals for precision
        total_current = sum(data)
        total_n1 = sum(comparaison_n1)
        
        total_current_dec = Decimal(str(total_current))
        total_n1_dec = Decimal(str(total_n1))
        croissance = 0
        if total_n1_dec > 0:
            croissance = round(float(((total_current_dec - total_n1_dec) / total_n1_dec) * Decimal('100.0')), 1)
        
        return Response({
            'labels': labels,
            'data': data,
            'comparaison_n1': comparaison_n1,
            'total_current': total_current,
            'total_n1': total_n1,
            'croissance_yoy': croissance
        })

    @action(detail=False, methods=['get'])
    def marges_evolution(self, request):
        """
        Retourne l'évolution des marges brutes mensuelles.
        Utilise FactureProduitAllocation pour traçabilité exacte.
        """
        # Start date: 12 months ago
        today = timezone.now().date()
        start_date = today - relativedelta(months=11)
        start_date = start_date.replace(day=1)

        # 1. Aggregate allocated items by month
        alloc_stats = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
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

        # 2. Aggregate unallocated items by month
        unalloc_items = FactureProduit.objects.filter(
            facture__date__date__gte=start_date,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
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

        # Build margin map
        margin_map = {}
        for item in alloc_stats:
            key = item['month'].strftime('%Y-%m')
            margin_map[key] = {
                'ca': float(item['ca_ht'] or 0),
                'marge': float(item['marge'] or 0)
            }
        
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
        
        # Build response
        labels = []
        marge_brute = []
        taux_marge = []
        ca_values = []
        
        month_names_fr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
                          'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        
        current = start_date
        while current <= today:
            key = current.strftime('%Y-%m')
            labels.append(f"{month_names_fr[current.month - 1]} {current.year % 100}")
            entry = margin_map.get(key, {'marge': 0, 'taux': 0, 'ca': 0})
            marge_brute.append(entry['marge'])
            taux_marge.append(entry['taux'])
            ca_values.append(entry['ca'])
            current = current + relativedelta(months=1)
        
        # Averages
        avg_taux = round(sum(taux_marge) / len(taux_marge), 1) if taux_marge else 0
        total_marge = sum(marge_brute)
        
        return Response({
            'labels': labels,
            'marge_brute': marge_brute,
            'taux_marge': taux_marge,
            'ca': ca_values,
            'taux_moyen': avg_taux,
            'total_marge': total_marge
        })

    @action(detail=False, methods=['get'])
    def predictions(self, request):
        """
        Prédictions du CA pour les 3 prochains mois.
        Méthodes : Moyenne mobile (3 mois) et Régression linéaire simple.
        """
        today = timezone.now().date()
        start_date = today - relativedelta(months=11)
        start_date = start_date.replace(day=1)
        
        # Get monthly CA
        ca_data = Facture.objects.annotate(num_p=Count('paiements')).filter(
            date__date__gte=start_date,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(status='VAL', num_p=0).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        ).order_by('month')
        
        # Build historical data
        month_names_fr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
                          'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        
        ca_map = {item['month'].strftime('%Y-%m'): float(item['total']) for item in ca_data}
        
        labels = []
        historique = []
        
        current = start_date
        while current <= today:
            key = current.strftime('%Y-%m')
            labels.append(f"{month_names_fr[current.month - 1]} {current.year % 100}")
            historique.append(ca_map.get(key, 0))
            current = current + relativedelta(months=1)
        
        # --- Prediction algorithms ---
        
        # 1. Moving Average (3 months)
        predictions_ma = []
        if len(historique) >= 3:
            last_3 = historique[-3:]
            ma = sum(last_3) / 3
            for i in range(3):
                predictions_ma.append(round(ma, 0))
        else:
            avg = sum(historique) / len(historique) if historique else 0
            predictions_ma = [round(avg, 0)] * 3
        
        # 2. Linear Regression (simple)
        predictions_lr = []
        if len(historique) >= 2:
            n = len(historique)
            x_mean = (n - 1) / 2
            y_mean = sum(historique) / n
            
            # Calculate slope
            numerator = sum((i - x_mean) * (historique[i] - y_mean) for i in range(n))
            denominator = sum((i - x_mean) ** 2 for i in range(n))
            
            slope = numerator / denominator if denominator != 0 else 0
            intercept = y_mean - slope * x_mean
            
            for i in range(3):
                pred = intercept + slope * (n + i)
                predictions_lr.append(max(0, round(pred, 0)))  # Don't predict negative
        else:
            predictions_lr = predictions_ma
        
        # Combined prediction (average of both methods)
        predictions_combined = [
            round((predictions_ma[i] + predictions_lr[i]) / 2, 0) 
            for i in range(3)
        ]
        
        # Prediction labels
        prediction_labels = []
        current = today + relativedelta(months=1)
        current = current.replace(day=1)
        for i in range(3):
            prediction_labels.append(f"{month_names_fr[current.month - 1]} {current.year % 100}")
            current = current + relativedelta(months=1)
        
        # Determine trend
        if len(historique) >= 3:
            recent = historique[-3:]
            older = historique[-6:-3] if len(historique) >= 6 else historique[:3]
            recent_avg = sum(recent) / len(recent)
            older_avg = sum(older) / len(older) if older else recent_avg
            
            if recent_avg > older_avg * 1.05:
                tendance = 'hausse'
            elif recent_avg < older_avg * 0.95:
                tendance = 'baisse'
            else:
                tendance = 'stable'
        else:
            tendance = 'stable'
        
        # Calculate confidence (based on variance)
        if len(historique) >= 3:
            try:
                stdev = statistics.stdev(historique)
                mean = statistics.mean(historique)
                cv = (stdev / mean * 100) if mean > 0 else 0  # Coefficient of variation
                if cv < 15:
                    confiance = 'haute'
                elif cv < 30:
                    confiance = 'moyenne'
                else:
                    confiance = 'faible'
            except:
                confiance = 'moyenne'
        else:
            confiance = 'faible'
        
        return Response({
            'labels': labels,
            'historique': historique,
            'prediction_labels': prediction_labels,
            'predictions': predictions_combined,
            'predictions_ma': predictions_ma,
            'predictions_lr': predictions_lr,
            'tendance': tendance,
            'confiance': confiance
        })

    @action(detail=False, methods=['get'])
    def kpis(self, request):
        """
        Retourne les indicateurs clés de performance.
        """
        cache_key = f'finance_kpis_{timezone.now().strftime("%Y-%m-%d-%H")}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        start_of_year = today.replace(month=1, day=1)
        
        # --- Monthly KPIs ---
        monthly_invoices = Facture.objects.annotate(num_p=Count('paiements')).filter(
            date__date__gte=start_of_month,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(status='VAL', num_p=0)
        
        monthly_stats = monthly_invoices.aggregate(
            ca=Coalesce(Sum('total_ttc'), Decimal('0')),
            count=Count('id')
        )
        
        panier_moyen_mois = 0
        if monthly_stats['count'] > 0:
            panier_moyen_mois = float(monthly_stats['ca']) / monthly_stats['count']
        
        # --- Yearly KPIs ---
        yearly_invoices = Facture.objects.filter(
            date__date__gte=start_of_year,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
        yearly_stats = yearly_invoices.aggregate(
            ca=Coalesce(Sum('total_ttc'), Decimal('0')),
            count=Count('id')
        )
        
        panier_moyen_annee = 0
        if yearly_stats['count'] > 0:
            panier_moyen_annee = float(yearly_stats['ca']) / yearly_stats['count']
        
        # Optimized Margin calculation using aggregations
        # 1. Allocated items
        alloc_month_stats = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=monthly_invoices
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
        
        # 2. Unallocated items
        unalloc_month_stats = FactureProduit.objects.filter(
            facture__in=monthly_invoices
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

        total_ca_ht_mois = (alloc_month_stats['ca_ht'] or 0) + (unalloc_month_stats['ca_ht'] or 0)
        total_marge_mois = (alloc_month_stats['marge'] or 0) + (unalloc_month_stats['marge'] or 0)
        
        taux_marge = 0
        if total_ca_ht_mois > 0:
            taux_marge = round((float(total_marge_mois) / float(total_ca_ht_mois)) * 100, 1)
        
        # --- DSI (Days Stock Inventory) ---
        # DSI = (Stock Value / COGS per day)
        # COGS per day = Monthly COGS / 30
        stock_value = Produit.objects.aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']
        
        # Get last 30 days COGS (including unallocated)
        last_30_days = today - timedelta(days=30)
        factures_30d = Facture.objects.annotate(num_p=Count('paiements')).filter(
            date__date__gte=last_30_days,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(status='VAL', num_p=0)
        
        cogs_alloc = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=factures_30d
        ).aggregate(
            total=Coalesce(Sum(F('quantity') * F('cost_price'), output_field=DecimalField()), Decimal('0'))
        )['total']
        
        cogs_unalloc = FactureProduit.objects.filter(
            facture__in=factures_30d
        ).annotate(
            has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
        ).filter(has_alloc=False).aggregate(
            total=Coalesce(Sum(F('quantity') * F('produit__pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']
        
        cogs_30d = cogs_alloc + cogs_unalloc
        
        dsi = 0
        if cogs_30d > 0:
            cogs_daily = float(cogs_30d) / 30
            dsi = round(float(stock_value) / cogs_daily, 0) if cogs_daily > 0 else 0
        
        # --- Growth vs previous month ---
        prev_month_start = start_of_month - relativedelta(months=1)
        prev_month_end = start_of_month - timedelta(days=1)
        
        prev_month_ca = Facture.objects.filter(
            date__date__gte=prev_month_start,
            date__date__lte=prev_month_end,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca']
        
        croissance_mensuelle = 0
        if prev_month_ca > 0:
            croissance_mensuelle = round(((float(monthly_stats['ca']) - float(prev_month_ca)) / float(prev_month_ca)) * 100, 1)
        
        data = {
            'panier_moyen': {
                'mois': round(panier_moyen_mois, 0),
                'annee': round(panier_moyen_annee, 0)
            },
            'taux_marge': taux_marge,
            'dsi': dsi,
            'ca_mois': float(monthly_stats['ca']),
            'nb_ventes_mois': monthly_stats['count'],
            'ca_annee': float(yearly_stats['ca']),
            'nb_ventes_annee': yearly_stats['count'],
            'stock_value': float(stock_value),
            'croissance_mensuelle': croissance_mensuelle
        }
        cache.set(cache_key, data, 60 * 15)
        return Response(data)

    @action(detail=False, methods=['get'])
    def top_products(self, request):
        """
        Top 10 produits par CA ou marge.
        Params: periode (mois|trimestre|annee), critere (ca|marge)
        """
        periode = request.query_params.get('periode', 'mois')
        critere = request.query_params.get('critere', 'ca')
        
        today = timezone.now().date()
        
        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:  # mois
            start_date = today.replace(day=1)
        
        # Optimized aggregation using database Sum
        base_qs = FactureProduitAllocation.objects.annotate(
            num_p=Count('facture_produit__facture__paiements')
        ).filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(facture_produit__facture__status='VAL', num_p=0)

        # Calculate everything in SQL
        stats = base_qs.values(
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
        
        return Response({
            'periode': periode,
            'critere': critere,
            'data': data
        })

    @action(detail=False, methods=['get'])
    def repartition_ca(self, request):
        """
        Répartition du CA par catégorie ou fournisseur.
        Params: by (categorie|fournisseur), periode (mois|trimestre|annee)
        """
        by = request.query_params.get('by', 'categorie')
        periode = request.query_params.get('periode', 'mois')
        
        today = timezone.now().date()
        
        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:  # mois
            start_date = today.replace(day=1)
        
        base_qs = FactureProduitAllocation.objects.annotate(
            num_p=Count('facture_produit__facture__paiements')
        ).filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(facture_produit__facture__status='VAL', num_p=0)
        
        if by == 'fournisseur':
            # Use product's default supplier as fallback when lot has no supplier
            from django.db.models.functions import Coalesce as CoalesceFunc
            from django.db.models import Case, When, Value, CharField
            
            # Annotate with resolved supplier, detecting inventory lots
            data = base_qs.annotate(
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
                    # If it's an inventory lot with no supplier, label it
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
            ).values(
                'fournisseur_id_resolved',
                'fournisseur_name_resolved'
            ).annotate(
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
        else:  # categorie (rayon)
            data = base_qs.values(
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
        
        # Calculate total and percentages
        total = sum(item['ca'] for item in result)
        for item in result:
            item['pourcentage'] = round((item['ca'] / total) * 100, 1) if total > 0 else 0
        
        return Response({
            'by': by,
            'periode': periode,
            'total': total,
            'data': result
        })

    @action(detail=False, methods=['get'])
    def analyse_categories(self, request):
        """
        Analyse CA et marge par catégorie (rayon, groupe, forme).
        Params: type (rayon|groupe|forme), periode (mois|trimestre|annee)
        """
        cat_type = request.query_params.get('type', 'rayon')
        periode = request.query_params.get('periode', 'mois')
        
        today = timezone.now().date()
        
        if periode == 'trimestre':
            start_date = today - relativedelta(months=3)
        elif periode == 'annee':
            start_date = today.replace(month=1, day=1)
        else:  # mois
            start_date = today.replace(day=1)
        
        base_qs = FactureProduitAllocation.objects.annotate(
            num_p=Count('facture_produit__facture__paiements')
        ).filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(facture_produit__facture__status='VAL', num_p=0)
        
        # Group fields
        if cat_type == 'groupe':
            id_field = 'facture_produit__produit__groupe__id'
            name_field = 'facture_produit__produit__groupe__nom'
        elif cat_type == 'forme':
            id_field = 'facture_produit__produit__forme__id'
            name_field = 'facture_produit__produit__forme__nom'
        else:  # rayon
            id_field = 'facture_produit__produit__rayon__id'
            name_field = 'facture_produit__produit__rayon__name'
        
        stats = base_qs.values(id_field, name_field).annotate(
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
            'type': cat_type,
            'periode': periode,
            'total_ca': total_ca,
            'total_marge': total_marge,
            'taux_marge_global': round((total_marge / total_ca) * 100, 1) if total_ca > 0 else 0,
            'data': result
        })

    @action(detail=False, methods=['get'])
    def evolution_categories(self, request):
        """
        Évolution mensuelle du CA par catégorie sur 12 mois.
        Params: type (rayon|groupe|forme), top (nombre de catégories à afficher, default 5)
        """
        cat_type = request.query_params.get('type', 'rayon')
        top_n = int(request.query_params.get('top', 5))
        
        today = timezone.now().date()
        start_date = today - relativedelta(months=11)
        start_date = start_date.replace(day=1)
        
        # Determine field based on type
        if cat_type == 'groupe':
            id_field = 'facture_produit__produit__groupe__id'
            name_field = 'facture_produit__produit__groupe__nom'
        elif cat_type == 'forme':
            id_field = 'facture_produit__produit__forme__id'
            name_field = 'facture_produit__produit__forme__nom'
        else:  # rayon
            id_field = 'facture_produit__produit__rayon__id'
            name_field = 'facture_produit__produit__rayon__name'
        
        # Get top categories by CA
        top_categories = FactureProduitAllocation.objects.annotate(
            num_p=Count('facture_produit__facture__paiements')
        ).filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(facture_produit__facture__status='VAL', num_p=0).values(id_field, name_field).annotate(
            total_ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
        ).order_by('-total_ca')[:top_n]
        
        top_ids = [item[id_field] for item in top_categories if item[id_field]]
        category_names = {item[id_field]: item[name_field] for item in top_categories}
        
        # Get monthly data for top categories
        monthly_data = FactureProduitAllocation.objects.annotate(
            num_p=Count('facture_produit__facture__paiements')
        ).filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            **{f'{id_field}__in': top_ids}
        ).exclude(facture_produit__facture__status='VAL', num_p=0).annotate(
            month=TruncMonth('facture_produit__facture__date')
        ).values('month', id_field).annotate(
            ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
        ).order_by('month')
        
        # Build data structure
        month_names_fr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
                          'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        
        # Generate all months
        labels = []
        current = start_date
        while current <= today:
            labels.append(f"{month_names_fr[current.month - 1]} {current.year % 100}")
            current = current + relativedelta(months=1)
        
        # Organize data by category
        series = {}
        for cat_id in top_ids:
            series[cat_id] = {
                'id': cat_id,
                'nom': category_names.get(cat_id, 'Inconnu'),
                'data': [0] * len(labels)
            }
        
        # Fill in the data
        for item in monthly_data:
            cat_id = item[id_field]
            if cat_id in series:
                month_key = item['month'].strftime('%Y-%m')
                # Find index
                current = start_date
                for i, _ in enumerate(labels):
                    if current.strftime('%Y-%m') == month_key:
                        series[cat_id]['data'][i] = float(item['ca'])
                        break
                    current = current + relativedelta(months=1)
        
        return Response({
            'type': cat_type,
            'labels': labels,
            'series': list(series.values())
        })

    @action(detail=False, methods=['get'])
    def analyse_marges(self, request):
        """
        Analyse avancée des marges et recommandations.
        Optimisé avec des agrégations SQL pour éviter les boucles Python et les erreurs NoneType.
        """
        # Période d'analyse (3 derniers mois par défaut)
        today = timezone.now().date()
        start_date = today - relativedelta(months=3)
        
        # Base Query: On exclut impérativement les lignes sans produit pour éviter le NoneType
        base_qs = FactureProduit.objects.filter(
            produit__isnull=False,
            facture__date__date__gte=start_date,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            num_p=Count('facture__paiements')
        ).exclude(facture__status='VAL', num_p=0)
        
        # 1. Calculer les moyennes globales pour références
        stats_globales = base_qs.aggregate(
            total_qty=Coalesce(Sum('quantity'), 0),
            nb_produits=Count('produit', distinct=True)
        )
        
        total_ventes_qty = stats_globales['total_qty']
        nb_produits_distincts = stats_globales['nb_produits'] or 1
        seuil_volume_eleve = (total_ventes_qty / nb_produits_distincts) * 1.5
        
        # 2. Agrégation par produit
        # On calcule le CA HT et la Marge HT directement en SQL
        produits_stats = base_qs.values(
            'produit__id', 
            'produit__name', 
            'produit__cost_price'
        ).annotate(
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
        
        opportunites_nego = []
        stock_dormant = []
        suggestions_prix = []
        
        for p in produits_stats:
            volume = p['volume_total']
            ca_ht = float(p['ca_ht'] or 0)
            marge_totale = float(p['marge_totale'] or 0)
            cost_price = float(p['produit__cost_price'] or 0)
            
            if ca_ht <= 0 or volume <= 0:
                continue
                
            taux_marge = (marge_totale / ca_ht) * 100
            selling_ht_moyen = ca_ht / volume
            
            # Cas 1 : Faible marge (< 15%) mais Fort volume
            if taux_marge < 15 and volume > seuil_volume_eleve:
                opportunites_nego.append({
                    'id': p['produit__id'],
                    'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1),
                    'volume': volume,
                    'marge_perdue': round((0.15 * ca_ht) - marge_totale, 2)
                })
                
            # Cas 2 : Forte marge (> 40%) mais Faible rotation
            if taux_marge > 40 and volume < (seuil_volume_eleve / 4):
                stock_dormant.append({
                    'id': p['produit__id'],
                    'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1),
                    'volume': volume,
                    'prix_actuel_ht': round(selling_ht_moyen, 2)
                })
                
            # Cas 3 : Suggestions Prix (Marge très faible < 10%)
            if taux_marge < 10:
                suggestions_prix.append({
                    'id': p['produit__id'],
                    'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1),
                    'prix_conseille_ht': round(cost_price * 1.25, 2) # Suggère 25% de marge
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

    @action(detail=False, methods=['get'])
    def analyse_fournisseurs(self, request):
        """
        Analyse comparative des fournisseurs (Score 0-100).
        Critères : Volume (30%), Qualité (30%), Régularité (40%).
        """
        from ..models import Fournisseur, StockLot, StockAdjustment
        import numpy as np
        
        # 1. Sélectionner les fournisseurs actifs (ayant livré dans les 12 derniers mois)
        today = timezone.now().date()
        start_date = today - relativedelta(months=12)
        
        fournisseurs = Fournisseur.objects.filter(
            stocklot__date_reception__date__gte=start_date
        ).distinct()
        
        result = []
        
        for f in fournisseurs:
            # --- CALCUL VOLUME (30%) ---
            # Basé sur le montant total acheté
            lots = StockLot.objects.filter(
                fournisseur=f,
                date_reception__date__gte=start_date
            )
            
            stats_volume = lots.aggregate(
                total_achat=Coalesce(Sum(F('quantity_initial') * F('price_cost'), output_field=DecimalField()), Decimal('0')),
                nb_livraisons=Count('id')
            )
            total_achat = float(stats_volume['total_achat'])
            nb_livraisons = stats_volume['nb_livraisons']
            
            if nb_livraisons == 0:
                continue

            # --- CALCUL QUALITÉ (30%) ---
            # Basé sur les ajustements négatifs (Avarie, Cassé, Erreur) liés aux lots de ce fournisseur
            problemes = StockAdjustment.objects.filter(
                stock_lot__fournisseur=f,
                reason_type__in=['AVARIE', 'CASSE', 'ERR_ENTREE', 'PERIME'],
                created_at__date__gte=start_date
            ).count()
            
            # Taux d'incident par livraison
            taux_probleme = min(1.0, problemes / nb_livraisons) if nb_livraisons > 0 else 0
            score_qualite = 100 * (1.0 - taux_probleme)
            
            # --- CALCUL RÉGULARITÉ (40%) ---
            # Basé sur l'écart-type des délais entre livraisons
            dates_livraison = list(lots.order_by('date_reception').values_list('date_reception', flat=True))
            if len(dates_livraison) > 1:
                # Convertir en jours depuis le début
                first_date = dates_livraison[0]
                days = [(d - first_date).days for d in dates_livraison]
                # Calculer les différences entre livraisons consécutives
                diffs = np.diff(days)
                if len(diffs) > 0:
                    std_dev = np.std(diffs)
                    # Pénalité : 2 points par jour d'écart-type
                    score_regularite = max(0, 100 - (std_dev * 2))
                else:
                    score_regularite = 100 # Une seule différence, dur à juger
            else:
                score_regularite = 50 # Neutre si une seule livraison
                
            # --- SCORE GLOBAL ---
            # Normalisation score volume (logarithmique pour ne pas écraser les petits)
            # On considère 10M FCFA comme cible "Max" pour 100/100 (ajustable)
            score_volume = min(100, (np.log10(max(1, total_achat)) / 7.0) * 100) # log10(10M) = 7
            
            score_global = (score_volume * 0.3) + (score_qualite * 0.3) + (score_regularite * 0.4)
            
            result.append({
                'id': f.id,
                'nom': f.name, # Assuming name field is 'name' or 'societe' - checking model... logic assumes 'name' usually
                'score_global': round(score_global, 1),
                'details': {
                    'volume': { 'valeur': total_achat, 'score': round(score_volume, 1) },
                    'qualite': { 'incidents': problemes, 'score': round(score_qualite, 1) },
                    'regularite': { 'nb_livraisons': nb_livraisons, 'score': round(score_regularite, 1) }
                }
            })
            
        # Trier par score global
        result.sort(key=lambda x: x['score_global'], reverse=True)
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def comparaison_prix_achat(self, request):
        """
        Trouve les produits achetés chez plusieurs fournisseurs et compare les prix.
        """
        from ..models import StockLot
        
        today = timezone.now().date()
        start_date = today - relativedelta(months=12)
        
        # 1. Identifier les produits avec > 1 fournisseur distinct
        produits_multi_source = StockLot.objects.filter(
            date_reception__date__gte=start_date
        ).exclude(
            Q(fournisseur__isnull=True) | Q(fournisseur__name__iexact='Inconnu')
        ).values('produit').annotate(
            nb_fournisseurs=Count('fournisseur', distinct=True)
        ).filter(nb_fournisseurs__gt=1)
        
        product_ids = [p['produit'] for p in produits_multi_source]
        
        results = []
        
        # 2. Pour chaque produit, récupérer les détails par fournisseur
        for pid in product_ids:
            lots = StockLot.objects.filter(
                produit_id=pid,
                date_reception__date__gte=start_date
            ).values(
                'produit__name', 'fournisseur__name'
            ).annotate(
                avg_price=Avg('price_cost')
            )
            
            if not lots:
                continue
                
            produit_name = lots[0]['produit__name']
            prices = []
            
            for l in lots:
                prices.append({
                    'fournisseur': l['fournisseur__name'],
                    'prix_moyen': float(l['avg_price'])
                })
            
            # Calculer écarts
            min_price = min(p['prix_moyen'] for p in prices)
            max_price = max(p['prix_moyen'] for p in prices)
            ecart_max = ((max_price - min_price) / min_price) * 100 if min_price > 0 else 0
            
            results.append({
                'id': pid,
                'produit': produit_name,
                'offres': prices,
                'ecart_pourcentage': round(ecart_max, 1),
                'meilleur_prix': min_price
            })
            
        # Trier par écart (les plus grandes divergences d'abord)
        results.sort(key=lambda x: x['ecart_pourcentage'], reverse=True)
        
        return Response(results)

    @action(detail=False, methods=['get'])
    def repartition_achats(self, request):
        """
        Répartition du volume d'achat par fournisseur (Concentration).
        """
        from ..models import StockLot
        
        today = timezone.now().date()
        start_date = today - relativedelta(months=12)
        
        achats = StockLot.objects.filter(
            date_reception__date__gte=start_date
        ).exclude(
            Q(fournisseur__isnull=True) | Q(fournisseur__name__iexact='Inconnu')
        ).values(
            'fournisseur__id', 'fournisseur__name'
        ).annotate(
            total_achat=Coalesce(Sum(F('quantity_initial') * F('price_cost'), output_field=DecimalField()), Decimal('0'))
        ).order_by('-total_achat')
        
        total_global = sum(a['total_achat'] for a in achats)
        
        data = []
        for a in achats:
            montant = float(a['total_achat'])
            pourcentage = (montant / float(total_global)) * 100 if total_global > 0 else 0
            
            data.append({
                'id': a['fournisseur__id'],
                'nom': a['fournisseur__name'] or "Inconnu",
                'value': montant,
                'pourcentage': round(pourcentage, 1)
            })
            
        return Response({
            'total_achats': total_global,
            'data': data
        })

    @action(detail=False, methods=['get'])
    def margin_variance_analysis(self, request):
        """
        Analyses why the margin changed between two periods.
        Params: period1_start, period1_end, period2_start, period2_end
        Default: Today vs Yesterday
        """
        today = timezone.now().date()
        is_english = request.query_params.get('lang', 'fr') == 'en'
        
        # Period 1 (Current)
        p1_start = request.query_params.get('p1_start', today.isoformat())
        p1_end = request.query_params.get('p1_end', today.isoformat())
        
        # Period 2 (Baseline/Comparison)
        yesterday = today - timedelta(days=1)
        p2_start = request.query_params.get('p2_start', yesterday.isoformat())
        p2_end = request.query_params.get('p2_end', yesterday.isoformat())
        
        def get_period_stats(start, end):
            factures = Facture.objects.filter(
                date__date__gte=start,
                date__date__lte=end,
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            )
            
            global_remise = factures.aggregate(s=Coalesce(Sum('remise'), Decimal('0')))['s']
            total_ca = factures.aggregate(s=Coalesce(Sum('total_ttc'), Decimal('0')))['s']
            
            # Margin from allocations
            m_alloc = FactureProduitAllocation.objects.filter(
                facture_produit__facture__in=factures
            ).aggregate(
                m=Coalesce(Sum((F('facture_produit__selling_price') - F('facture_produit__discount') - F('cost_price')) * F('quantity')), Decimal('0'))
            )['m']
            
            # Margin from unallocated
            m_unalloc = FactureProduit.objects.filter(
                facture__in=factures
            ).annotate(
                has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
            ).filter(has_alloc=False).aggregate(
                m=Coalesce(Sum((F('selling_price') - F('discount') - F('produit__pmp')) * F('quantity')), Decimal('0'))
            )['m']
            
            total_margin = m_alloc + m_unalloc - global_remise
            margin_pct = (total_margin / total_ca * 100) if total_ca > 0 else 0
            
            # Top products in this period
            products = FactureProduit.objects.filter(facture__in=factures).values(
                'produit__id', 'produit__name'
            ).annotate(
                ca=Sum(F('quantity') * (F('selling_price') - F('discount'))),
                qty=Sum('quantity')
            ).order_by('-ca')[:50]
            
            return {
                'ca': float(total_ca),
                'margin': float(total_margin),
                'margin_pct': float(margin_pct),
                'products': {p['produit__id']: p for p in products}
            }

        stats1 = get_period_stats(p1_start, p1_end)
        stats2 = get_period_stats(p2_start, p2_end)
        
        variance_pct = stats1['margin_pct'] - stats2['margin_pct']
        
        # --- Analysis of Abnormal Margins (Today's potential errors) ---
        # Products with margin > 80% or < 5% are suspicious in a pharmacy context
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

        # --- English & French Insights ---
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
            'period1': { 'label': 'Aujourd\'hui' if not is_english else 'Today', 'stats': stats1 },
            'period2': { 'label': 'Hier' if not is_english else 'Yesterday', 'stats': stats2 },
            'variance_pct': round(variance_pct, 2),
            'suspicious_products': suspicious_products,
            'insights': insights,
            'labels': {
                'ca': { 'fr': 'Chiffre d\'Affaires', 'en': 'Turnover' },
                'margin': { 'fr': 'Marge Brute', 'en': 'Gross Margin' },
                'margin_pct': { 'fr': 'Taux de Marge', 'en': 'Margin Rate' }
            }
        })
