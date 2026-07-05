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
