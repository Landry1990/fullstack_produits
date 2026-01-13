from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField
from django.db.models.functions import TruncDay, TruncMonth, Coalesce
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from ..models import Facture, Commande, Produit, Client, StockLot, Caisse

class DashboardViewSet(viewsets.ViewSet):
    """
    ViewSet for Dashboard statistics and charts.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        
        # 1. Total Chiffre d'Affaires (Mois en cours)
        ca_mensuel = Facture.objects.filter(
            date__gte=start_of_month,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Sum('total_ttc'))['total'] or 0
        
        # 2. Total Commandes (Mois en cours)
        achats_mensuel = Commande.objects.filter(
            date__gte=start_of_month,
            status=Commande.Status.CLOTUREE
        ).aggregate(
            total=Sum(F('produits__quantity') * F('produits__price'), output_field=DecimalField())
        )['total'] or 0
        
        # 3. Nombre de ventes aujourd'hui
        ventes_jour = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).count()
        
        # 4. Stock critique (produits en dessous du seuil min)
        stock_critique = Produit.objects.filter(stock__lte=F('stock_minimum')).count()
        
        return Response({
            'ca_mensuel': ca_mensuel,
            'achats_mensuel': achats_mensuel,
            'ventes_jour': ventes_jour,
            'stock_critique': stock_critique
        })

    @action(detail=False, methods=['get'])
    def recent_transactions(self, request):
        """Returns recent sales and orders."""
        recent_sales = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).select_related('client').order_by('-date')[:5]
        
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

    @action(detail=False, methods=['get'])
    def revenue_chart(self, request):
        """Returns daily revenue for the last 30 days."""
        end_date = timezone.now()
        start_date = end_date - timedelta(days=30)
        
        daily_revenue = Facture.objects.filter(
            date__range=(start_date, end_date),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            day=TruncDay('date')
        ).values('day').annotate(
            total=Sum('total_ttc')
        ).order_by('day')
        
        chart_data = []
        current_date = start_date.date()
        revenue_map = {item['day'].date(): item['total'] for item in daily_revenue}
        
        while current_date <= end_date.date():
            chart_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'revenue': revenue_map.get(current_date, 0)
            })
            current_date += timedelta(days=1)
            
        return Response(chart_data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Returns top 5 products with lowest stock relative to minimum."""
        products = Produit.objects.filter(
            stock__lte=F('stock_minimum')
        ).order_by('stock')[:10]
        
        data = [{
            'id': p.id,
            'name': p.name,
            'stock': p.stock,
            'min_stock': p.stock_minimum,
            'status': 'Rupture' if p.stock <= 0 else 'Critique'
        } for p in products]
        
        return Response(data)

    @action(detail=False, methods=['get'])
    def clients_depassement(self, request):
        """
        Retourne la liste des clients professionnels ayant dépassé leur plafond de crédit.
        Utilisé pour les alertes du tableau de bord.
        """
        clients = Client.objects.filter(
            client_type='PROFESSIONNEL',
            plafond__gt=0
        )
        
        alert_clients = []
        for client in clients:
            if client.current_debt > client.plafond:
                alert_clients.append({
                    'id': client.id,
                    'name': client.name,
                    'current_debt': client.current_debt,
                    'plafond': client.plafond,
                    'percent': (client.current_debt / client.plafond) * 100
                })
        
        # Sort by highest percentage/severity
        alert_clients.sort(key=lambda x: x['percent'], reverse=True)
        
        return Response(alert_clients)


class StatistiquesViewSet(viewsets.ViewSet):
    """
    ViewSet pour les statistiques avancées.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def ca_par_fournisseur(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Filtre sur les factures (ventes)
        filters = Q(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
        if start_date:
            filters &= Q(date__gte=start_date)
        if end_date:
            filters &= Q(date__lte=end_date)
            
        # On doit passer par les produits vendus -> LigneFacture -> Produit -> Fournisseur
        # Attention : FactureProduitAllocation permet de savoir exactement quel lot (et donc fournisseur) a été vendu
        # Mais pour simplifier et si l'allocation n'est pas stricte, on utilise le fournisseur par défaut du produit
        
        # Méthode précise via FactureProduitAllocation (si utilisé)
        # Allocations
        from ..models import FactureProduitAllocation
        
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        if start_date:
            allocations = allocations.filter(facture_produit__facture__date__gte=start_date)
        if end_date:
            allocations = allocations.filter(facture_produit__facture__date__lte=end_date)
            
        stats = allocations.values(
            'stock_lot__fournisseur__name'
        ).annotate(
            ca=Sum(F('quantity') * F('selling_price'), output_field=DecimalField()),
            marge=Sum((F('selling_price') - F('cost_price')) * F('quantity'), output_field=DecimalField())
        ).order_by('-ca')
        
        data = [
            {
                'fournisseur': item['stock_lot__fournisseur__name'] or 'Inconnu',
                'ca_total': item['ca'],
                'marge_totale': item['marge']
            }
            for item in stats
        ]
        
        return Response(data)
