from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Commande, CommandeProduit
from django.db.models import Sum, Count, F, DecimalField, Value
from django.db.models.functions import TruncDate, Coalesce
from django.utils import timezone
import datetime

from rest_framework.pagination import PageNumberPagination

from rest_framework.decorators import action

class HistoriqueAchatsPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 1000

class HistoriqueAchatsViewSet(viewsets.ViewSet):
    """API endpoint for daily purchase history."""
    permission_classes = [IsAuthenticated]
    pagination_class = HistoriqueAchatsPagination

    def list(self, request):
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        fournisseur_id = request.query_params.get('fournisseur_id')
        commande_type = request.query_params.get('type')

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

        # Type filtering
        if commande_type:
            queryset = queryset.filter(type=commande_type)

        # Aggregation by Day
        daily_stats = queryset.annotate(
            jour=TruncDate('date')
        ).values('jour').annotate(
            nb_commandes=Count('id', distinct=True),
            total_achat=Sum(
                F('produits__quantity') * F('produits__price'),
                output_field=DecimalField()
            )
        ).order_by('-jour')

        # Pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(daily_stats, request)
        
        if page is not None:
            results = []
            for stat in page:
                results.append({
                    'date': stat['jour'],
                    'nb_commandes': stat['nb_commandes'],
                    'total_achat': stat['total_achat'] or 0,
                })
            return paginator.get_paginated_response(results)

        results = []
        for stat in daily_stats:
            results.append({
                'date': stat['jour'],
                'nb_commandes': stat['nb_commandes'],
                'total_achat': stat['total_achat'] or 0,
            })

        return Response(results)

    @action(detail=False, methods=['get'])
    def produits_details(self, request):
        """API endpoint for detailed product purchases by supplier and period."""
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        fournisseur_id = request.query_params.get('fournisseur_id')
        commande_type = request.query_params.get('type')

        # Filter only completed/closed orders
        queryset = CommandeProduit.objects.filter(commande__status=Commande.Status.CLOTUREE)

        # Date filtering (on the parent Commande)
        if date_debut:
            queryset = queryset.filter(commande__date__date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(commande__date__date__lte=date_fin)
        
        # Supplier filtering
        if fournisseur_id:
            queryset = queryset.filter(commande__fournisseur_id=fournisseur_id)

        # Type filtering
        if commande_type:
            queryset = queryset.filter(commande__type=commande_type)

        # Aggregation by Product
        product_stats = queryset.values(
            'produit_id', 
            'produit__name', 
            'produit__cip1'
        ).annotate(
            total_quantite=Sum('quantity'),
            total_achat=Sum(F('quantity') * F('price'), output_field=DecimalField()),
            nb_commandes=Count('commande_id', distinct=True)
        ).order_by('-total_achat')

        # Pagination
        if request.query_params.get('no_pagination') == 'true':
            return Response(product_stats)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(product_stats, request)
        
        if page is not None:
            return paginator.get_paginated_response(page)

        return Response(product_stats)
