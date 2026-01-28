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
        
        # 3. Low stock count (products with <= 15 days coverage based on monthly rotation)
        # days_remaining = stock / (rotation_moyenne / 30)
        # <= 15 days means: stock / (rotation / 30) <= 15 => stock * 30 / rotation <= 15 => stock <= rotation * 15 / 30 => stock <= rotation * 0.5
        from django.db.models.functions import Cast
        from django.db.models import FloatField
        
        stock_critique = Produit.objects.filter(
            rotation_moyenne__gt=0  # Exclure produits dormants
        ).annotate(
            days_remaining=Cast(F('stock'), FloatField()) / (Cast(F('rotation_moyenne'), FloatField()) / 30.0)
        ).filter(
            Q(days_remaining__lte=15) | Q(stock__lte=0) | Q(stock__lte=F('stock_minimum'))
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
        # 6. Stock value (Valeur totale du stock au PMP)
        stock_value = Produit.objects.aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal('0'))
        )['total']

        # 7. User specific stats (My Daily Stats - for Seller motivation)
        user_daily_invoices = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            created_by=request.user
        )
        
        user_ca_today = user_daily_invoices.aggregate(total=Coalesce(Sum('total_ttc'), Decimal('0')))['total']
        user_sales_count = user_daily_invoices.count()
        user_avg_basket = Decimal('0')
        if user_sales_count > 0:
            user_avg_basket = user_ca_today / user_sales_count
        
        # Determine Role
        role = 'PHARMACIEN' # Default fallback
        try:
            if hasattr(request.user, 'profile'):
                role = request.user.profile.role
        except Exception:
            pass
            
        # Base response
        response_data = {
            'role': role,
            'user_stats': {
                'sales': float(user_ca_today),
                'count': user_sales_count,
                'avg_basket': float(user_avg_basket)
            }
        }
        
        # If Admin/Pharmacist, add full global stats
        # If Seller/Cashier, we limit the data (privacy/focus)
        if role not in ['VENDEUR', 'CAISSIER']:
            response_data.update({
                'revenue': {'value': float(ca_today), 'change': revenue_change},
                'sales': {'value': sales_today, 'change': sales_change},
                'clients': {'value': Client.objects.count(), 'change': 0},
                'low_stock': {'value': stock_critique, 'change': 0},
                'receivables': {'value': float(receivables_data['total_debt'] or 0), 'count': receivables_data['count'] or 0},
                'discount': {'value': float(discount_total), 'change': 0},
                'stock_value': {'value': float(stock_value), 'change': 0}
            })
            
        return Response(response_data)

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
        """
        Returns top 10 products with lowest coverage (Days Remaining).
        Coverage = Stock / (rotation_moyenne / 30) = Stock * 30 / rotation_moyenne
        NOTE: rotation_moyenne is MONTHLY (units sold per month), so we divide by 30 to get daily rate.
        Includes products already out of stock (Coverage = 0).
        """
        from django.db.models.functions import Cast
        from django.db.models import FloatField
        
        # Avoid division by zero: only take products with moving stock (rotation > 0)
        # days_remaining = stock / (rotation_moyenne / 30) = stock * 30 / rotation_moyenne
        products = Produit.objects.filter(
            rotation_moyenne__gt=0
        ).annotate(
            daily_rotation=Cast(F('rotation_moyenne'), FloatField()) / 30.0,
            days_remaining=Cast(F('stock'), FloatField()) / (Cast(F('rotation_moyenne'), FloatField()) / 30.0)
        ).filter(
            Q(days_remaining__lte=15) | Q(stock__lte=0)  # Alert if <= 15 days coverage
        ).order_by('days_remaining')[:10]
        
        data = []
        for p in products:
            days = 0
            if p.stock > 0 and p.rotation_moyenne > 0:
                # Convert monthly rotation to daily: rotation_moyenne / 30
                daily_rotation = float(p.rotation_moyenne) / 30.0
                days = round(p.stock / daily_rotation, 1) if daily_rotation > 0 else 0
            
            status = 'Rupture'
            if p.stock > 0:
                if days <= 3:
                    status = 'Rupture imminente'
                elif days <= 7:
                    status = f'Critique ({days}j)'
                else:
                    status = f'~{int(days)}j de stock'

            data.append({
                'id': p.id,
                'name': p.name,
                'stock': p.stock,
                'min_stock': p.stock_minimum,
                'rotation': float(p.rotation_moyenne),
                'rotation_daily': round(float(p.rotation_moyenne) / 30.0, 2),
                'days_remaining': days,
                'status': status
            })
        
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


    @action(detail=False, methods=['get'])
    def supplier_debts(self, request):
        """
        Returns processed debt data for suppliers.
        Calculates solde_dette for each supplier and returns those with positive debt.
        """
        from ..models import Fournisseur
        
        # We need to fetch all providers and calculate debt in python
        # because solde_dette is a property that does logic on related sets
        fournisseurs = Fournisseur.objects.all().prefetch_related(
            'commande_set', 
            'paiements_effectues'
        )
        
        data = []
        total_debt = Decimal('0.00')
        
        for f in fournisseurs:
            debt = f.solde_dette
            if debt > 0:
                total_debt += debt
                data.append({
                    'id': f.id,
                    'name': f.name,
                    'debt': float(debt),
                    'phone': f.phone
                })
                
        # Sort by highest debt
        data.sort(key=lambda x: x['debt'], reverse=True)
        
        return Response({
            'total_debt': float(total_debt),
            'suppliers': data
        })


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

    @action(detail=False, methods=['get'])
    def cancel_alerts(self, request):
        """
        Retourne la liste des utilisateurs ayant annulé plus de X factures
        sur une période donnée.
        """
        from ..models import AuditLog, User
        
        threshold = int(request.query_params.get('threshold', 5))
        days = int(request.query_params.get('days', 30))
        
        start_date = timezone.now() - timedelta(days=days)
        
        # Compter les annulations par utilisateur
        cancellations = AuditLog.objects.filter(
            action=AuditLog.Action.INVOICE_CANCEL,
            timestamp__gte=start_date
        ).values('user').annotate(
            count=Count('id')
        ).filter(count__gte=threshold).order_by('-count')
        
        results = []
        for c in cancellations:
            user_id = c['user']
            if not user_id:
                name = "Système / Inconnu"
            else:
                try:
                    u = User.objects.get(pk=user_id)
                    name = u.get_full_name() or u.username
                except User.DoesNotExist:
                    name = f"Utilisateur #{user_id}"
            
            # Note: total_amount might need cleaner extraction depending on DB/Django version JSONField support
            # For now returning count is the MVP
            results.append({
                'Utilisateur': name,
                'Nombre Annulations': c['count'],
                'Période (jours)': days,
                'Seuil': threshold
            })
            
        return Response(results)
