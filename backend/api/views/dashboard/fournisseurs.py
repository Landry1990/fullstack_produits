from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    OuterRef,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ...models import (
    Commande,
)


class DashboardFournisseursMixin(viewsets.ViewSet):
    
    @action(detail=False, methods=['get'])
    def supplier_debts(self, request):
        """
        Returns detailed debt data for suppliers.
        For FACTURE type: returns individual invoices with due date status.
        For RELEVE type: returns grouped releves by period with due date status.
        """
        # Cache: 2 min pour les dettes fournisseurs
        cache_key = f"supplier_debts:{request.user.id}:{request.query_params.get('limit', '50')}:{request.query_params.get('offset', '0')}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        from collections import defaultdict
        from datetime import date

        from django.db.models import Subquery

        from ...models import CommandeProduit, Fournisseur, PaiementFournisseur
    
        today = date.today()
    
        # Optimize: Fetch all suppliers with annotated debt in ONE query
        # Use simpler subqueries without extra values() if possible
        commandes_total = CommandeProduit.objects.filter(
            commande__fournisseur=OuterRef('pk'),
            commande__status=Commande.Status.CLOTUREE,
            commande__is_active=True
        ).order_by().values('commande__fournisseur').annotate(
            total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
        ).values('total')
    
        paiements_total = PaiementFournisseur.objects.filter(
            fournisseur=OuterRef('pk')
        ).order_by().values('fournisseur').annotate(
            total=Sum('montant', output_field=DecimalField())
        ).values('total')
    
        suppliers_qs = Fournisseur.objects.filter(is_active=True).annotate(
            total_du_annotated=Coalesce(Subquery(commandes_total[:1]), Value(0, output_field=DecimalField())),
            total_paye_annotated=Coalesce(Subquery(paiements_total[:1]), Value(0, output_field=DecimalField()))
        ).annotate(
            solde_dette_annotated=ExpressionWrapper(
                F('total_du_annotated') - F('total_paye_annotated'),
                output_field=DecimalField()
            )
        ).filter(solde_dette_annotated__gt=0)
    
        data = []
        total_debt_global = Decimal('0.00')
    
        # Charger les totaux par commande (quantité × prix)
        order_total_sub = CommandeProduit.objects.filter(
            commande=OuterRef('pk')
        ).values('commande').annotate(
            total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
        ).values('total')
    
        all_orders = Commande.objects.filter(
            fournisseur__in=suppliers_qs,
            status=Commande.Status.CLOTUREE,
            is_active=True
        ).annotate(
            total_annotated=Coalesce(Subquery(order_total_sub[:1]), Value(0, output_field=DecimalField())),
        ).order_by('date_cloture')
    
        # Charger TOUS les paiements fournisseurs (globaux + liés à commande)
        # groupés par fournisseur_id → montant total payé réel
        all_payments = PaiementFournisseur.objects.filter(
            fournisseur__in=suppliers_qs
        ).values('fournisseur_id').annotate(
            total=Sum('montant', output_field=DecimalField())
        )
        payments_by_supplier = {row['fournisseur_id']: row['total'] or Decimal('0.00') for row in all_payments}
    
        # Grouper les commandes par fournisseur
        orders_by_supplier = defaultdict(list)
        for order in all_orders:
            orders_by_supplier[order.fournisseur_id].append(order)
    
        for supplier in suppliers_qs:
            total_debt_global += supplier.solde_dette_annotated
            orders = orders_by_supplier[supplier.id]
    
            supplier_items = []
    
            # Répartition FIFO des paiements globaux sur les commandes (du plus ancien au plus récent).
            # Cela gère correctement les réglements sans FK commande (champ déprécié).
            budget_restant = payments_by_supplier.get(supplier.id, Decimal('0.00'))
            remainings: dict[int, Decimal] = {}
            for order in orders:
                order_total = order.total_annotated
                applique = min(budget_restant, order_total)
                remainings[order.id] = order_total - applique
                budget_restant -= applique
    
            if supplier.type_reglement == 'FACTURE':
                # Individual invoices
                for order in orders:
                    remaining = remainings.get(order.id, order.total_annotated)
    
                    if remaining > 0:
                        # Calculate due date
                        due_date = order.date_echeance
                        if not due_date:
                            # Fallback: use order closure date + payment delay
                            base_date = order.date_cloture.date() if order.date_cloture else order.date.date()
                            due_date = base_date + timedelta(days=supplier.delai_paiement_jours)
    
                        is_overdue = due_date < today
                        days_diff = (today - due_date).days
    
                        supplier_items.append({
                            'id': order.id,
                            'type': 'FACTURE',
                            'label': order.numero_facture or f'Cmd #{order.id}',
                            'amount': float(remaining),
                            'due_date': due_date.isoformat(),
                            'is_overdue': is_overdue,
                            'days_overdue': days_diff if is_overdue else None,
                            'days_remaining': -days_diff if not is_overdue else None,
                        })
    
            else:  # RELEVE
                # Group by releve periods
                period_days = supplier.periode_releve_jours or 10
                from typing import Any
                periods: dict[str, dict[str, Any]] = {}
    
                for order in orders:
                    remaining = remainings.get(order.id, order.total_annotated)
    
                    if remaining > 0:
                        # Determine period based on order date
                        order_date = order.date.date()
                        # Calculate period start (e.g., for 10-day periods: 1-10, 11-20, 21-31)
                        day = order_date.day
                        period_index = (day - 1) // period_days
                        period_start = order_date.replace(day=period_index * period_days + 1)
                        period_end = min(
                            period_start + timedelta(days=period_days - 1),
                            order_date.replace(day=1) + timedelta(days=32)
                        )
                        period_key = period_start.isoformat()
    
                        if period_key not in periods:
                            periods[period_key] = {'orders': [], 'total': Decimal('0.00')}
                        periods[period_key]['orders'].append(order)
                        periods[period_key]['total'] += remaining
    
                # Create items for each period
                for period_key in sorted(periods.keys(), reverse=True):
                    period_data = periods[period_key]
                    period_total: Decimal = period_data['total']
                    period_data['orders']
    
                    if period_total > 0:
                        period_start = date.fromisoformat(period_key)
                        period_end = period_start + timedelta(days=period_days - 1)
    
                        # Due date = period end + payment delay
                        due_date = period_end + timedelta(days=supplier.delai_paiement_jours)
    
                        is_overdue = due_date < today
                        days_diff = (today - due_date).days
    
                        # Get order IDs for this period
                        order_ids = [o.id for o in period_data['orders']]
    
                        supplier_items.append({
                            'id': f'{supplier.id}_{period_key}',
                            'type': 'RELEVE',
                            'label': f'{period_start.day}-{min(period_end.day, 31)}/{period_start.month:02d}',
                            'amount': float(period_total),
                            'due_date': due_date.isoformat(),
                            'is_overdue': is_overdue,
                            'days_overdue': days_diff if is_overdue else None,
                            'days_remaining': -days_diff if not is_overdue else None,
                            'order_ids': order_ids,
                        })
    
            # Sort items: overdue first, then by due date
            supplier_items.sort(key=lambda x: (not x['is_overdue'], x['due_date']))
    
            if supplier_items:
    
                data.append({
                    'id': supplier.id,
                    'name': supplier.name,
                    'phone': supplier.phone,
                    'type_reglement': supplier.type_reglement,
                    'delai_paiement_jours': supplier.delai_paiement_jours,
                    'periode_releve_jours': supplier.periode_releve_jours,
                    'debt_total': float(supplier.solde_dette_annotated),
                    'items': supplier_items,
                    'overdue_count': sum(1 for item in supplier_items if item['is_overdue']),
                    'overdue_amount': sum(item['amount'] for item in supplier_items if item['is_overdue']),
                })
    
        # Sort by overdue amount (highest first), then by total debt
        data.sort(key=lambda x: (-x['overdue_amount'], -x['debt_total']))
    
        # Pagination optionnelle pour éviter un payload énorme sur de gros volumes
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        limit = max(1, min(limit, 200))  # plafond 200 par page
        offset = max(0, offset)
        paginated = data[offset:offset + limit]
    
        response_data = {
            'total_debt': float(total_debt_global),
            'total_suppliers': len(data),
            'limit': limit,
            'offset': offset,
            'suppliers': paginated
        }
        cache.set(cache_key, response_data, 120)  # 2 min
        return Response(response_data)
    
