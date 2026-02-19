from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, Value
from django.db.models.functions import TruncDay, TruncMonth, Coalesce
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from ..models import Facture, Commande, Produit, Client, StockLot, Caisse, ObjectifCommercial

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
        # Optimization: Use DB aggregation instead of iterating all invoices
        from django.db.models import Case, When, Value
        
        # Calculate sum of payments for each invoice
        # Only validated invoices, not fully paid? 
        # Actually we check all VALIDEE/PAYEE because partial payment is possible on PAYEE? No usually Validée.
        
        # Aggregation of invoices that have remaining amount > 0
        # We assume 'reste_a_payer' is not stored on Facture, so we calculate it.
        # Total = total_ttc
        # Paid = Sum(paiements) where status='completee' and mode != 'en_compte'
        
        receivables_agg = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Decimal('0')
            ),
            remaining=F('total_ttc') - F('paid_amount')
        ).filter(
            remaining__gt=0.5 # Filter dust
        ).aggregate(
            total_debt=Coalesce(Sum('remaining'), Decimal('0')),
            count=Count('id')
        )
        
        receivables_data = {'total_debt': receivables_agg['total_debt'], 'count': receivables_agg['count']}
        
        # 5. Discount (Remises accordées AUJOURD'HUI)
        discount_total = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('remise'), Decimal('0')))['total']
        
        # 6. Stock value (Valeur totale du stock au PMP)
        stock_agg = Produit.objects.filter(stock__gt=0).aggregate(
            total=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Decimal('0')),
            count=Count('id')
        )
        stock_value = stock_agg['total']
        stock_count = stock_agg['count']

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
        
        # Superusers and staff always get full access
        if request.user.is_superuser or request.user.is_staff:
            role = 'PHARMACIEN'
            
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
                'stock_value': {'value': float(stock_value), 'count': stock_count}
            })
            
        return Response(response_data)

    @action(detail=False, methods=['get'])
    def manager_stats(self, request):
        """
        Calculates KPIs for Manager Dashboard: Actual vs Targets and Alerts.
        """
        # Role check
        role = getattr(request.user, 'profile', None).role if hasattr(request.user, 'profile') else None
        if role in ['VENDEUR', 'CAISSIER'] and not request.user.is_superuser:
            return Response({"error": "Accès non autorisé"}, status=status.HTTP_403_FORBIDDEN)

        # 1. Basic dates
        now = timezone.now()
        today = now.date()
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        
        # 2. Daily Performance
        ca_jour = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('total_ttc'), Decimal('0')))['total']
        
        obj_jour_model = ObjectifCommercial.get_objectif_actuel(ObjectifCommercial.Periode.JOUR)
        obj_jour = obj_jour_model.ca_objectif if obj_jour_model else Decimal('0')
        taux_jour = float((ca_jour / obj_jour) * 100) if obj_jour > 0 else 0
        
        # 3. Weekly Performance
        ca_semaine = Facture.objects.filter(
            date__date__gte=start_of_week,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('total_ttc'), Decimal('0')))['total']
        
        obj_sem_model = ObjectifCommercial.get_objectif_actuel(ObjectifCommercial.Periode.SEMAINE)
        obj_sem = obj_sem_model.ca_objectif if obj_sem_model else Decimal('0')
        taux_sem = float((ca_sem / obj_sem) * 100) if obj_sem > 0 else 0
        
        # 4. Monthly Performance
        ca_mois = Facture.objects.filter(
            date__date__gte=start_of_month,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Coalesce(Sum('total_ttc'), Decimal('0')))['total']
        
        obj_mois_model = ObjectifCommercial.get_objectif_actuel(ObjectifCommercial.Periode.MOIS)
        obj_mois = obj_mois_model.ca_objectif if obj_mois_model else Decimal('0')
        taux_mois = float((ca_mois / obj_mois) * 100) if obj_mois > 0 else 0
        
        # 5. Smart Alerts
        alerts = []
        
        # Performance Alert (if CA < 70% of target after 14h)
        day_actual = ca_jour # Use the already calculated ca_jour
        day_target = obj_jour # Use the already calculated obj_jour
        if day_target > 0 and now.hour >= 14:
            rate = (float(day_actual) / float(day_target)) * 100
            if rate < 70:
                alerts.append({
                    'type': 'danger',
                    'title_key': 'manager_dashboard.alerts.perf_title',
                    'message_key': 'manager_dashboard.alerts.perf_msg',
                    'params': {'rate': round(rate)}
                })
        
        # Stock Alert (Critical shortages)
        # Only count products that HAVE a minimum stock defined (> 0)
        shortages = Produit.objects.filter(
            stock__lte=F('stock_minimum'), 
            stock_minimum__gt=0,
            is_active=True
        ).count()
        if shortages > 10:
            alerts.append({
                'type': 'warning',
                'title_key': 'manager_dashboard.alerts.shortage_title',
                'message_key': 'manager_dashboard.alerts.shortage_msg',
                'params': {'count': shortages}
            })

        # --- IMPORTANT DEBTORS ALERT ---
        # Find clients with significant debt (> 100k)
        debt_threshold = Decimal('100000.00')
        clients_with_debt = Client.objects.filter(is_active=True).annotate(
            paid_amount=Coalesce(
                Sum('facture__paiements__montant', filter=Q(facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], facture__paiements__statut='completee') & ~Q(facture__paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            total_billed=Coalesce(
                Sum('facture__total_ttc', filter=Q(facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])),
                Value(0, output_field=DecimalField())
            )
        ).annotate(
            calculated_debt=F('total_billed') - F('paid_amount')
        ).filter(calculated_debt__gt=debt_threshold).exclude(name__icontains='DIVERS').order_by('-calculated_debt')[:5]

        if clients_with_debt.exists():
            count = clients_with_debt.count()
            top_client = clients_with_debt[0]
            alerts.append({
                'type': 'danger',
                'title_key': 'manager_dashboard.alerts.debt_title',
                'message_key': 'manager_dashboard.alerts.debt_msg',
                'params': {
                    'count': count, 
                    'threshold': int(debt_threshold),
                    'top_name': top_client.name,
                    'top_debt': int(top_client.calculated_debt)
                }
            })

        # --- DORMANT STOCKS ALERT ---
        # Products with stock > 0 and no sales in last 90 days
        limit_date = today - timedelta(days=90)
        dormant_count = Produit.objects.filter(
            stock__gt=0,
            is_active=True
        ).exclude(
            factureproduit__facture__date__date__gte=limit_date,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).count()

        if dormant_count > 0:
            alerts.append({
                'type': 'warning',
                'title_key': 'manager_dashboard.alerts.dormant_title',
                'message_key': 'manager_dashboard.alerts.dormant_msg',
                'params': {'count': dormant_count, 'days': 90}
            })

        # Week over Week Performance Drop (Compare strictly same days so far)
        # e.g. If today is Tuesday, compare Mon-Tue this week vs Mon-Tue last week
        last_week_start = today - timedelta(days=7 + today.weekday()) # Last Monday
        current_week_start = today - timedelta(days=today.weekday()) # This Monday
        
        # Calculate how many days have passed this week (0=Mon, 1=Tue, ...)
        days_passed = (today - current_week_start).days
        
        # Limit Last Week to same number of days
        last_week_limit = last_week_start + timedelta(days=days_passed + 1)
        
        last_week_partial_ca = Facture.objects.filter(
            date__date__gte=last_week_start,
            date__date__lt=last_week_limit,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca']
        
        current_week_ca = Facture.objects.filter(
            date__date__gte=current_week_start,
            date__date__lte=today, # Include today explicitly
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca']
        
        # Only alert if we have enough history to compare and significant drop
        if last_week_partial_ca > 0 and current_week_ca < last_week_partial_ca * Decimal('0.7'):
             alerts.append({
                'type': 'warning',
                'title_key': 'manager_dashboard.alerts.drop_title',
                'message_key': 'manager_dashboard.alerts.drop_msg',
                'params': {}
            })

        return Response({
            'kpis': {
                'jour': {'actual': float(ca_jour), 'target': float(obj_jour), 'rate': taux_jour},
                'semaine': {'actual': float(ca_semaine), 'target': float(obj_sem), 'rate': taux_sem},
                'mois': {'actual': float(ca_mois), 'target': float(obj_mois), 'rate': taux_mois},
            },
            'alerts': alerts
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
    def hourly_traffic(self, request):
        """Returns average hourly traffic (number of sales) over the last 30 days."""
        from django.db.models.functions import ExtractHour
        
        today = timezone.now().date()
        date_30_days_ago = today - timedelta(days=30)
        
        # Get sales for last 30 days grouped by hour
        sales_by_hour = Facture.objects.filter(
            date__date__gte=date_30_days_ago,
            date__date__lte=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            hour=ExtractHour('date')
        ).values('hour').annotate(
            count=Count('id'),
            total=Sum('total_ttc')
        ).order_by('hour')
        
        # Initialize 24h data
        traffic_data = {h: {'count': 0, 'total': 0} for h in range(24)}
        
        days_count = 30 # Fixed 30-day window average
        
        # Fill with actual data
        for item in sales_by_hour:
            hour = item['hour']
            traffic_data[hour] = {
                'count': float(item['count']) / days_count, # Average per day
                'total': float(item['total'] or 0) / days_count # Average revenue per day
            }
            
        # Format for frontend
        response_data = [
            {
                'hour': f"{h:02d}h",
                'sales_count': round(traffic_data[h]['count'], 2),
                'revenue': round(traffic_data[h]['total'], 2)
            }
            for h in range(24)
        ]
        
        return Response(response_data)

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
        ).exclude(name__icontains='DIVERS')
        
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
        
        # We calculate debt via annotation to avoid N+1 queries
        # Debt = Sum(Commandes.total WHERE status=CLOT) - Sum(Paiements.montant)
        
        from django.db.models import Sum, F, DecimalField, OuterRef, Subquery, Value
        from django.db.models.functions import Coalesce
        from ..models import CommandeProduit, PaiementFournisseur, Commande

        # Subquery for Total Ordered (Commandes CLOTUREE)
        # Sum of (quantity * price) for all lines in CLOT orders
        ordered_sub = CommandeProduit.objects.filter(
            commande__status='CLOT',
            commande__fournisseur=OuterRef('pk')
        ).values('commande__fournisseur').annotate(
            total=Sum(F('quantity') * F('price'))
        ).values('total')

        # Subquery for Total Paid
        paid_sub = PaiementFournisseur.objects.filter(
            fournisseur=OuterRef('pk')
        ).values('fournisseur').annotate(
            total=Sum('montant')
        ).values('total')

        # Annotate suppliers with calculations
        suppliers = Fournisseur.objects.annotate(
            total_ordered_db=Coalesce(Subquery(ordered_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
            total_paid_db=Coalesce(Subquery(paid_sub, output_field=DecimalField()), Value(0, output_field=DecimalField()))
        ).annotate(
            debt_db=F('total_ordered_db') - F('total_paid_db')
        ).filter(
            debt_db__gt=0
        ).order_by('-debt_db')
        
        data = []
        total_debt_global = Decimal('0.00')
        
        for s in suppliers:
            debt = s.debt_db
            total_debt_global += debt
            
            data.append({
                'id': s.id,
                'name': s.name,
                'debt': float(debt),
                'phone': s.phone
            })
        
        return Response({
            'total_debt': float(total_debt_global),
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
