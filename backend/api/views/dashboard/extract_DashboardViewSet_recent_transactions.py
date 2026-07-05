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
