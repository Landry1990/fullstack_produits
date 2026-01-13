from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Commande, CommandeProduit
from django.db.models import Sum, Count, F, DecimalField, Value
from django.db.models.functions import TruncDate, Coalesce
from django.utils import timezone
import datetime

class HistoriqueAchatsViewSet(viewsets.ViewSet):
    """API endpoint for daily purchase history."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        fournisseur_id = request.query_params.get('fournisseur_id')

        # Filter only completed/closed orders
        queryset = Commande.objects.filter(status=Commande.Status.CLOTUREE)

        # Date filtering
        if date_debut:
            queryset = queryset.filter(date__date__gte=date_debut)
        
        if date_fin:
            # Inclusive end date filtering
            queryset = queryset.filter(date__date__lte=date_fin)
        
        # Supplier filtering
        if fournisseur_id:
            queryset = queryset.filter(fournisseur_id=fournisseur_id)

        # Aggregation by Day
        # We need to sum the total of products for each order.
        # Since Commande.total is not a stored field, we must calculate it via CommandeProduit.
        # We perform a join with products to sum (quantity * price).
        # Note: price in CommandeProduit is the purchase price.
        
        daily_stats = queryset.annotate(
            jour=TruncDate('date')
        ).values('jour').annotate(
            nb_commandes=Count('id', distinct=True),
            total_achat=Sum(
                F('produits__quantity') * F('produits__price'),
                output_field=DecimalField()
            )
        ).order_by('-jour')

        results = []
        for stat in daily_stats:
            results.append({
                'date': stat['jour'],
                'nb_commandes': stat['nb_commandes'],
                'total_achat': stat['total_achat'] or 0,
            })

        return Response(results)
