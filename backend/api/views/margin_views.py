"""
Views pour le service centralisé des marges
Endpoints pour les calculs et analyses de marges
"""
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, permissions
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from api.services.margin_service import MarginService
from api.models import Produit

class MarginViewSet(viewsets.ViewSet):
    """
    ViewSet pour les calculs de marges centralisés
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def calculate_product_margin(self, request):
        """
        Calcule la marge pour un produit spécifique
        ?product_id=123
        """
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'product_id requis'}, status=400)
        
        try:
            product = Produit.objects.get(id=product_id)
            margins = MarginService.calculate_product_margin(
                product.cost_price, 
                product.selling_price
            )
            return Response(margins)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit non trouvé'}, status=404)
    
    @action(detail=False, methods=['post'])
    def update_all_margins(self, request):
        """
        Met à jour toutes les marges des produits
        """
        count = MarginService.update_product_margins()
        return Response({
            'message': f'{count} produits mis à jour',
            'count': count
        })
    
    @action(detail=False, methods=['post'])
    def update_selected_margins(self, request):
        """
        Met à jour les marges pour une liste de produits
        Body: {"product_ids": [1, 2, 3]}
        """
        product_ids = request.data.get('product_ids', [])
        if not product_ids:
            return Response({'error': 'product_ids requis'}, status=400)
        
        count = MarginService.update_product_margins(product_ids)
        return Response({
            'message': f'{count} produits mis à jour',
            'count': count
        })
    
    @action(detail=False, methods=['get'])
    def period_margin(self, request):
        """
        Calcule la marge sur une période
        ?date_debut=2024-01-01&date_fin=2024-01-31
        """
        try:
            date_debut = request.query_params.get('date_debut')
            date_fin = request.query_params.get('date_fin')
            
            if not date_debut or not date_fin:
                return Response({'error': 'date_debut et date_fin requis'}, status=400)
            
            # Conversion des dates
            date_debut = datetime.strptime(date_debut, '%Y-%m-%d').date()
            date_fin = datetime.strptime(date_fin, '%Y-%m-%d').date()
            
            margins = MarginService.calculate_period_margin(date_debut, date_fin)
            return Response(margins)
        except ValueError:
            return Response({'error': 'Format de date invalide (YYYY-MM-DD)'}, status=400)
    
    @action(detail=False, methods=['get'])
    def margin_variance(self, request):
        """
        Analyse de variance des marges entre deux périodes
        ?date_debut=2024-01-01&date_fin=2024-01-31&date_debut_compare=2023-12-01&date_fin_compare=2023-12-31
        """
        try:
            date_debut = request.query_params.get('date_debut')
            date_fin = request.query_params.get('date_fin')
            date_debut_compare = request.query_params.get('date_debut_compare')
            date_fin_compare = request.query_params.get('date_fin_compare')
            
            if not date_debut or not date_fin:
                return Response({'error': 'date_debut et date_fin requis'}, status=400)
            
            # Conversion des dates
            date_debut = datetime.strptime(date_debut, '%Y-%m-%d').date()
            date_fin = datetime.strptime(date_fin, '%Y-%m-%d').date()
            
            # Période de comparaison (optionnelle)
            date_debut_compare_dt = None
            date_fin_compare_dt = None
            if date_debut_compare and date_fin_compare:
                date_debut_compare_dt = datetime.strptime(date_debut_compare, '%Y-%m-%d').date()
                date_fin_compare_dt = datetime.strptime(date_fin_compare, '%Y-%m-%d').date()
            
            variance = MarginService.get_margin_variance_analysis(
                date_debut, date_fin, date_debut_compare_dt, date_fin_compare_dt
            )
            return Response(variance)
        except ValueError:
            return Response({'error': 'Format de date invalide (YYYY-MM-DD)'}, status=400)
    
    @action(detail=False, methods=['get'])
    def anomalous_margins(self, request):
        """
        Identifie les produits avec des marges anormalement élevées
        ?threshold=80&min_ca=1000
        """
        threshold = float(request.query_params.get('threshold', 80.0))
        min_ca = request.query_params.get('min_ca', '1000.00')
        
        try:
            min_ca_decimal = Decimal(min_ca)
            products = MarginService.get_products_with_anomalous_margins(threshold, min_ca_decimal)
            return Response({
                'count': len(products),
                'products': products
            })
        except ValueError:
            return Response({'error': 'Valeurs invalides'}, status=400)
