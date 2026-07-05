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
