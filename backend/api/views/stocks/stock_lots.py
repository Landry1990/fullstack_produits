from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import F, Sum
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from ...models import (
    StockLot, Produit, MouvementStock, StockAdjustment, AuditLog
)
from ...serializers import StockLotSerializer
from ...serializers_optimized import StockLotListSerializer, StockLotDetailSerializer
from ...serializer_mixins import OptimizedSerializerMixin
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode
from ...centralized_configs import (
    BaseViewSetConfig,
    StandardResultsSetPagination
)


class StockLotViewSet(BaseViewSetConfig, OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for stock lots (expiry management) with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with all information
    """
    queryset = StockLot.objects.select_related('produit', 'fournisseur').order_by('date_expiration')
    serializer_class = StockLotSerializer
    filter_backends = (DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ['produit', 'fournisseur']
    ordering_fields = ['date_expiration', 'date_reception']
    
    # Serializers optimisés
    list_serializer_class = StockLotListSerializer
    detail_serializer_class = StockLotDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by expiry date if provided
        date_expiration_lte = self.request.query_params.get('date_expiration_lte')
        if date_expiration_lte:
            qs = qs.filter(date_expiration__lte=date_expiration_lte)
        
        # Filter only positive remaining quantity by default, unless specified
        include_empty = self.request.query_params.get('include_empty', 'false')
        if include_empty.lower() != 'true':
            qs = qs.filter(quantity_remaining__gt=0)
            
        return qs

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def sortir_perimes(self, request, pk=None):
        """
        Sort un lot du stock (destruction/retour).
        Supporte le mode SUDO pour valider par un autre utilisateur.
        """
        lot = StockLot.objects.select_for_update().get(pk=self.kwargs['pk'])
        quantity_to_remove = int(request.data.get('quantity', lot.quantity_remaining))
        reason = request.data.get('reason', 'Périmé')

        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_perimes')
        if error_res:
             return error_res
        # -------------------------

        if quantity_to_remove > lot.quantity_remaining:
            return Response({'detail': 'Quantité insuffisante dans le lot.'}, status=status.HTTP_400_BAD_REQUEST)

        # Capture quantity before for adjustment record
        quantity_before = lot.quantity_remaining

        # Update lot
        lot.quantity_remaining -= quantity_to_remove
        lot.save()

        # Update product stock
        produit = lot.produit
        if produit:
            produit = Produit.objects.select_for_update().get(pk=produit.pk)
            if produit.use_lot_management:
                # Recalculate stock from all lots
                produit.calculate_stock_from_lots()
            else:
                produit.stock = F('stock') - quantity_to_remove
                produit.save(update_fields=['stock'])

            # Refresh to get actual stock value for MouvementStock
            produit.refresh_from_db()

        # Create StockAdjustment for traceability in Adjustment Journal
        StockAdjustment.objects.create(
            produit=produit,
            stock_lot=lot,
            user=validation_user,
            quantity_before=quantity_before,
            quantity_after=lot.quantity_remaining,
            quantity_change=-quantity_to_remove,
            reason_type=StockAdjustment.ReasonType.PERIME,
            reason_detail=f"Sortie périmés: {reason}"
        )
        
        # Create MouvementStock for traceability
        MouvementStock.objects.create(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.AVOIR, # ou AJUSTEMENT ? AVOIR semble utilisé pour "Sortie diverses" ici
            quantite=-quantity_to_remove,
            stock_apres=produit.total_stock if produit else 0,
            user=validation_user, # Utilise le validateur Sudo
            description=f"Sortie périmés - Lot {lot.lot}: {reason}"
        )
        
        # Log Audit
        log_audit(
            user=validation_user, # Utilise le validateur Sudo
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='StockLot',
            object_id=lot.id,
            description=f"Sortie périmés par {validation_user.username}: {quantity_to_remove} unités (Lot {lot.lot})",
            details={
                'produit_id': produit.id if produit else None,
                'produit_nom': produit.name if produit else lot.produit_nom,
                'quantity': -quantity_to_remove,
                'reason': reason,
                'lot': lot.lot,
                'sudo_mode': validation_user != request.user
            },
            request=request
        )

        return Response({'status': f'Lot mis à jour. {quantity_to_remove} unités sorties.', 'validated_by': validation_user.username})

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_sortir_perimes(self, request):
        """
        Sortie groupée de plusieurs lots périmés.
        """
        lot_ids = request.data.get('lot_ids', [])
        reason = request.data.get('reason', 'Sortie groupée périmés')

        if not lot_ids:
            return Response({'detail': 'Aucun lot sélectionné.'}, status=status.HTTP_400_BAD_REQUEST)

        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_perimes')
        if error_res:
             return error_res

        # Lock lots and associated products in deterministic order to avoid deadlocks
        lots = list(StockLot.objects.filter(id__in=lot_ids, quantity_remaining__gt=0).select_for_update().select_related('produit'))
        product_ids = sorted({lot.produit_id for lot in lots if lot.produit_id})
        locked_products = {p.id: p for p in Produit.objects.filter(id__in=product_ids).select_for_update().order_by('id')} if product_ids else {}

        count = 0

        for lot in lots:
            quantity_to_remove = lot.quantity_remaining
            quantity_before = lot.quantity_remaining

            # Update lot
            lot.quantity_remaining = 0
            lot.save()

            # Update product stock
            produit = locked_products.get(lot.produit_id) if lot.produit_id else None
            if produit:
                if produit.use_lot_management:
                    produit.calculate_stock_from_lots()
                else:
                    produit.stock = F('stock') - quantity_to_remove
                    produit.save(update_fields=['stock'])

                produit.refresh_from_db()

            # Traceability
            StockAdjustment.objects.create(
                produit=produit, stock_lot=lot, user=validation_user,
                quantity_before=quantity_before, quantity_after=0,
                quantity_change=-quantity_to_remove,
                reason_type=StockAdjustment.ReasonType.PERIME,
                reason_detail=f"Sortie groupée: {reason}"
            )

            MouvementStock.objects.create(
                produit=produit,
                type_mouvement=MouvementStock.TypeMouvement.AVOIR,
                quantite=-quantity_to_remove,
                stock_apres=produit.total_stock if produit else 0,
                user=validation_user,
                description=f"Sortie groupée périmés - Lot {lot.lot}"
            )

            count += 1
            
        # Global Audit
        log_audit(
            user=validation_user,
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='StockLot',
            object_id=0,
            description=f"Sortie groupée de {count} lots périmés par {validation_user.username}",
            details={'lot_ids': lot_ids, 'reason': reason, 'count': count},
            request=request
        )
        
        return Response({'status': f'{count} lots sortis du stock.', 'validated_by': validation_user.username})

    @action(detail=False, methods=['get'])
    def alerts_expiration(self, request):
        """
        Retourne les alertes de péremption pour notification frontend.
        Inclut les lots expirant dans les X prochains jours avec quantité > 0.
        """
        from django.utils import timezone
        from datetime import timedelta

        # Paramètres configurables
        days_ahead = int(request.query_params.get('days', 30))
        min_quantity = int(request.query_params.get('min_quantity', 1))
        include_critical_only = request.query_params.get('critical_only', 'false').lower() == 'true'

        today = timezone.now().date()
        future_date = today + timedelta(days=days_ahead)
        critical_date = today + timedelta(days=7)

        # Requête de base : lots expirants avec stock restant
        qs = StockLot.objects.filter(
            date_expiration__gt=today,
            date_expiration__lte=future_date,
            quantity_remaining__gte=min_quantity
        ).select_related('produit', 'fournisseur').order_by('date_expiration')

        # Option : seulement les critiques (≤ 7 jours)
        if include_critical_only:
            qs = qs.filter(date_expiration__lte=critical_date)

        alerts = []
        for lot in qs:
            days_until = (lot.date_expiration - today).days

            # Déterminer le niveau d'urgence
            if days_until <= 7:
                level = 'critical'
                level_display = 'CRITIQUE'
            elif days_until <= 14:
                level = 'warning'
                level_display = 'URGENT'
            elif days_until <= 30:
                level = 'notice'
                level_display = 'ATTENTION'
            else:
                level = 'info'
                level_display = 'INFO'

            alerts.append({
                'id': lot.id,
                'produit_id': lot.produit_id,
                'produit_nom': lot.produit_nom or (lot.produit.name if lot.produit else 'Inconnu'),
                'lot_numero': lot.lot,
                'fournisseur_nom': lot.fournisseur_nom or (lot.fournisseur.name if lot.fournisseur else None),
                'quantity_remaining': lot.quantity_remaining,
                'date_expiration': lot.date_expiration.isoformat() if lot.date_expiration else None,
                'days_until': days_until,
                'level': level,
                'level_display': level_display,
                'prix_achat': float(lot.price_cost) if lot.price_cost else 0,
                'prix_vente': float(lot.selling_price) if lot.selling_price else 0,
                'valeur_stock': float(lot.price_cost * lot.quantity_remaining) if lot.price_cost else 0,
            })

        # Statistiques agrégées
        stats = {
            'total_alerts': len(alerts),
            'critical_count': sum(1 for a in alerts if a['level'] == 'critical'),
            'warning_count': sum(1 for a in alerts if a['level'] == 'warning'),
            'notice_count': sum(1 for a in alerts if a['level'] == 'notice'),
            'total_valeur': sum(a['valeur_stock'] for a in alerts),
            'days_checked': days_ahead,
        }

        return Response({
            'alerts': alerts,
            'stats': stats,
            'date_reference': today.isoformat(),
        })

    @action(detail=False, methods=['get'])
    def stats_perimes(self, request):
        """
        Statistiques des produits périmés et à risque d'expiration.
        Retourne:
        - Valeur des lots périmés (pertes financières)
        - Prévisions à 30/60/90 jours
        - Taux de perte vs CA
        """
        from api.models import Facture, FactureProduitAllocation
        from django.db.models import Q
        
        today = timezone.now().date()
        
        # Paramètres de période pour le CA (par défaut: 12 derniers mois)
        periode_jours = int(request.query_params.get('periode_jours', 365))
        date_debut_ca = today - timedelta(days=periode_jours)
        
        # === LOTS DÉJÀ PÉRIMÉS ===
        lots_perimes = StockLot.objects.filter(
            date_expiration__lt=today,
            quantity_remaining__gt=0
        ).select_related('produit')
        
        valeur_perimes_cout = Decimal('0')
        valeur_perimes_vente = Decimal('0')
        count_lots_perimes = 0
        details_perimes = []
        
        for lot in lots_perimes:
            valeur_cout = lot.price_cost * lot.quantity_remaining
            valeur_vente = lot.selling_price * lot.quantity_remaining
            valeur_perimes_cout += valeur_cout
            valeur_perimes_vente += valeur_vente
            count_lots_perimes += 1
            
            details_perimes.append({
                'lot_id': lot.id,
                'produit_id': lot.produit_id,
                'produit_nom': lot.produit_nom or (lot.produit.name if lot.produit else 'Inconnu'),
                'lot_numero': lot.lot,
                'date_expiration': lot.date_expiration.isoformat() if lot.date_expiration else None,
                'quantity': lot.quantity_remaining,
                'valeur_cout': float(valeur_cout),
                'valeur_vente': float(valeur_vente)
            })
        
        # === PRÉVISIONS 30/60/90 JOURS ===
        def calculer_prevision(jours):
            date_limite = today + timedelta(days=jours)
            lots = StockLot.objects.filter(
                date_expiration__gte=today,
                date_expiration__lt=date_limite,
                quantity_remaining__gt=0
            )
            total_cout = Decimal('0')
            total_vente = Decimal('0')
            count = 0
            
            for lot in lots:
                total_cout += lot.price_cost * lot.quantity_remaining
                total_vente += lot.selling_price * lot.quantity_remaining
                count += 1
                
            return {
                'jours': jours,
                'count_lots': count,
                'valeur_cout': float(total_cout),
                'valeur_vente': float(total_vente)
            }
        
        prevision_30j = calculer_prevision(30)
        prevision_60j = calculer_prevision(60)
        prevision_90j = calculer_prevision(90)
        
        # === CALCUL DU CA SUR LA PÉRIODE ===
        # Utilise les factures validées/payées
        factures_periode = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=date_debut_ca
        )
        ca_total = factures_periode.aggregate(
            total=Sum('total_ttc')
        )['total'] or Decimal('0')
        
        # === PERTES HISTORIQUES (via MouvementStock) ===
        # Sorties pour périmés sur la période
        pertes_historiques = MouvementStock.objects.filter(
            type_mouvement=MouvementStock.TypeMouvement.AVOIR,
            description__icontains='périmé',
            date__gte=date_debut_ca
        ).aggregate(
            total_qty=Sum('quantite')
        )['total_qty'] or 0
        
        # === TAUX DE PERTE ===
        taux_perte = Decimal('0')
        if ca_total > 0:
            taux_perte = (valeur_perimes_vente / ca_total) * 100
        
        return Response({
            'date_reference': today.isoformat(),
            'periode_ca_jours': periode_jours,
            
            # Lots actuellement périmés
            'perimes': {
                'count_lots': count_lots_perimes,
                'valeur_cout': float(valeur_perimes_cout),
                'valeur_vente_perdue': float(valeur_perimes_vente),
                'details': details_perimes[:20]  # Limit to 20 for performance
            },
            
            # Prévisions
            'previsions': {
                '30j': prevision_30j,
                '60j': prevision_60j,
                '90j': prevision_90j
            },
            
            # Indicateurs financiers
            'indicateurs': {
                'ca_periode': float(ca_total),
                'taux_perte_pct': round(float(taux_perte), 2),
                'pertes_historiques_qty': abs(pertes_historiques)
            }
        })

    @action(detail=False, methods=['get'])
    def rapport_ug(self, request):
        """
        Rapport des Unités Gratuites (UG) groupées par fournisseur, avec détails par lot.
        """
        try:
            date_debut = request.query_params.get('date_debut')
            date_fin = request.query_params.get('date_fin')

            qs = StockLot.objects.filter(quantity_free__gt=0).select_related('fournisseur', 'produit', 'commande_produit__commande')

            if date_debut:
                qs = qs.filter(date_reception__gte=date_debut)
            if date_fin:
                try:
                    date_fin_obj = datetime.strptime(date_fin, '%Y-%m-%d')
                    date_fin_inclusive = date_fin_obj + timedelta(days=1) - timedelta(seconds=1)
                    qs = qs.filter(date_reception__lte=date_fin_inclusive)
                except ValueError:
                     pass

            lots = list(qs)
            
            fournisseurs_map = {}
            global_total_ug = 0
            global_total_ug_restantes = 0
            global_total_valeur = Decimal('0')
            global_total_valeur_restante = Decimal('0')

            for lot in lots:
                # Priorité au grossiste de la Commande sur le labo du Lot
                f_id = lot.fournisseur_id or 0
                f_name = lot.fournisseur.name if lot.fournisseur else "Fournisseur Inconnu"
                
                if lot.commande_produit and lot.commande_produit.commande and lot.commande_produit.commande.fournisseur:
                    f_id = lot.commande_produit.commande.fournisseur.id
                    f_name = lot.commande_produit.commande.fournisseur.name
                    
                if f_id not in fournisseurs_map:
                    fournisseurs_map[f_id] = {
                        'fournisseur_id': f_id,
                        'fournisseur_nom': f_name,
                        'total_ug': 0,
                        'total_ug_restantes': 0,
                        'total_valeur': Decimal('0'),
                        'total_valeur_restante': Decimal('0'),
                        'lots_count': 0,
                        'details': []
                    }
                
                valeur_estimee = Decimal(lot.quantity_free) * lot.selling_price
                valeur_restante = Decimal(lot.quantity_free_remaining) * lot.selling_price
                
                fournisseurs_map[f_id]['total_ug'] += lot.quantity_free
                fournisseurs_map[f_id]['total_ug_restantes'] += lot.quantity_free_remaining
                fournisseurs_map[f_id]['total_valeur'] += valeur_estimee
                fournisseurs_map[f_id]['total_valeur_restante'] += valeur_restante
                fournisseurs_map[f_id]['lots_count'] += 1
                
                global_total_ug += lot.quantity_free
                global_total_ug_restantes += lot.quantity_free_remaining
                global_total_valeur += valeur_estimee
                global_total_valeur_restante += valeur_restante

                cmd_numero = "N/A"
                facture_numero = "N/A"
                if lot.commande_produit and lot.commande_produit.commande:
                    cmd_numero = f"CMD-{lot.commande_produit.commande.id}"
                    if lot.commande_produit.commande.numero_facture:
                        facture_numero = lot.commande_produit.commande.numero_facture

                fournisseurs_map[f_id]['details'].append({
                    'lot_id': lot.id,
                    'lot_numero': lot.lot,
                    'produit_nom': lot.produit.name if lot.produit else (lot.produit_nom or 'Inconnu'),
                    'date_reception': lot.date_reception.isoformat() if lot.date_reception else None,
                    'commande_numero': cmd_numero,
                    'facture_numero': facture_numero,
                    'quantity_free': lot.quantity_free,
                    'quantity_free_remaining': lot.quantity_free_remaining,
                    'valeur_estimee': float(valeur_estimee),
                    'valeur_restante': float(valeur_restante),
                    'prix_vente': float(lot.selling_price)
                })

            result = list(fournisseurs_map.values())
            result.sort(key=lambda x: x['total_valeur'], reverse=True)
            
            for r in result:
                r['total_valeur'] = float(r['total_valeur'])
                r['total_valeur_restante'] = float(r['total_valeur_restante'])

            return Response({
                'global_total_ug': global_total_ug,
                'global_total_ug_restantes': global_total_ug_restantes,
                'global_total_valeur': float(global_total_valeur),
                'global_total_valeur_restante': float(global_total_valeur_restante),
                'fournisseurs': result
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
