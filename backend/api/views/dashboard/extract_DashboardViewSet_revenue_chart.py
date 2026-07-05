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
