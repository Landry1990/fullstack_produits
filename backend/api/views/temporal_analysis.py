# -*- coding: utf-8 -*-
"""
Temporal Analysis ViewSet - Analyse temporelle des ventes.
Endpoints pour les heures de pointe, jours rentables et saisonnalité.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Count, Sum, Avg, F
from django.db.models.functions import ExtractHour, ExtractWeekDay, ExtractMonth, TruncMonth
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from ..models import Facture, FactureProduit


class TemporalAnalysisViewSet(viewsets.ViewSet):
    """
    ViewSet for temporal analysis of sales data.
    Provides insights on peak hours, daily comparisons, and seasonality.
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def peak_hours(self, request):
        """
        Returns hourly sales analysis with peak identification.
        Shows sales count, revenue, and average basket per hour.
        
        Query params:
            - days: Number of days to analyze (default: 30)
        """
        days = int(request.query_params.get('days', 30))
        today = timezone.localtime(timezone.now()).date()
        date_start = today - timedelta(days=days)
        
        # Get sales grouped by hour
        sales_by_hour = Facture.objects.filter(
            date__date__gte=date_start,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            hour=ExtractHour('date')
        ).values('hour').annotate(
            sales_count=Count('id'),
            total_revenue=Sum('total_ttc'),
        ).order_by('hour')
        
        # Initialize 24h data
        traffic_data = {h: {'sales_count': 0, 'revenue': 0, 'avg_basket': 0} for h in range(24)}
        
        # Fill with actual data
        for item in sales_by_hour:
            hour = item['hour']
            count = item['sales_count'] or 0
            revenue = float(item['total_revenue'] or 0)
            avg_basket = revenue / count if count > 0 else 0
            
            # Daily average
            traffic_data[hour] = {
                'sales_count': round(count / days, 2),
                'revenue': round(revenue / days, 0),
                'avg_basket': round(avg_basket, 0)
            }
        
        # Identify peak hour
        peak_hour = max(traffic_data.items(), key=lambda x: x[1]['revenue'])
        
        # Format for frontend
        response_data = [
            {
                'hour': f"{h:02d}h",
                'sales_count': traffic_data[h]['sales_count'],
                'revenue': traffic_data[h]['revenue'],
                'avg_basket': traffic_data[h]['avg_basket'],
                'is_peak': h == peak_hour[0]
            }
            for h in range(24)
        ]
        
        return Response({
            'data': response_data,
            'peak_hour': f"{peak_hour[0]:02d}h",
            'peak_revenue': peak_hour[1]['revenue'],
            'analysis_days': days
        })
    
    @action(detail=False, methods=['get'])
    def daily_comparison(self, request):
        """
        Returns comparison of sales by day of the week.
        Useful to identify most profitable days (Monday vs Saturday).
        
        Query params:
            - weeks: Number of weeks to analyze (default: 12)
        """
        weeks = int(request.query_params.get('weeks', 12))
        days = weeks * 7
        today = timezone.localtime(timezone.now()).date()
        date_start = today - timedelta(days=days)
        
        # Day names in French
        day_names = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        
        # Django uses 1=Sunday, 2=Monday... we need to adjust
        # ExtractWeekDay: 1=Sunday, 2=Monday, 3=Tuesday... 7=Saturday
        sales_by_day = Facture.objects.filter(
            date__date__gte=date_start,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            weekday=ExtractWeekDay('date')  # 1=Sunday, 2=Monday...
        ).values('weekday').annotate(
            sales_count=Count('id'),
            total_revenue=Sum('total_ttc'),
        ).order_by('weekday')
        
        # Initialize data for all days
        daily_data = {i: {'sales_count': 0, 'revenue': 0, 'avg_basket': 0} for i in range(1, 8)}
        
        # Fill with actual data
        for item in sales_by_day:
            weekday = item['weekday']  # 1=Sunday...7=Saturday
            count = item['sales_count'] or 0
            revenue = float(item['total_revenue'] or 0)
            avg_basket = revenue / count if count > 0 else 0
            
            # Weekly average
            daily_data[weekday] = {
                'sales_count': round(count / weeks, 2),
                'revenue': round(revenue / weeks, 0),
                'avg_basket': round(avg_basket, 0)
            }
        
        # Convert to list with French day names (adjust index: 1=Sun->Dim, 2=Mon->Lun...)
        # We want Monday first, so reorder: 2,3,4,5,6,7,1 -> Lun,Mar,Mer,Jeu,Ven,Sam,Dim
        reorder = [2, 3, 4, 5, 6, 7, 1]
        
        response_data = []
        max_revenue = 0
        best_day_idx = 0
        
        for i, db_day in enumerate(reorder):
            data = daily_data[db_day]
            if data['revenue'] > max_revenue:
                max_revenue = data['revenue']
                best_day_idx = i
            
            response_data.append({
                'day': day_names[i],
                'day_number': i,
                'sales_count': data['sales_count'],
                'revenue': data['revenue'],
                'avg_basket': data['avg_basket'],
                'is_best': False  # Will set below
            })
        
        # Mark best day
        if response_data:
            response_data[best_day_idx]['is_best'] = True
        
        return Response({
            'data': response_data,
            'best_day': day_names[best_day_idx] if response_data else None,
            'best_revenue': max_revenue,
            'analysis_weeks': weeks
        })
    
    @action(detail=False, methods=['get'])
    def seasonality(self, request):
        """
        Returns seasonal analysis of sales and identifies seasonal products.
        
        Query params:
            - months: Number of months to analyze (default: 12)
            - top_n: Number of top seasonal products to return (default: 20)
        """
        months = int(request.query_params.get('months', 12))
        top_n = int(request.query_params.get('top_n', 20))
        today = timezone.localtime(timezone.now()).date()
        date_start = today - timedelta(days=months * 30)
        
        # Monthly revenue trends
        monthly_trends = Facture.objects.filter(
            date__date__gte=date_start,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            revenue=Sum('total_ttc'),
            sales_count=Count('id')
        ).order_by('month')
        
        # Format monthly trends
        month_names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
                       'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        
        trends_data = []
        for item in monthly_trends:
            month_date = item['month']
            if month_date:
                trends_data.append({
                    'month': month_names[month_date.month - 1],
                    'month_number': month_date.month,
                    'year': month_date.year,
                    'revenue': float(item['revenue'] or 0),
                    'sales_count': item['sales_count'] or 0
                })
        
        # Find seasonal products (high variance in monthly sales)
        # Get products sold in this period with monthly breakdown
        product_monthly = FactureProduit.objects.filter(
            facture__date__date__gte=date_start,
            facture__date__date__lte=today,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            produit__isnull=False
        ).annotate(
            line_revenue=F('quantity') * F('selling_price')
        ).annotate(
            month=ExtractMonth('facture__date')
        ).values('produit_id', 'produit__name', 'month').annotate(
            quantity=Sum('quantity'),
            revenue=Sum('line_revenue')
        ).order_by('produit_id', 'month')
        
        # Group by product and calculate variation
        product_stats = {}
        for item in product_monthly:
            pid = item['produit_id']
            if pid not in product_stats:
                product_stats[pid] = {
                    'id': pid,
                    'name': item['produit__name'],
                    'monthly_sales': {},
                    'total_quantity': 0
                }
            
            month = item['month']
            qty = item['quantity'] or 0
            product_stats[pid]['monthly_sales'][month] = qty
            product_stats[pid]['total_quantity'] += qty
        
        # Calculate seasonality score (coefficient of variation)
        seasonal_products = []
        for pid, stats in product_stats.items():
            monthly_values = list(stats['monthly_sales'].values())
            if len(monthly_values) >= 3 and stats['total_quantity'] >= 10:  # Need at least 3 months and 10 units
                avg = sum(monthly_values) / len(monthly_values)
                if avg > 0:
                    variance = sum((x - avg) ** 2 for x in monthly_values) / len(monthly_values)
                    std_dev = variance ** 0.5
                    cv = (std_dev / avg) * 100  # Coefficient of variation as percentage
                    
                    # Find peak month
                    peak_month = max(stats['monthly_sales'].items(), key=lambda x: x[1])
                    
                    seasonal_products.append({
                        'id': pid,
                        'name': stats['name'],
                        'peak_month': month_names[peak_month[0] - 1],
                        'peak_quantity': peak_month[1],
                        'avg_monthly': round(avg, 1),
                        'variation_pct': round(cv, 1),
                        'total_quantity': stats['total_quantity']
                    })
        
        # Sort by variation (most seasonal first) and take top N
        seasonal_products.sort(key=lambda x: x['variation_pct'], reverse=True)
        top_seasonal = seasonal_products[:top_n]
        
        return Response({
            'monthly_trends': trends_data,
            'seasonal_products': top_seasonal,
            'analysis_months': months,
            'total_products_analyzed': len(product_stats)
        })
