from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, Value, ExpressionWrapper, Case, When, Exists, OuterRef
from django.db.models.functions import TruncDay, TruncMonth, Coalesce, TruncDate
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from ...models import Facture, Commande, Produit, Client, StockLot, Caisse, ObjectifCommercial, FactureProduit, FactureProduitAllocation
from ...dashboard_cache import DashboardCache


class DashboardCoreMixin(viewsets.ViewSet):
    
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
        from ..produits import ProduitViewSet
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
    
        # Cache: 30s pour les stats temps réel (CA, ventes, stock)
        user_id = request.user.id if request.user.is_authenticated else 0
        cached = DashboardCache.get_stats(user_id, role)
        if cached is not None:
            return Response(cached)
    
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
            from ...models import FactureProduit
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
            })
        
        # Mettre en cache (30s pour les stats temps réel)
        DashboardCache.set_stats(user_id, role, response_data, ttl=DashboardCache.STATS_FAST_TTL)
    
        return Response(response_data)
    
    @action(detail=False, methods=['get'])
    def stats_heavy(self, request):
        """
        Stats lourdes séparées: dormant_stock + margin_today.
        Cache: 5 minutes (ces données changent peu).
        """
        today = timezone.localtime(timezone.now()).date()
        user_id = request.user.id if request.user.is_authenticated else 0
        
        # Cache: 5 min pour les stats lourdes
        cached = DashboardCache.get_heavy_stats(user_id)
        if cached is not None:
            return Response(cached)
        
        # 1. Today's Margin
        from ...services.margin_service import MarginService
        margin_stats = MarginService.calculate_period_margin_with_discounts(
            date_debut=today,
            date_fin=today + timedelta(days=1),
            exclude_is_divers=False
        )
        margin_today = margin_stats['marge_brute']
        
        # 2. Dormant Stock (6 months)
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
        
        response_data = {
            'margin_today': float(margin_today),
            'dormant_stock': dormant_stock_data
        }
        
        DashboardCache.set_heavy_stats(user_id, response_data)
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
        from ...services.margin_service import MarginService
    
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
        marge_obj_jour = objectifs_data['jour'].marge_objectif if objectifs_data['jour'] else Decimal('0')
        taux_jour = float((ca_jour / obj_jour) * 100) if obj_jour > 0 else 0
        taux_marge_jour = float((margin_jour / marge_obj_jour) * 100) if marge_obj_jour > 0 else 0
    
        obj_sem = objectifs_data['semaine'].ca_objectif if objectifs_data['semaine'] else Decimal('0')
        marge_obj_sem = objectifs_data['semaine'].marge_objectif if objectifs_data['semaine'] else Decimal('0')
        taux_sem = float((ca_sem / obj_sem) * 100) if obj_sem > 0 else 0
        taux_marge_sem = float((margin_sem / marge_obj_sem) * 100) if marge_obj_sem > 0 else 0
    
        obj_mois = objectifs_data['mois'].ca_objectif if objectifs_data['mois'] else Decimal('0')
        marge_obj_mois = objectifs_data['mois'].marge_objectif if objectifs_data['mois'] else Decimal('0')
        taux_mois = float((ca_mois / obj_mois) * 100) if obj_mois > 0 else 0
        taux_marge_mois = float((margin_mois / marge_obj_mois) * 100) if marge_obj_mois > 0 else 0
    
        # 5. Smart Alerts
        alerts = []
    
        # Load Settings (with fallback defaults if singleton missing)
        from ...models import PharmacySettings
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
                    'icon': 'trending_down',
                    'priority': 1,
                    'title_key': 'manager_dashboard.alerts.perf_title',
                    'message_key': 'manager_dashboard.alerts.perf_msg',
                    'params': {'rate': round(rate)},
                    'action_key': 'manager_dashboard.alerts.action_sales',
                    'action_route': '/app/facturation'
                })
    
        # Success Alert (if daily objective exceeded)
        if day_target > 0 and float(day_actual) >= float(day_target):
            rate_success = (float(day_actual) / float(day_target)) * 100
            alerts.append({
                'type': 'success',
                'icon': 'trophy',
                'priority': 5,
                'title_key': 'manager_dashboard.alerts.success_title',
                'message_key': 'manager_dashboard.alerts.success_msg',
                'params': {'rate': round(rate_success)},
                'action_key': None,
                'action_route': None
            })
    
        # Inactivity Alert (no sales since X hours during business hours)
        if now.hour >= 9:
            hours_since_open = now.hour - 8
            last_sale = Facture.objects.filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__date=today
            ).order_by('-date').first()
            if last_sale is None and hours_since_open >= 2:
                alerts.append({
                    'type': 'warning',
                    'icon': 'clock',
                    'priority': 2,
                    'title_key': 'manager_dashboard.alerts.inactivity_title',
                    'message_key': 'manager_dashboard.alerts.inactivity_msg',
                    'params': {'hours': hours_since_open},
                    'action_key': 'manager_dashboard.alerts.action_sales',
                    'action_route': '/app/facturation'
                })
            elif last_sale:
                from django.utils import timezone as tz
                idle_minutes = int((now - tz.localtime(last_sale.date)).total_seconds() / 60)
                if idle_minutes >= 120 and now.hour < 20:
                    alerts.append({
                        'type': 'warning',
                        'icon': 'clock',
                        'priority': 2,
                        'title_key': 'manager_dashboard.alerts.inactivity_title',
                        'message_key': 'manager_dashboard.alerts.inactivity_idle_msg',
                        'params': {'minutes': idle_minutes},
                        'action_key': 'manager_dashboard.alerts.action_sales',
                        'action_route': '/app/facturation'
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
                'type': 'danger',
                'icon': 'package_x',
                'priority': 2,
                'title_key': 'manager_dashboard.alerts.shortage_title',
                'message_key': 'manager_dashboard.alerts.shortage_msg',
                'params': {'count': shortages},
                'action_key': 'manager_dashboard.alerts.action_stock',
                'action_route': '/app/ruptures'
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
                'icon': 'credit_card',
                'priority': 3,
                'title_key': 'manager_dashboard.alerts.debt_title',
                'message_key': 'manager_dashboard.alerts.debt_msg',
                'params': {
                    'count': count, 
                    'threshold': int(debt_threshold),
                    'top_name': top_client.name,
                    'top_debt': int(top_client.calculated_debt)
                },
                'action_key': 'manager_dashboard.alerts.action_clients',
                'action_route': '/app/creances'
            })
    
        # --- DORMANT STOCKS ALERT ---
        # Products with stock > 0 and no sales in last X days (from settings)
        limit_date = today - timedelta(days=dormant_days_limit)
        dormant_count = Produit.objects.filter(
            stock__gt=0,
            is_active=True
        ).filter(
            Q(dernier_vente__lte=limit_date) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=limit_date)) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) & Q(created_at__date__lte=limit_date))
        ).count()
    
        if dormant_count > 0:
            alerts.append({
                'type': 'warning',
                'icon': 'archive',
                'priority': 4,
                'title_key': 'manager_dashboard.alerts.dormant_title',
                'message_key': 'manager_dashboard.alerts.dormant_msg',
                'params': {'count': dormant_count, 'days': dormant_days_limit},
                'action_key': 'manager_dashboard.alerts.action_stock',
                'action_route': '/app/stock-analysis'
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
                'icon': 'trending_down',
                'priority': 3,
                'title_key': 'manager_dashboard.alerts.drop_title',
                'message_key': 'manager_dashboard.alerts.drop_msg',
                'params': {},
                'action_key': 'manager_dashboard.alerts.action_sales',
                'action_route': '/app/manager-dashboard'
            })
    
        return Response({
            'kpis': {
                'jour': {'actual': float(ca_jour), 'margin': float(margin_jour), 'target': float(obj_jour), 'rate': taux_jour,
                         'marge_target': float(marge_obj_jour), 'marge_rate': taux_marge_jour},
                'semaine': {'actual': float(ca_sem), 'margin': float(margin_sem), 'target': float(obj_sem), 'rate': taux_sem,
                            'marge_target': float(marge_obj_sem), 'marge_rate': taux_marge_sem},
                'mois': {'actual': float(ca_mois), 'margin': float(margin_mois), 'target': float(obj_mois), 'rate': taux_mois,
                         'marge_target': float(marge_obj_mois), 'marge_rate': taux_marge_mois},
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
        from ...models import PharmacySettings
    
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
        from ...models import PharmacySettings
    
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
    
