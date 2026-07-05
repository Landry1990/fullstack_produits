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
