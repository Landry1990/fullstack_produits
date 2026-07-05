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
