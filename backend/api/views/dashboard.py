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
        yesterday = today - timedelta(days=1)
        start_of_month = today.replace(day=1)
        
        # 1. Revenue (Chiffre d'Affaires) - Today and change vs yesterday
        ca_today = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('total_ttc'), Decimal('0')))['total']
        
        ca_yesterday = Facture.objects.filter(
            date__date=yesterday,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('total_ttc'), Decimal('0')))['total']
        
        revenue_change = 0
        if ca_yesterday and ca_yesterday > 0:
            revenue_change = round(((ca_today - ca_yesterday) / ca_yesterday) * 100, 1)
        
        # 2. Sales count (Number of invoices today)
        sales_today = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).count()
        
        sales_yesterday = Facture.objects.filter(
            date__date=yesterday,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).count()
        
        sales_change = 0
        if sales_yesterday > 0:
            sales_change = round(((sales_today - sales_yesterday) / sales_yesterday) * 100, 1)
        
        # 3. Low stock count (only products with rotation > 0)
        stock_critique = Produit.objects.filter(
            Q(stock__lt=F('rotation_moyenne')) |
            Q(stock__lte=F('stock_minimum')),
            rotation_moyenne__gt=0  # Exclure produits dormants
        ).count()
        
        # 4. Receivables (Créances Clients) - Total unpaid amounts on validated invoices
        # Aligned with rapport_mensuel calculation - iterate through each invoice
        factures_for_receivables = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('paiements')
        
        total_receivables = Decimal('0')
        count_unpaid = 0
        for f in factures_for_receivables:
            # Sum of real payments (exclude 'en_compte', include only 'completee')
            paye = f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            reste = f.total_ttc - paye
            if reste > 0:
                total_receivables += reste
                count_unpaid += 1
        
        receivables_data = {'total_debt': total_receivables, 'count': count_unpaid}
        
        # 5. Discount (Remises accordées AUJOURD'HUI)
        discount_total = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('remise'), Decimal('0')))['total']
        
        # 6. Stock value (Valeur totale du stock au PMP)
        stock_value = Produit.objects.aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']
        
        return Response({
            'revenue': {'value': float(ca_today), 'change': revenue_change},
            'sales': {'value': sales_today, 'change': sales_change},
            'clients': {'value': Client.objects.count(), 'change': 0},
            'low_stock': {'value': stock_critique, 'change': 0},
            'receivables': {'value': float(receivables_data['total_debt'] or 0), 'count': receivables_data['count'] or 0},
            'discount': {'value': float(discount_total), 'change': 0},
            'stock_value': {'value': float(stock_value), 'change': 0}
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
        """Returns daily revenue for the last 7 days in format expected by frontend."""
        end_date = timezone.now()
        start_date = end_date - timedelta(days=6)  # 7 days including today
        
        daily_revenue = Facture.objects.filter(
            date__date__gte=start_date.date(),
            date__date__lte=end_date.date(),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            day=TruncDay('date')
        ).values('day').annotate(
            total=Coalesce(Sum('total_ttc'), Decimal('0'))
        ).order_by('day')
        
        # Build the data structure expected by frontend
        labels = []
        data = []
        current_date = start_date.date()
        revenue_map = {item['day'].date(): float(item['total']) for item in daily_revenue}
        
        # French day names
        day_names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        
        while current_date <= end_date.date():
            labels.append(day_names[current_date.weekday()])
            data.append(revenue_map.get(current_date, 0))
            current_date += timedelta(days=1)
            
        return Response({
            'labels': labels,
            'data': data
        })

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Returns top 10 products with lowest stock relative to minimum (only active products)."""
        products = Produit.objects.filter(
            stock__lte=F('stock_minimum'),
            rotation_moyenne__gt=0  # Exclure produits dormants sans rotation
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
        # Support both param naming conventions
        start_date = request.query_params.get('date_debut') or request.query_params.get('start_date')
        end_date = request.query_params.get('date_fin') or request.query_params.get('end_date')
        
        # Méthode via FactureProduitAllocation pour traçabilité FIFO
        from ..models import FactureProduitAllocation
        
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).select_related('stock_lot__fournisseur')
        
        if start_date:
            allocations = allocations.filter(facture_produit__facture__date__gte=start_date)
        if end_date:
            allocations = allocations.filter(facture_produit__facture__date__lte=end_date)
            
        stats = allocations.values(
            'stock_lot__fournisseur__id',
            'stock_lot__fournisseur__name'
        ).annotate(
            ca_ttc=Sum(F('quantity') * F('selling_price'), output_field=DecimalField()),
            cout_achat=Sum(F('quantity') * F('cost_price'), output_field=DecimalField()),
            marge_brute=Sum((F('selling_price') - F('cost_price')) * F('quantity'), output_field=DecimalField()),
            quantite_vendue=Sum('quantity')
        ).order_by('-ca_ttc')
        
        data = [
            {
                'id': item['stock_lot__fournisseur__id'] or 0,
                'nom': item['stock_lot__fournisseur__name'] or 'Inconnu',
                'ca_ttc': float(item['ca_ttc'] or 0),
                'cout_achat': float(item['cout_achat'] or 0),
                'marge_brute': float(item['marge_brute'] or 0),
                'quantite_vendue': item['quantite_vendue'] or 0
            }
            for item in stats
        ]
        
        return Response(data)
