# -*- coding: utf-8 -*-
"""
Finance Statistics ViewSet - Advanced financial analytics and predictions.
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, BooleanField
from django.db.models.functions import TruncMonth, Coalesce, ExtractYear, ExtractMonth
from django.utils import timezone
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import statistics

from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from ..models import Facture, FactureProduit, FactureProduitAllocation, Produit, Rayon


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
        
        # Calculate year-over-year growth
        total_current = sum(data)
        total_n1 = sum(comparaison_n1)
        croissance = 0
        if total_n1 > 0:
            croissance = round(((total_current - total_n1) / total_n1) * 100, 1)
        
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
        today = timezone.now().date()
        start_date = today - relativedelta(months=11)
        start_date = start_date.replace(day=1)
        
        # Aggregate margin data from allocations
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            month=TruncMonth('facture_produit__facture__date')
        ).values('month').annotate(
            ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0')),
            cout=Coalesce(Sum(F('quantity') * F('cost_price'), output_field=DecimalField()), Decimal('0')),
            marge=Coalesce(Sum((F('selling_price') - F('cost_price')) * F('quantity'), output_field=DecimalField()), Decimal('0'))
        ).order_by('month')
        
        # Build map
        margin_map = {}
        for item in allocations:
            key = item['month'].strftime('%Y-%m')
            margin_map[key] = {
                'ca': float(item['ca']),
                'cout': float(item['cout']),
                'marge': float(item['marge']),
                'taux': round((float(item['marge']) / float(item['ca'])) * 100, 1) if item['ca'] > 0 else 0
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
        ca_data = Facture.objects.filter(
            date__date__gte=start_date,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
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
    @method_decorator(cache_page(60*15))  # Cache 15 min
    def kpis(self, request):
        """
        Retourne les indicateurs clés de performance.
        """
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        start_of_year = today.replace(month=1, day=1)
        
        # --- Monthly KPIs ---
        monthly_invoices = Facture.objects.filter(
            date__date__gte=start_of_month,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
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
        
        # --- Margin Rate (from allocations, current month) ---
        monthly_allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_of_month,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(
            ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0')),
            marge=Coalesce(Sum((F('selling_price') - F('cost_price')) * F('quantity'), output_field=DecimalField()), Decimal('0'))
        )
        
        taux_marge = 0
        if monthly_allocations['ca'] > 0:
            taux_marge = round((float(monthly_allocations['marge']) / float(monthly_allocations['ca'])) * 100, 1)
        
        # --- DSI (Days Stock Inventory) ---
        # DSI = (Stock Value / COGS per day)
        # COGS per day = Monthly COGS / 30
        stock_value = Produit.objects.aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']
        
        # Get last 30 days COGS
        last_30_days = today - timedelta(days=30)
        cogs_30d = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=last_30_days,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(
            total=Coalesce(Sum(F('quantity') * F('cost_price'), output_field=DecimalField()), Decimal('0'))
        )['total']
        
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
        
        return Response({
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
        })

    @action(detail=False, methods=['get'])
    @method_decorator(cache_page(60*15))  # Cache 15 min
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
        
        # Aggregate from allocations
        products = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).values(
            'facture_produit__produit__id',
            'facture_produit__produit__name',
            'facture_produit__produit__cip1'
        ).annotate(
            ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0')),
            marge=Coalesce(Sum((F('selling_price') - F('cost_price')) * F('quantity'), output_field=DecimalField()), Decimal('0')),
            quantite=Coalesce(Sum('quantity'), 0)
        )
        
        # Sort by criteria
        if critere == 'marge':
            products = products.order_by('-marge')[:50]
        else:
            products = products.order_by('-ca')[:50]
        
        data = []
        for item in products:
            ca = float(item['ca'])
            marge = float(item['marge'])
            taux = round((marge / ca) * 100, 1) if ca > 0 else 0
            
            data.append({
                'id': item['facture_produit__produit__id'],
                'nom': item['facture_produit__produit__name'],
                'cip': item['facture_produit__produit__cip1'],
                'ca': ca,
                'marge': marge,
                'taux_marge': taux,
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
        
        base_qs = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
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
    @method_decorator(cache_page(60*60))  # Cache 1 heure
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
        
        base_qs = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
        # Determine field based on type
        if cat_type == 'groupe':
            id_field = 'facture_produit__produit__groupe__id'
            name_field = 'facture_produit__produit__groupe__nom'
            default_name = 'Sans groupe'
        elif cat_type == 'forme':
            id_field = 'facture_produit__produit__forme__id'
            name_field = 'facture_produit__produit__forme__nom'
            default_name = 'Sans forme'
        else:  # rayon
            id_field = 'facture_produit__produit__rayon__id'
            name_field = 'facture_produit__produit__rayon__name'
            default_name = 'Sans rayon'
        
        data = base_qs.values(id_field, name_field).annotate(
            ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0')),
            marge=Coalesce(Sum((F('selling_price') - F('cost_price')) * F('quantity'), output_field=DecimalField()), Decimal('0')),
            nb_ventes=Count('id')
        ).order_by('-ca')
        
        total_ca = sum(float(item['ca']) for item in data) or 1
        total_marge = sum(float(item['marge']) for item in data)
        
        result = []
        for item in data:
            ca = float(item['ca'])
            marge = float(item['marge'])
            result.append({
                'id': item[id_field] or 0,
                'nom': item[name_field] or default_name,
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
    @method_decorator(cache_page(60*60))  # Cache 1 heure
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
        top_categories = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).values(id_field, name_field).annotate(
            total_ca=Coalesce(Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), Decimal('0'))
        ).order_by('-total_ca')[:top_n]
        
        top_ids = [item[id_field] for item in top_categories if item[id_field]]
        category_names = {item[id_field]: item[name_field] for item in top_categories}
        
        # Get monthly data for top categories
        monthly_data = FactureProduitAllocation.objects.filter(
            facture_produit__facture__date__date__gte=start_date,
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            **{f'{id_field}__in': top_ids}
        ).annotate(
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
    @method_decorator(cache_page(60*60*4))  # Cache 4 heures
    def analyse_marges(self, request):
        """
        Analyse avancée des marges et recommandations.
        Retourne :
        - Faible marge / Fort volume (Opportunités négo)
        - Forte marge / Faible rotation (Stock dormant)
        - Suggestions d'ajustement prix
        """
        # Période d'analyse (3 derniers mois par défaut pour avoir du volume significatif)
        today = timezone.now().date()
        start_date = today - relativedelta(months=3)
        
        base_qs = FactureProduit.objects.filter(
            facture__date__date__gte=start_date,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
        # 1. Calculer les moyennes globales pour références
        stats_globales = base_qs.aggregate(
            avg_volume=Avg('quantity'),
            avg_marge_taux=Avg(F('selling_price') / F('produit__cost_price'), output_field=DecimalField())
        )
        
        # Moyenne volume par produit (approximation simple)
        # Idéalement : Total ventes / Nombre produits vendus
        total_ventes_qty = base_qs.aggregate(sum=Sum('quantity'))['sum'] or 0
        nb_produits_distincts = base_qs.values('produit').distinct().count() or 1
        seuil_volume_eleve = (total_ventes_qty / nb_produits_distincts) * 1.5  # 50% au-dessus de la moyenne
        
        # 2. Agrégation par produit
        produits_stats = base_qs.values(
            'produit__id', 'produit__name', 'produit__cost_price', 'produit__selling_price'
        ).annotate(
            volume_total=Sum('quantity'),
            marge_totale=Sum((F('selling_price') - F('produit__cost_price')) * F('quantity'), output_field=DecimalField())
        )
        
        opportunites_nego = []
        stock_dormant = []
        suggestions_prix = []
        
        for p in produits_stats:
            volume = p['volume_total'] or 0
            cp = float(p['produit__cost_price'] or 0)
            sp = float(p['produit__selling_price'] or 0)
            
            if cp <= 0 or sp <= 0:
                continue
                
            taux_marge = ((sp - cp) / sp) * 100
            
            # Cas 1 : Faible marge (< 15%) mais Fort volume
            if taux_marge < 15 and volume > seuil_volume_eleve:
                opportunites_nego.append({
                    'id': p['produit__id'],
                    'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1),
                    'volume': volume,
                    'marge_perdue': round((0.15 * sp - (sp - cp)) * volume, 2)  # Gain potentiel si marge monte à 15%
                })
                
            # Cas 2 : Forte marge (> 40%) mais Faible rotation (< 1/3 moyenne)
            # Note: "Faible rotation" ici est approximé par faible volume de vente relatif
            if taux_marge > 40 and volume < (seuil_volume_eleve / 4):
                stock_dormant.append({
                    'id': p['produit__id'],
                    'nom': p['produit__name'],
                    'taux_marge': round(taux_marge, 1),
                    'volume': volume,
                    'prix_actuel': sp
                })
                
            # Cas 3 : Suggestions Prix (Marge très faible < 10%)
            if taux_marge < 10:
                nouveau_prix = cp * 1.25  # Viser 20% de marge (Coef 1.25 sur PA = 20% marge sur PV ou 25% markup)
                # Ou simplement +5% si le saut est trop grand
                prix_suggere = sp * 1.05
                
                suggestions_prix.append({
                    'id': p['produit__id'],
                    'nom': p['produit__name'],
                    'taux_actuel': round(taux_marge, 1),
                    'prix_actuel': sp,
                    'prix_suggere': round(prix_suggere, 2),
                    'impact_estime': round((prix_suggere - sp) * volume, 2)
                })
                
        # Trier par impact
        opportunites_nego.sort(key=lambda x: x['volume'], reverse=True)
        stock_dormant.sort(key=lambda x: x['taux_marge'], reverse=True)
        suggestions_prix.sort(key=lambda x: x['impact_estime'], reverse=True)
        
        return Response({
            'opportunites_nego': opportunites_nego[:20],
            'stock_dormant': stock_dormant[:20],
            'suggestions_prix': suggestions_prix[:20]
        })

    @action(detail=False, methods=['get'])
    @method_decorator(cache_page(60*60*4))  # Cache 4 heures
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
    @method_decorator(cache_page(60*60*4))  # Cache 4h
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
    @method_decorator(cache_page(60*60*4))  # Cache 4h
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

