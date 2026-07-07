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
    ).exclude(
        factureproduit__facture__date__date__gte=limit_date,
        factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        factureproduit__facture__paiements__isnull=False
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
