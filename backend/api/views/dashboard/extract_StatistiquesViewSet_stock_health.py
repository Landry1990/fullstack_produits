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
