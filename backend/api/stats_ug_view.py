from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, F, Q, DecimalField, Count
from django.db.models.functions import Coalesce
from decimal import Decimal
from .models import StockLot, Fournisseur, CommandeProduit, Commande
from .serializers import FournisseurSerializer


class StatsUGViewSet(viewsets.GenericViewSet):
    """
    ViewSet pour les statistiques des unités gratuites (UG).
    """
    queryset = StockLot.objects.all()
    
    @action(detail=False, methods=['get'])
    def par_fournisseur(self, request):
        """
        Statistiques UG par fournisseur:
        - Total UG reçues
        - Total UG vendues (via allocations)
        - Total UG restantes en stock
        - Valeur économisée (prix moyen * UG reçues)
        
        QueryParams:
        - fournisseur_id: Filter by specific supplier (optional)
        - date_debut: Start date filter (optional)
        - date_fin: End date filter (optional)
        """
        fournisseur_id = request.query_params.get('fournisseur_id')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        # Base query
        lots_query = StockLot.objects.all()
        
        # Apply filters
        if fournisseur_id:
            lots_query = lots_query.filter(fournisseur_id=fournisseur_id)
        
        if date_debut:
            lots_query = lots_query.filter(date_reception__gte=date_debut)
        
        if date_fin:
            lots_query = lots_query.filter(date_reception__lte=date_fin)
        
        # Aggregate by supplier
        stats = lots_query.values(
            'fournisseur_id',
            'fournisseur__name'
        ).annotate(
            ug_recues=Sum('quantity_free'),
            ug_restantes=Sum(F('quantity_remaining') * F('quantity_free') / F('quantity_initial'), 
                           output_field=DecimalField()),
            valeur_economisee=Sum(F('quantity_free') * F('price_cost'), 
                                output_field=DecimalField())
        ).order_by('-ug_recues')
        
        # Calculate UG vendues = ug_recues - ug_restantes
        results = []
        for stat in stats:
            ug_vendues = (stat['ug_recues'] or 0) - (stat['ug_restantes'] or 0)
            results.append({
                'fournisseur_id': stat['fournisseur_id'],
                'fournisseur_nom': stat['fournisseur__name'],
                'ug_recues': int(stat['ug_recues'] or 0),
                'ug_vendues': int(ug_vendues),
                'ug_restantes': int(stat['ug_restantes'] or 0),
                'valeur_economisee': float(stat['valeur_economisee'] or 0)
            })
        
        return Response({
            'results': results,
            'total': {
                'ug_recues': sum(r['ug_recues'] for r in results),
                'ug_vendues': sum(r['ug_vendues'] for r in results),
                'ug_restantes': sum(r['ug_restantes'] for r in results),
                'valeur_economisee': sum(r['valeur_economisee'] for r in results)
            }
        })
    
    @action(detail=False, methods=['get'])
    def par_produit(self, request):
        """
        Statistiques UG pour un produit spécifique:
        - Historique des UG reçues par commande
        - UG actuellement en stock (via StockLot)
        
        QueryParams:
        - produit_id: Product ID (required)
        """
        produit_id = request.query_params.get('produit_id')
        
        if not produit_id:
            return Response(
                {'error': 'produit_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all stock lots for this product with free units
        lots = StockLot.objects.filter(
            produit_id=produit_id,
            quantity_free__gt=0
        ).select_related(
            'fournisseur',
            'commande_produit__commande'
        ).order_by('-date_reception')
        
        historique = []
        ug_en_stock = 0
        
        for lot in lots:
            # Calculate how many UG are still in this lot
            if lot.quantity_remaining > 0:
                ug_remaining_in_lot = int(
                    (lot.quantity_remaining / lot.quantity_initial) * lot.quantity_free
                )
                ug_en_stock += ug_remaining_in_lot
            else:
                ug_remaining_in_lot = 0
            
            historique.append({
                'commande_id': lot.commande_produit.commande.id,
                'fournisseur': lot.fournisseur.name,
                'date_reception': lot.date_reception,
                'ug_recues': lot.quantity_free,
                'ug_restantes': ug_remaining_in_lot,
                'lot_numero': lot.lot,
                'date_expiration': lot.date_expiration
            })
        
        total_ug_recues = lots.aggregate(
            total=Sum('quantity_free')
        )['total'] or 0
        
        return Response({
            'produit_id': produit_id,
            'total_ug_recues': int(total_ug_recues),
            'ug_en_stock': ug_en_stock,
            'ug_vendues': int(total_ug_recues) - ug_en_stock,
            'historique': historique
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_summary(self, request):
        """
        Résumé rapide pour le dashboard:
        - Total UG en stock
        - Total UG reçues ce mois
        - Valeur totale économisée
        """
        from datetime import datetime, timedelta
        from django.utils import timezone
        
        # Current month
        now = timezone.now()
        debut_mois = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Total UG en stock (approximation)
        total_ug_stock = StockLot.objects.filter(
            quantity_remaining__gt=0
        ).aggregate(
            total=Sum(
                F('quantity_remaining') * F('quantity_free') / F('quantity_initial'),
                output_field=DecimalField()
            )
        )['total'] or 0
        
        # UG reçues ce mois
        ug_mois = CommandeProduit.objects.filter(
            created_at__gte=debut_mois,
            unites_gratuites__gt=0
        ).aggregate(
            total=Sum('unites_gratuites')
        )['total'] or 0
        
        # Valeur économisée (total)
        valeur_economisee = StockLot.objects.aggregate(
            total=Sum(
                F('quantity_free') * F('price_cost'),
                output_field=DecimalField()
            )
        )['total'] or 0
        
        return Response({
            'ug_en_stock': int(total_ug_stock),
            'ug_recues_mois': int(ug_mois),
            'valeur_economisee': float(valeur_economisee),
            'periode': {
                'debut': debut_mois.isoformat(),
                'fin': now.isoformat()
            }
        })
