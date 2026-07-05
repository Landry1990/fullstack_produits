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
