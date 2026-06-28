from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, Value, ExpressionWrapper, Case, When, Exists, OuterRef
from django.db.models.functions import TruncDay, TruncMonth, Coalesce, TruncDate
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from ..models import Facture, Commande, Produit, Client, StockLot, Caisse, ObjectifCommercial, FactureProduit, FactureProduitAllocation

class DashboardViewSet(viewsets.ViewSet):
    """
    ViewSet for Dashboard statistics and charts.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def init(self, request):
        """
        Consolidated endpoint for dashboard initial load.
        Returns stats, revenue_chart, and hourly_traffic in one request.
        """
        stats_data = self.stats(request).data
        chart_data = self.revenue_chart(request).data
        traffic_data = self.hourly_traffic(request).data
        
        # Add reappro_summary data (cross-reference with ProduitViewSet if possible or just call its logic)
        from .produits import ProduitViewSet
        reappro_data = ProduitViewSet().reappro_summary(request).data

        return Response({
            'stats': stats_data,
            'revenue_chart': chart_data,
            'hourly_traffic': traffic_data,
            'reappro_summary': reappro_data
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.localtime(timezone.now()).date()
        yesterday = today - timedelta(days=1)
        
        # Determine Role early to skip complex queries for cashiers
        role = 'PHARMACIEN' # Default fallback
        try:
            if hasattr(request.user, 'profile'):
                role = request.user.profile.role
        except Exception:
            pass
        
        if request.user.is_superuser or request.user.is_staff:
            role = 'PHARMACIEN'
            
        # 1. Combined Global & User Metrics (Factures)
        global_stats = {}
        
        facture_qs = Facture.objects.filter(
            date__date__in=[today, yesterday],
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(num_p=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_p=0)
        
        
        # Aggregate everything related to Facture in one pass for [today, yesterday]
        facture_metrics = facture_qs.aggregate(
            ca_today=Coalesce(Sum(Case(When(date__date=today, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            sales_today=Count(Case(When(date__date=today, then=Value(1)))),
            discount_today=Coalesce(Sum(Case(When(date__date=today, then=F('remise')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            
            ca_yesterday=Coalesce(Sum(Case(When(date__date=yesterday, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            sales_yesterday=Count(Case(When(date__date=yesterday, then=Value(1)))),
            
            user_ca_today=Coalesce(Sum(Case(When(Q(date__date=today) & Q(created_by=request.user), then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            user_sales_today=Count(Case(When(Q(date__date=today) & Q(created_by=request.user), then=Value(1))))
        )
        
        global_stats['ca_today'] = facture_metrics['ca_today']
        global_stats['sales_today'] = facture_metrics['sales_today']
        global_stats['ca_yesterday'] = facture_metrics['ca_yesterday']
        global_stats['sales_yesterday'] = facture_metrics['sales_yesterday']
        discount_total = facture_metrics['discount_today']
        
        user_ca_today = facture_metrics['user_ca_today']
        user_sales_count = facture_metrics['user_sales_today']

        revenue_change = 0
        if global_stats['ca_yesterday'] > 0:
            revenue_change = round(((global_stats['ca_today'] - global_stats['ca_yesterday']) / global_stats['ca_yesterday']) * 100, 1)

        sales_change = 0
        if global_stats['sales_yesterday'] > 0:
            sales_change = round(((global_stats['sales_today'] - global_stats['sales_yesterday']) / global_stats['sales_yesterday']) * 100, 1)

        if role not in ['VENDEUR', 'CAISSIER']:
            # 2. Combined Product Metrics (Stock Value & Critical Stock)
            # Critical stock criteria: stock <= stock_min OR stock <= 0 OR stock < 15 days of rotation
            # rotation_moyenne is monthly, so daily is /30. 15 days = (rotation/30)*15 = rotation/2
            product_stats = Produit.objects.aggregate(
                stock_value=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0')),
                stock_count=Count(Case(When(stock__gt=0, then=Value(1)))),
                stock_critique=Count(Case(When(
                    Q(is_active=True) & (
                        Q(stock__lte=F('stock_minimum')) | 
                        Q(stock__lte=0) |
                        (Q(rotation_moyenne__gt=1) & Q(stock__lt=F('rotation_moyenne') / 2.0))
                    ),
                    then=Value(1)
                )))
            )
            stock_critique = product_stats['stock_critique']
            stock_agg = {'total': product_stats['stock_value'], 'count': product_stats['stock_count']}

            # 3. Receivables (Créances) — Resté séparé car nécessite une sous-requête complexe sur Caisse
            from django.db.models import Subquery
            paid_sub = Caisse.objects.filter(
                facture=OuterRef('pk'),
                statut='completee'
            ).exclude(
                mode_paiement='en_compte'
            ).values('facture').annotate(
                s=Sum('montant')
            ).values('s')[:1]
            
            receivables_agg = Facture.objects.filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').annotate(
                total_paid=Coalesce(Subquery(paid_sub, output_field=DecimalField()), Decimal('0.00')),
            ).annotate(
                debt=F('total_ttc') - F('total_paid')
            ).filter(
                debt__gt=0.5
            ).aggregate(
                total_debt=Coalesce(Sum('debt'), Decimal('0')),
                count=Count('id')
            )

            # 4. Payment Mix (Today)
            payment_mix = Caisse.objects.filter(
                date_paiement__date=today,
                statut='completee'
            ).values('mode_paiement').annotate(
                value=Sum('montant')
            ).order_by('-value')
            
            payment_mix_data = [
                {'mode': item['mode_paiement'], 'label': dict(Caisse.MODES_PAIEMENT).get(item['mode_paiement'], item['mode_paiement']), 'value': float(-item['value'] if item['mode_paiement'] == 'coupon' else item['value'])}
                for item in payment_mix
            ]

            # 5. Top Products Today
            from ..models import FactureProduit
            top_products = FactureProduit.objects.filter(
                facture__date__date=today,
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            ).exclude(facture__status=Facture.Status.VALIDEE, facture__paiements__isnull=True).distinct().values('produit_id', 'produit__name').annotate(
                qty=Sum('quantity'),
                revenue=Sum(F('quantity') * (F('selling_price') - F('discount')))
            ).order_by('-qty')[:5]

            top_products_data = [
                {'id': p['produit_id'], 'name': p['produit__name'] or 'Inconnu', 'qty': p['qty'], 'revenue': float(p['revenue'])}
                for p in top_products
            ]

            # 6. Today's Margin (Centralized calculation with discounts)
            from ..services.margin_service import MarginService
            margin_stats = MarginService.calculate_period_margin_with_discounts(
                date_debut=today,
                date_fin=today + timedelta(days=1),
                exclude_is_divers=False  # Dashboard includes is_divers
            )
            margin_today = margin_stats['marge_brute']

            # 7. Dormant Stock (6 months defaults)
            dormant_threshold = today - timedelta(days=6 * 30)
            
            dormant_qs = Produit.objects.filter(stock__gt=0).filter(
                Q(dernier_vente__lte=dormant_threshold) |
                (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=dormant_threshold)) |
                (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) & Q(created_at__date__lte=dormant_threshold))
            ).annotate(
                dormant_value=ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())
            )

            dormant_total = dormant_qs.aggregate(
                total_val=Coalesce(Sum('dormant_value'), Decimal('0'))
            )['total_val']

            top_dormant = dormant_qs.order_by('-dormant_value').values(
                'id', 'name', 'stock', 'pmp', 'dernier_vente', 'dormant_value'
            )[:5]

            dormant_stock_data = {
                'total_value': float(dormant_total),
                'top_products': [
                    {
                        'id': p['id'],
                        'name': p['name'],
                        'stock': p['stock'],
                        'last_sale': p['dernier_vente'].isoformat() if p['dernier_vente'] else None,
                        'value': float(p['dormant_value'])
                    }
                    for p in top_dormant
                ]
            }
        user_avg_basket = (user_ca_today / user_sales_count) if user_sales_count > 0 else Decimal('0')

        # Base response
        response_data = {
            'role': role,
            'user_stats': {
                'sales': float(user_ca_today),
                'count': user_sales_count,
                'avg_basket': float(user_avg_basket)
            }
        }
        
        if role not in ['VENDEUR', 'CAISSIER']:
            response_data.update({
                'revenue': {'value': float(global_stats['ca_today']), 'change': revenue_change},
                'sales': {'value': global_stats['sales_today'], 'change': sales_change},
                'clients': {'value': Client.objects.count(), 'change': 0},
                'low_stock': {'value': stock_critique, 'change': 0},
                'receivables': {'value': float(receivables_agg['total_debt'] or 0), 'count': receivables_agg['count'] or 0},
                'discount': {'value': float(discount_total), 'change': 0},
                'stock_value': {'value': float(stock_agg['total'] or 0), 'count': stock_agg['count'] or 0},
                'payment_mix': payment_mix_data,
                'top_products': top_products_data,
                'margin_today': float(margin_today),
                'dormant_stock': dormant_stock_data
            })
            
        return Response(response_data)

    @action(detail=False, methods=['get'])
    def manager_stats(self, request):
        """
        Calculates KPIs for Manager Dashboard: Actual vs Targets and Alerts.
        """
        # Role check
        profile = getattr(request.user, 'profile', None)
        role = profile.role if profile else None
        if role in ['VENDEUR', 'CAISSIER'] and not request.user.is_superuser:
            return Response({"error": "Accès non autorisé"}, status=status.HTTP_403_FORBIDDEN)

        # 1. Basic dates
        now = timezone.localtime(timezone.now())
        today = now.date()
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        
        # 2. Performance Metrics (Hybrid: Turnover for Targets, Margin for Info)
        # Primary KPI is Turnover (CA) to align with Goals and Caisse
        # Secondary KPI is Margin for profitability tracking
        
        # 2. Performance Metrics (Grouped queries)
        from django.db.models import Case, When, Value, DecimalField
        
        # --- Chiffre d'Affaires (Grouped) ---
        ca_stats = Facture.objects.filter(
            date__date__gte=start_of_month,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(
            ca_jour=Coalesce(Sum(Case(When(date__date=today, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            ca_sem=Coalesce(Sum(Case(When(date__date__gte=start_of_week, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            ca_mois=Coalesce(Sum(F('total_ttc')), Decimal('0'))
        )
        ca_jour = ca_stats['ca_jour']
        ca_sem = ca_stats['ca_sem']
        ca_mois = ca_stats['ca_mois']

        # --- Marge (Grouped & Improved) ---
        factures_mois_qs = Facture.objects.filter(
            date__date__gte=start_of_month,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )

        # Aggregate total global discounts
        remises_stats = factures_mois_qs.aggregate(
            remise_jour=Coalesce(Sum(Case(When(date__date=today, then=F('remise')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            remise_sem=Coalesce(Sum(Case(When(date__date__gte=start_of_week, then=F('remise')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            remise_mois=Coalesce(Sum(F('remise')), Decimal('0'))
        )

        # 1. Somme du CA TTC sur les périodes
        ca_ttc_stats = factures_mois_qs.aggregate(
            ttc_jour=Coalesce(Sum(Case(When(date__date=today, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            ttc_sem=Coalesce(Sum(Case(When(date__date__gte=start_of_week, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
            ttc_mois=Coalesce(Sum(F('total_ttc')), Decimal('0'))
        )

        # 2. Somme des Coûts (Centralized calculation with discounts)
        # NOTE: Manager stats exclude is_divers like monthly reports
        from ..services.margin_service import MarginService
        
        margin_jour_stats = MarginService.calculate_period_margin_with_discounts(
            date_debut=today,
            date_fin=today + timedelta(days=1),
            exclude_is_divers=True
        )
        margin_jour = margin_jour_stats['marge_brute']
        
        margin_sem_stats = MarginService.calculate_period_margin_with_discounts(
            date_debut=start_of_week,
            date_fin=today + timedelta(days=1),
            exclude_is_divers=True
        )
        margin_sem = margin_sem_stats['marge_brute']
        
        margin_mois_stats = MarginService.calculate_period_margin_with_discounts(
            date_debut=start_of_month,
            date_fin=today + timedelta(days=1),
            exclude_is_divers=True
        )
        margin_mois = margin_mois_stats['marge_brute']
        
        # --- Objectifs (Full fetch) ---
        objectifs_data = ObjectifCommercial.get_objectifs_courants()
        
        obj_jour = objectifs_data['jour'].ca_objectif if objectifs_data['jour'] else Decimal('0')
        taux_jour = float((ca_jour / obj_jour) * 100) if obj_jour > 0 else 0
        
        obj_sem = objectifs_data['semaine'].ca_objectif if objectifs_data['semaine'] else Decimal('0')
        taux_sem = float((ca_sem / obj_sem) * 100) if obj_sem > 0 else 0
        
        obj_mois = objectifs_data['mois'].ca_objectif if objectifs_data['mois'] else Decimal('0')
        taux_mois = float((ca_mois / obj_mois) * 100) if obj_mois > 0 else 0
        
        # 5. Smart Alerts
        alerts = []
        
        # Load Settings (with fallback defaults if singleton missing)
        from ..models import PharmacySettings
        settings = PharmacySettings.objects.first()
        
        perf_drop = settings.perf_drop_threshold if (settings and settings.perf_drop_threshold) else Decimal('0.7')
        perf_alert_hour = settings.perf_alert_hour if settings else 14
        stock_days_alert = settings.low_stock_threshold_days if settings else 15
        debt_alert_val = settings.debt_alert_threshold if settings else Decimal('100000')
        dormant_days_limit = settings.dormant_stock_days if settings else 90
        shortage_alert_threshold = settings.shortage_alert_threshold if settings else 10

        # Performance Alert (if CA < perf_drop of target after perf_alert_hour)
        day_actual = ca_jour # Use the already calculated ca_jour
        day_target = obj_jour # Use the already calculated obj_jour
        if day_target > 0 and now.hour >= perf_alert_hour:
            rate = (float(day_actual) / float(day_target)) * 100
            if rate < float(perf_drop * 100):
                alerts.append({
                    'type': 'danger',
                    'title_key': 'manager_dashboard.alerts.perf_title',
                    'message_key': 'manager_dashboard.alerts.perf_msg',
                    'params': {'rate': round(rate)}
                })
        
        # Stock Alert (Critical shortages)
        # Only count products that HAVE a minimum stock defined (> 0)
        shortages = Produit.objects.filter(
            stock__lte=F('stock_minimum'), 
            stock_minimum__gt=0,
            is_active=True
        ).count()
        if shortages > shortage_alert_threshold:
            alerts.append({
                'type': 'warning',
                'title_key': 'manager_dashboard.alerts.shortage_title',
                'message_key': 'manager_dashboard.alerts.shortage_msg',
                'params': {'count': shortages}
            })

        # --- IMPORTANT DEBTORS ALERT ---
        # Find clients with significant debt defined in settings
        debt_threshold = Decimal(debt_alert_val)
        
        from django.db.models import Subquery
        
        # Sous-requête 1: Total facturé par client (factures VAL/PAY)
        billed_sub = Facture.objects.filter(
            client=OuterRef('pk'),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').values('client').annotate(
            s=Sum('total_ttc')
        ).values('s')[:1]
        
        # Sous-requête 2: Total payé par client (hors en_compte)
        paid_sub = Caisse.objects.filter(
            facture__client=OuterRef('pk'),
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture__client').annotate(
            s=Sum('montant')
        ).values('s')[:1]

        clients_with_debt = Client.objects.filter(is_active=True).annotate(
            total_billed=Coalesce(Subquery(billed_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
            paid_amount=Coalesce(Subquery(paid_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
        ).annotate(
            calculated_debt=F('total_billed') - F('paid_amount')
        ).filter(calculated_debt__gt=debt_threshold).exclude(name__icontains='DIVERS').order_by('-calculated_debt')[:5]

        if clients_with_debt.exists():
            count = clients_with_debt.count()
            top_client = clients_with_debt[0]
            alerts.append({
                'type': 'danger',
                'title_key': 'manager_dashboard.alerts.debt_title',
                'message_key': 'manager_dashboard.alerts.debt_msg',
                'params': {
                    'count': count, 
                    'threshold': int(debt_threshold),
                    'top_name': top_client.name,
                    'top_debt': int(top_client.calculated_debt)
                }
            })

        # --- DORMANT STOCKS ALERT ---
        # Products with stock > 0 and no sales in last X days (from settings)
        limit_date = today - timedelta(days=dormant_days_limit)
        dormant_count = Produit.objects.filter(
            stock__gt=0,
            is_active=True
        ).exclude(
            factureproduit__facture__date__date__gte=limit_date,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            factureproduit__facture__paiements__isnull=False
        ).count()

        if dormant_count > 0:
            alerts.append({
                'type': 'warning',
                'title_key': 'manager_dashboard.alerts.dormant_title',
                'message_key': 'manager_dashboard.alerts.dormant_msg',
                'params': {'count': dormant_count, 'days': dormant_days_limit}
            })

        # Week over Week Performance Drop (Compare strictly same days so far)
        # e.g. If today is Tuesday, compare Mon-Tue this week vs Mon-Tue last week
        last_week_start = today - timedelta(days=7 + today.weekday()) # Last Monday
        current_week_start = today - timedelta(days=today.weekday()) # This Monday
        
        # Calculate how many days have passed this week (0=Mon, 1=Tue, ...)
        days_passed = (today - current_week_start).days
        
        # Limit Last Week to same number of days
        last_week_limit = last_week_start + timedelta(days=days_passed + 1)
        
        last_week_partial_ca = Facture.objects.filter(
            date__date__gte=last_week_start,
            date__date__lt=last_week_limit,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca']
        
        current_week_ca = Facture.objects.filter(
            date__date__gte=current_week_start,
            date__date__lte=today, # Include today explicitly
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca']
        
        # Only alert if we have enough history to compare and significant drop
        if last_week_partial_ca > 0 and current_week_ca < last_week_partial_ca * perf_drop:
             alerts.append({
                'type': 'warning',
                'title_key': 'manager_dashboard.alerts.drop_title',
                'message_key': 'manager_dashboard.alerts.drop_msg',
                'params': {}
            })

        return Response({
            'kpis': {
                'jour': {'actual': float(ca_jour), 'margin': float(margin_jour), 'target': float(obj_jour), 'rate': taux_jour},
                'semaine': {'actual': float(ca_sem), 'margin': float(margin_sem), 'target': float(obj_sem), 'rate': taux_sem},
                'mois': {'actual': float(ca_mois), 'margin': float(margin_mois), 'target': float(obj_mois), 'rate': taux_mois},
            },
            'alerts': alerts
        })

    @action(detail=False, methods=['get'])
    def recent_transactions(self, request):
        """Returns recent sales and orders."""
        recent_sales = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').select_related('client').order_by('-date')[:5]
        
        recent_orders = Commande.objects.filter().select_related('fournisseur').order_by('-date')[:5]
        
        sales_data = [{
            'id': s.id,
            'numero': s.numero_facture,
            'client': s.client.name if s.client else 'Client de passage',
            'amount': s.total_ttc,
            'date': s.date,
            'status': s.get_status_display()
        } for s in recent_sales]
        
        orders_data = [{
            'id': o.id,
            'fournisseur': o.fournisseur.name if o.fournisseur else 'Inconnu',
            'date': o.date,
            'status': o.get_status_display()
        } for o in recent_orders]
        
        return Response({
            'sales': sales_data,
            'orders': orders_data
        })

    @action(detail=False, methods=['get'])
    def hourly_traffic(self, request):
        """Returns average hourly traffic (number of sales) over the last 30 days."""
        from django.db.models.functions import ExtractHour
        from ..models import PharmacySettings
        
        settings = PharmacySettings.objects.first()
        days_count = settings.traffic_analysis_days if (settings and settings.traffic_analysis_days) else 30
        
        today = timezone.localtime(timezone.now()).date()
        date_ago = today - timedelta(days=days_count)
        
        # Get sales for last N days grouped by hour
        sales_by_hour = Facture.objects.filter(
            date__date__gte=date_ago,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').annotate(
            hour=ExtractHour('date')
        ).values('hour').annotate(
            count=Count('id'),
            total=Sum('total_ttc')
        ).order_by('hour')

        # Get today's sales grouped by hour for comparison
        today_sales_by_hour = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').annotate(
            hour=ExtractHour('date')
        ).values('hour').annotate(
            count=Count('id')
        )

        # Initialize 24h data
        traffic_data = {h: {'count': 0, 'total': 0, 'today_count': 0} for h in range(24)}
        
        # Fill with average data
        for item in sales_by_hour:
            hour = item['hour']
            traffic_data[hour]['count'] = float(item['count']) / days_count
            traffic_data[hour]['total'] = float(item['total'] or 0) / days_count
            
        # Fill with today's data
        for item in today_sales_by_hour:
            hour = item['hour']
            traffic_data[hour]['today_count'] = item['count']
            
        # Format for frontend
        response_data = [
            {
                'hour': f"{h:02d}h",
                'sales_count': round(traffic_data[h]['count'], 2),
                'today_sales_count': traffic_data[h]['today_count'],
                'revenue': round(traffic_data[h]['total'], 2)
            }
            for h in range(24)
        ]
        
        return Response(response_data)

    @action(detail=False, methods=['get'])
    def revenue_chart(self, request):
        """Returns daily revenue for the last 7 days in format expected by frontend."""
        end_date = timezone.localtime(timezone.now())
        start_date = end_date - timedelta(days=6)  # 7 days including today
        
        daily_revenue = Facture.objects.filter(
            date__date__gte=start_date.date(),
            date__date__lte=end_date.date(),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').annotate(
            day=TruncDay('date')
        ).values('day').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0')),
            nb_ventes=Count('id')
        ).order_by('day')
        
        # Build the data structure expected by frontend
        labels = []
        data = []
        nb_ventes_data = []
        current_date = start_date.date()
        revenue_map = {item['day'].date(): float(item['total']) for item in daily_revenue}
        ventes_map = {item['day'].date(): item['nb_ventes'] for item in daily_revenue}
        
        DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        while current_date <= end_date.date():
            day_label = DAY_NAMES[current_date.weekday()]
            labels.append(day_label)
            data.append(revenue_map.get(current_date, 0))
            nb_ventes_data.append(ventes_map.get(current_date, 0))
            current_date += timedelta(days=1)
            
        return Response({
            'labels': labels,
            'data': data,
            'nb_ventes': nb_ventes_data
        })

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """
        Returns top 10 products with lowest coverage (Days Remaining).
        Coverage = Stock / (rotation_moyenne / 30) = Stock * 30 / rotation_moyenne
        NOTE: rotation_moyenne is MONTHLY (units sold per month), so we divide by 30 to get daily rate.
        Includes products already out of stock (Coverage = 0).
        """
        from django.db.models.functions import Cast
        from django.db.models import FloatField
        from ..models import PharmacySettings
        
        settings = PharmacySettings.objects.first()
        min_coverage_days = settings.good_coverage_min_days if (settings and settings.good_coverage_min_days) else 15
        critical_days = settings.critical_stock_days if (settings and settings.critical_stock_days) else 7
        imminent_days = settings.imminent_rupture_days if (settings and settings.imminent_rupture_days) else 3
        
        # Avoid division by zero: only take products with moving stock (rotation > 0)
        # days_remaining = stock / (rotation_moyenne / 30) = stock * 30 / rotation_moyenne
        products = Produit.objects.filter(
            rotation_moyenne__gt=1
        ).annotate(
            daily_rotation=Cast(F('rotation_moyenne'), FloatField()) / 30.0,
            days_remaining=Cast(F('stock'), FloatField()) / (Cast(F('rotation_moyenne'), FloatField()) / 30.0)
        ).filter(
            Q(days_remaining__lte=min_coverage_days) | Q(stock__lte=0)
        ).order_by('days_remaining')[:10]
        
        data = []
        for p in products:
            days = 0
            if p.stock > 0 and p.rotation_moyenne > 0:
                # Convert monthly rotation to daily: rotation_moyenne / 30
                daily_rotation = float(p.rotation_moyenne) / 30.0
                days = round(p.stock / daily_rotation, 1) if daily_rotation > 0 else 0
            
            status = 'Rupture'
            if p.stock > 0:
                if days <= imminent_days:
                    status = 'Rupture imminente'
                elif days <= critical_days:
                    status = f'Critique ({days}j)'
                else:
                    status = f'~{int(days)}j de stock'

            data.append({
                'id': p.id,
                'name': p.name,
                'stock': p.stock,
                'min_stock': p.stock_minimum,
                'rotation': float(p.rotation_moyenne),
                'rotation_daily': round(float(p.rotation_moyenne) / 30.0, 2),
                'days_remaining': days,
                'status': status
            })
        
        return Response(data)

    @action(detail=False, methods=['get'])
    def clients_depassement(self, request):
        """
        Retourne la liste des clients professionnels ayant dépassé leur plafond de crédit.
        Utilisé pour les alertes du tableau de bord.
        """
        from django.db.models import Sum, F, Q, Value, DecimalField, Subquery
        from django.db.models.functions import Coalesce

        # Sous-requête 1: Total facturé par client (factures VAL/PAY)
        billed_sub = Facture.objects.filter(
            client=OuterRef('pk'),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').values('client').annotate(
            s=Sum('total_ttc')
        ).values('s')[:1]
        
        # Sous-requête 2: Total payé par client (hors en_compte)
        paid_sub = Caisse.objects.filter(
            facture__client=OuterRef('pk'),
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture__client').annotate(
            s=Sum('montant')
        ).values('s')[:1]

        # Optimisation : On génère le "current_debt_annotated" directement en SQL sans jointure cartésienne
        clients = Client.objects.filter(
            client_type='PROFESSIONNEL',
            plafond__gt=0
        ).exclude(name__icontains='DIVERS').annotate(
            total_billed=Coalesce(Subquery(billed_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
            paid_amount=Coalesce(Subquery(paid_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
        ).annotate(
            current_debt_annotated=F('total_billed') - F('paid_amount')
        )
        
        alert_clients = []
        for client in clients:
            debt = client.current_debt_annotated
            if debt > client.plafond:
                alert_clients.append({
                    'id': client.id,
                    'name': client.name,
                    'current_debt': debt,
                    'plafond': client.plafond,
                    'percent': (debt / client.plafond) * 100
                })
        
        # Sort by highest percentage/severity
        alert_clients.sort(key=lambda x: x['percent'], reverse=True)
        
        return Response(alert_clients)


    @action(detail=False, methods=['get'])
    def supplier_debts(self, request):
        """
        Returns detailed debt data for suppliers.
        For FACTURE type: returns individual invoices with due date status.
        For RELEVE type: returns grouped releves by period with due date status.
        """
        from ..models import Fournisseur, CommandeProduit, PaiementFournisseur, Commande
        from django.db.models import Sum, F, DecimalField, OuterRef, Subquery, Value, ExpressionWrapper
        from django.db.models.functions import Coalesce
        from datetime import date, timedelta
        from collections import defaultdict
        from decimal import Decimal

        today = date.today()

        # Optimize: Fetch all suppliers with annotated debt in ONE query
        # Use simpler subqueries without extra values() if possible
        commandes_total = CommandeProduit.objects.filter(
            commande__fournisseur=OuterRef('pk'),
            commande__status=Commande.Status.CLOTUREE
        ).order_by().values('commande__fournisseur').annotate(
            total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
        ).values('total')
        
        paiements_total = PaiementFournisseur.objects.filter(
            fournisseur=OuterRef('pk')
        ).order_by().values('fournisseur').annotate(
            total=Sum('montant', output_field=DecimalField())
        ).values('total')

        suppliers_qs = Fournisseur.objects.filter(is_active=True).annotate(
            total_du_annotated=Coalesce(Subquery(commandes_total[:1]), Value(0, output_field=DecimalField())),
            total_paye_annotated=Coalesce(Subquery(paiements_total[:1]), Value(0, output_field=DecimalField()))
        ).annotate(
            solde_dette_annotated=ExpressionWrapper(
                F('total_du_annotated') - F('total_paye_annotated'),
                output_field=DecimalField()
            )
        ).filter(solde_dette_annotated__gt=0)

        data = []
        total_debt_global = Decimal('0.00')

        # Charger les totaux par commande (quantité × prix)
        order_total_sub = CommandeProduit.objects.filter(
            commande=OuterRef('pk')
        ).values('commande').annotate(
            total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
        ).values('total')

        all_orders = Commande.objects.filter(
            fournisseur__in=suppliers_qs,
            status=Commande.Status.CLOTUREE
        ).annotate(
            total_annotated=Coalesce(Subquery(order_total_sub[:1]), Value(0, output_field=DecimalField())),
        ).order_by('date_cloture')

        # Charger TOUS les paiements fournisseurs (globaux + liés à commande)
        # groupés par fournisseur_id → montant total payé réel
        all_payments = PaiementFournisseur.objects.filter(
            fournisseur__in=suppliers_qs
        ).values('fournisseur_id').annotate(
            total=Sum('montant', output_field=DecimalField())
        )
        payments_by_supplier = {row['fournisseur_id']: row['total'] or Decimal('0.00') for row in all_payments}

        # Grouper les commandes par fournisseur
        orders_by_supplier = defaultdict(list)
        for order in all_orders:
            orders_by_supplier[order.fournisseur_id].append(order)

        for supplier in suppliers_qs:
            total_debt_global += supplier.solde_dette_annotated
            orders = orders_by_supplier[supplier.id]

            supplier_items = []

            # Répartition FIFO des paiements globaux sur les commandes (du plus ancien au plus récent).
            # Cela gère correctement les réglements sans FK commande (champ déprécié).
            budget_restant = payments_by_supplier.get(supplier.id, Decimal('0.00'))
            remainings: dict[int, Decimal] = {}
            for order in orders:
                order_total = order.total_annotated
                applique = min(budget_restant, order_total)
                remainings[order.id] = order_total - applique
                budget_restant -= applique

            if supplier.type_reglement == 'FACTURE':
                # Individual invoices
                for order in orders:
                    remaining = remainings.get(order.id, order.total_annotated)

                    if remaining > 0:
                        # Calculate due date
                        due_date = order.date_echeance
                        if not due_date:
                            # Fallback: use order closure date + payment delay
                            base_date = order.date_cloture.date() if order.date_cloture else order.date.date()
                            due_date = base_date + timedelta(days=supplier.delai_paiement_jours)

                        is_overdue = due_date < today
                        days_diff = (today - due_date).days

                        supplier_items.append({
                            'id': order.id,
                            'type': 'FACTURE',
                            'label': order.numero_facture or f'Cmd #{order.id}',
                            'amount': float(remaining),
                            'due_date': due_date.isoformat(),
                            'is_overdue': is_overdue,
                            'days_overdue': days_diff if is_overdue else None,
                            'days_remaining': -days_diff if not is_overdue else None,
                        })

            else:  # RELEVE
                # Group by releve periods
                period_days = supplier.periode_releve_jours or 10
                from typing import Dict, List, Any
                periods: Dict[str, Dict[str, Any]] = {}

                for order in orders:
                    remaining = remainings.get(order.id, order.total_annotated)

                    if remaining > 0:
                        # Determine period based on order date
                        order_date = order.date.date()
                        # Calculate period start (e.g., for 10-day periods: 1-10, 11-20, 21-31)
                        day = order_date.day
                        period_index = (day - 1) // period_days
                        period_start = order_date.replace(day=period_index * period_days + 1)
                        period_end = min(
                            period_start + timedelta(days=period_days - 1),
                            order_date.replace(day=1) + timedelta(days=32)
                        )
                        period_key = period_start.isoformat()

                        if period_key not in periods:
                            periods[period_key] = {'orders': [], 'total': Decimal('0.00')}
                        periods[period_key]['orders'].append(order)
                        periods[period_key]['total'] += remaining

                # Create items for each period
                for period_key in sorted(periods.keys(), reverse=True):
                    period_data = periods[period_key]
                    period_total: Decimal = period_data['total']
                    period_orders: List[Any] = period_data['orders']

                    if period_total > 0:
                        period_start = date.fromisoformat(period_key)
                        period_end = period_start + timedelta(days=period_days - 1)

                        # Due date = period end + payment delay
                        due_date = period_end + timedelta(days=supplier.delai_paiement_jours)

                        is_overdue = due_date < today
                        days_diff = (today - due_date).days

                        # Get order IDs for this period
                        order_ids = [o.id for o in period_data['orders']]

                        supplier_items.append({
                            'id': f'{supplier.id}_{period_key}',
                            'type': 'RELEVE',
                            'label': f'{period_start.day}-{min(period_end.day, 31)}/{period_start.month:02d}',
                            'amount': float(period_total),
                            'due_date': due_date.isoformat(),
                            'is_overdue': is_overdue,
                            'days_overdue': days_diff if is_overdue else None,
                            'days_remaining': -days_diff if not is_overdue else None,
                            'order_ids': order_ids,
                        })

            # Sort items: overdue first, then by due date
            supplier_items.sort(key=lambda x: (not x['is_overdue'], x['due_date']))

            if supplier_items:

                data.append({
                    'id': supplier.id,
                    'name': supplier.name,
                    'phone': supplier.phone,
                    'type_reglement': supplier.type_reglement,
                    'delai_paiement_jours': supplier.delai_paiement_jours,
                    'periode_releve_jours': supplier.periode_releve_jours,
                    'debt_total': float(supplier.solde_dette_annotated),
                    'items': supplier_items,
                    'overdue_count': sum(1 for item in supplier_items if item['is_overdue']),
                    'overdue_amount': sum(item['amount'] for item in supplier_items if item['is_overdue']),
                })

        # Sort by overdue amount (highest first), then by total debt
        data.sort(key=lambda x: (-x['overdue_amount'], -x['debt_total']))

        # Pagination optionnelle pour éviter un payload énorme sur de gros volumes
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        limit = max(1, min(limit, 200))  # plafond 200 par page
        offset = max(0, offset)
        paginated = data[offset:offset + limit]

        return Response({
            'total_debt': float(total_debt_global),
            'total_suppliers': len(data),
            'limit': limit,
            'offset': offset,
            'suppliers': paginated
        })


class StatistiquesViewSet(viewsets.ViewSet):

    """
    ViewSet pour les statistiques avancées.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def ca_par_fournisseur(self, request):
        # Support des deux conventions de nommage de paramètres
        start_date = request.query_params.get('date_debut') or request.query_params.get('start_date')
        end_date = request.query_params.get('date_fin') or request.query_params.get('end_date')
        
        from ..models import Facture, FactureProduit, FactureProduitAllocation
        from collections import defaultdict
        
        # Filtre de base pour les factures
        factures_q = Q(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
        
        if start_date:
            try:
                d_debut = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                if timezone.is_naive(d_debut): d_debut = timezone.make_aware(d_debut)
                factures_q &= Q(date__gte=d_debut)
            except ValueError:
                factures_q &= Q(date__gte=start_date)

        if end_date:
            try:
                d_fin = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                if timezone.is_naive(d_fin): d_fin = timezone.make_aware(d_fin)
                if d_fin.hour == 0 and d_fin.minute == 0 and d_fin.second == 0:
                    d_fin = d_fin + timedelta(days=1)
                    factures_q &= Q(date__lt=d_fin)
                else:
                    factures_q &= Q(date__lte=d_fin)
            except ValueError:
                factures_q &= Q(date__lte=end_date)
        
        # 1. Identifier les IDs des factures concernées
        facture_ids = Facture.objects.filter(factures_q).values_list('id', flat=True)
        
        # 2. Récupérer les lignes de facture avec les infos nécessaires
        lignes = FactureProduit.objects.filter(facture_id__in=facture_ids).values(
            'id', 'quantity', 'selling_price', 'discount', 
            'facture__id', 'facture__remise',
            'produit__fournisseur__id', 'produit__fournisseur__name'
        )
        
        # 3. Récupérer les allocations pour la traçabilité FIFO/FEFO
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture_id__in=facture_ids
        ).values(
            'facture_produit__id', 'quantity', 'cost_price', 
            'stock_lot__fournisseur__id', 'stock_lot__fournisseur__name'
        )
        
        # Organisation en map pour un accès rapide
        alloc_map = defaultdict(list)
        for a in allocations:
            alloc_map[a['facture_produit__id']].append(a)
            
        # Calcul du brut total par facture pour la répartition de la remise globale
        facture_bruts = defaultdict(Decimal)
        for l in lignes:
            facture_bruts[l['facture__id']] += l['quantity'] * (l['selling_price'] - l['discount'])

        stats_fournisseur = defaultdict(lambda: {
            'ca_ttc': Decimal('0.00'), 'cout_achat': Decimal('0.00'), 
            'quantite_vendue': 0, 'nom': 'Inconnu'
        })

        for l in lignes:
            line_gross = l['quantity'] * (l['selling_price'] - l['discount'])
            total_gross_facture = facture_bruts[l['facture__id']]
            
            # Ratio pour la remise globale (proportionnelle au brut TTC de la ligne)
            ratio = line_gross / total_gross_facture if total_gross_facture > 0 else Decimal('0.00')
            part_remise = (l['facture__remise'] or Decimal('0')) * ratio
            line_net = line_gross - part_remise
            
            line_allocs = alloc_map.get(l['id'], [])
            
            if not line_allocs:
                # Fallback sur le fournisseur par défaut du produit
                fid = l['produit__fournisseur__id'] or 0
                fname = l['produit__fournisseur__name'] or 'Inconnu'
                stats_fournisseur[fid]['ca_ttc'] += line_net
                stats_fournisseur[fid]['quantite_vendue'] += l['quantity']
                stats_fournisseur[fid]['nom'] = fname
            else:
                total_qty_alloc = sum(a['quantity'] for a in line_allocs)
                for a in line_allocs:
                    # Répartition du net de la ligne au prorata de la quantité du lot
                    ratio_alloc = Decimal(a['quantity']) / Decimal(total_qty_alloc) if total_qty_alloc > 0 else Decimal('0')
                    alloc_net = line_net * ratio_alloc
                    alloc_cost = a['quantity'] * a['cost_price']
                    
                    # Le fournisseur du lot est prioritaire, sinon celui du produit
                    fid = a['stock_lot__fournisseur__id'] or l['produit__fournisseur__id'] or 0
                    fname = a['stock_lot__fournisseur__name'] or l['produit__fournisseur__name'] or 'Inconnu'
                    
                    stats_fournisseur[fid]['ca_ttc'] += alloc_net
                    stats_fournisseur[fid]['cout_achat'] += alloc_cost
                    stats_fournisseur[fid]['quantite_vendue'] += a['quantity']
                    stats_fournisseur[fid]['nom'] = fname

        # Formatage du résultat final
        resultat = []
        for fid, s in stats_fournisseur.items():
            ca_ttc = s['ca_ttc']
            cout_achat = s['cout_achat']
            marge_brute = ca_ttc - cout_achat
            resultat.append({
                'id': fid,
                'nom': s['nom'],
                'ca_ttc': float(ca_ttc),
                'cout_achat': float(cout_achat),
                'marge_brute': float(marge_brute),
                'quantite_vendue': s['quantite_vendue']
            })
            
        return Response(sorted(resultat, key=lambda x: x['ca_ttc'], reverse=True))

    @action(detail=False, methods=['get'])
    def cancel_alerts(self, request):
        """
        Retourne la liste des utilisateurs ayant annulé plus de X factures
        sur une période donnée.
        """
        from ..models import AuditLog
        from django.contrib.auth.models import User
        
        threshold = int(request.query_params.get('threshold', 5))
        days = int(request.query_params.get('days', 30))
        
        start_date = timezone.localtime(timezone.now()) - timedelta(days=days)
        
        # Compter les annulations par utilisateur
        cancellations = AuditLog.objects.filter(
            action=AuditLog.Action.INVOICE_CANCEL,
            timestamp__gte=start_date
        ).values('user').annotate(
            count=Count('id')
        ).filter(count__gte=threshold).order_by('-count')
        
        # Charger tous les utilisateurs concernés en une seule fois
        user_ids = [c['user'] for c in cancellations if c['user']]
        users_map = {}
        if user_ids:
            users = User.objects.filter(id__in=user_ids)
            users_map = {u.id: (u.get_full_name() or u.username) for u in users}

        results = []
        for c in cancellations:
            user_id = c['user']
            if not user_id:
                name = "Système / Inconnu"
            else:
                name = users_map.get(user_id, f"Utilisateur #{user_id}")
            
            # Note: total_amount might need cleaner extraction depending on DB/Django version JSONField support
            # For now returning count is the MVP
            results.append({
                'Utilisateur': name,
                'Nombre Annulations': c['count'],
                'Période (jours)': days,
                'Seuil': threshold
            })
            
        return Response(results)

    @action(detail=False, methods=['get'])
    def stock_health(self, request):
        """
        Analyse experte de la santé du stock.
        Calcul du capital dormant, des pertes sur ruptures et du score de santé global.
        """
        from api.models.settings import PharmacySettings
        ps = PharmacySettings.objects.first()

        # 1. Capital Dormant
        today = timezone.localtime(timezone.now()).date()
        dormant_days = ps.dormant_stock_days if (ps and ps.dormant_stock_days) else 90
        limit_date = today - timedelta(days=dormant_days)
        
        dormant_qs = Produit.objects.filter(stock__gt=0, is_active=True).filter(
            Q(dernier_vente__lte=limit_date) | 
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=limit_date)) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) & Q(created_at__date__lte=limit_date))
        )
        
        dead_stock_value = dormant_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total']
        
        dead_stock_count = dormant_qs.count()

        # 2. Pertes Estimées sur Ruptures (Ventes manquées)
        rupture_qs = Produit.objects.filter(stock__lte=0, rotation_moyenne__gt=0, is_active=True)
        
        lost_revenue_monthly = rupture_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('rotation_moyenne') * F('selling_price'), output_field=DecimalField())), Decimal('0'))
        )['total']
        
        lost_margin_monthly = rupture_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('rotation_moyenne') * (F('selling_price') - F('pmp')), output_field=DecimalField())), Decimal('0'))
        )['total']

        # 3. Ruptures Imminentes
        critical_days = ps.critical_stock_days if (ps and ps.critical_stock_days) else 7
        critical_soon_qs = Produit.objects.filter(
            is_active=True,
            rotation_moyenne__gt=0,
            stock__gt=0
        ).annotate(
            days_left=ExpressionWrapper(F('stock') * Value(30.0) / F('rotation_moyenne'), output_field=DecimalField())
        ).filter(days_left__lt=critical_days)
        
        critical_soon_count = critical_soon_qs.count()
        critical_soon_value = critical_soon_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total']

        # 4. Score de Santé Global — 5 composantes dynamiques
        total_active_count = Produit.objects.filter(is_active=True).count() or 1
        total_stock_value = Produit.objects.filter(is_active=True, stock__gt=0).aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total'] or Decimal('1')

        # ── Composante A : Disponibilité (pas de rupture) — 30 pts ──────────────
        rupture_total_count = Produit.objects.filter(is_active=True, stock__lte=0).count()
        availability_rate = (1 - float(rupture_total_count) / float(total_active_count)) * 100
        score_a = availability_rate * 0.30  # max 30 pts

        # ── Composante B : Fluidité du stock (peu de stock dormant) — 25 pts ────
        produits_avec_rotation = Produit.objects.filter(is_active=True, rotation_moyenne__gt=0).count() or 1
        dormant_avec_rotation = dormant_qs.filter(rotation_moyenne__gt=0).count()
        fluidity_rate = (1 - float(dormant_avec_rotation) / float(produits_avec_rotation)) * 100
        fluidity_rate = max(0.0, min(100.0, fluidity_rate))
        score_b = fluidity_rate * 0.25  # max 25 pts

        # ── Composante C : Couverture de stock (ni sur-stock ni sous-stock) — 20 pts
        min_coverage = ps.good_coverage_min_days if (ps and ps.good_coverage_min_days) else 15
        max_coverage = ps.good_coverage_max_days if (ps and ps.good_coverage_max_days) else 90
        produits_avec_rot = Produit.objects.filter(is_active=True, rotation_moyenne__gt=0, stock__gt=0)
        bonne_couverture = 0
        for p in produits_avec_rot:
            daily = float(p.rotation_moyenne) / 30.0
            if daily > 0:
                jours = float(p.stock) / daily
                if min_coverage <= jours <= max_coverage:
                    bonne_couverture += 1
        total_avec_rot = produits_avec_rot.count() or 1
        coverage_rate = (bonne_couverture / total_avec_rot) * 100
        score_c = coverage_rate * 0.20  # max 20 pts

        # ── Composante D : Activité récente des ventes (30 derniers jours) — 15 pts
        thirty_days_ago = today - timedelta(days=30)
        produits_vendus_recemment = Produit.objects.filter(
            is_active=True, rotation_moyenne__gt=0,
            dernier_vente__gte=thirty_days_ago
        ).count()
        activity_rate = (float(produits_vendus_recemment) / float(produits_avec_rotation)) * 100
        activity_rate = min(100.0, activity_rate)
        score_d = activity_rate * 0.15  # max 15 pts

        # ── Composante E : Pas de sur-immobilisation financière — 10 pts ─────────
        # Ratio stock dormant / valeur totale du stock (avec rotation comme filtre)
        dead_stock_value_rot = dormant_qs.filter(rotation_moyenne__gt=0).aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total'] or Decimal('0')
        immo_ratio = float(dead_stock_value_rot) / float(total_stock_value)
        immo_score = max(0.0, (1 - immo_ratio)) * 100
        score_e = immo_score * 0.10  # max 10 pts

        # ── Score final ──────────────────────────────────────────────────────────
        health_score_raw = score_a + score_b + score_c + score_d + score_e
        health_score = max(0.0, min(100.0, health_score_raw))

        # Pour la compatibilité frontend (rotation_rate = fluidity_rate)
        rotation_rate = fluidity_rate

        # Poids (pour l'affichage UI — on garde les settings mais la formule est fixe maintenant)
        avail_weight = Decimal(str(ps.availability_weight)) / Decimal('100.0') if ps else Decimal('0.6')
        rot_weight = Decimal(str(ps.rotation_weight)) / Decimal('100.0') if ps else Decimal('0.4')
        
        return Response({
            'health_score': round(float(health_score), 1),
            'availability_rate': round(float(availability_rate), 1),
            'rotation_rate': round(float(rotation_rate), 1),
            'availability_weight': int(avail_weight * 100),
            'rotation_weight': int(rot_weight * 100),
            'score_details': {
                'disponibilite': {'score': round(score_a, 1), 'rate': round(availability_rate, 1), 'weight': 30},
                'fluidite':      {'score': round(score_b, 1), 'rate': round(fluidity_rate, 1),    'weight': 25},
                'couverture':    {'score': round(score_c, 1), 'rate': round(coverage_rate, 1),    'weight': 20},
                'activite':      {'score': round(score_d, 1), 'rate': round(activity_rate, 1),    'weight': 15},
                'immobilisation':{'score': round(score_e, 1), 'rate': round(immo_score, 1),       'weight': 10},
            },
            'dead_stock': {
                'value': float(dead_stock_value),
                'count': dead_stock_count,
                'days_threshold': dormant_days
            },
            'missed_sales': {
                'monthly_revenue': float(lost_revenue_monthly),
                'monthly_margin': float(lost_margin_monthly),
                'daily_revenue': float(lost_revenue_monthly) / 30.0
            },
            'critical_alerts': {
                'soon_out_of_stock_count': critical_soon_count,
                'soon_out_of_stock_value': float(critical_soon_value)
            },
            'total_stock_value': float(total_stock_value)
        })


