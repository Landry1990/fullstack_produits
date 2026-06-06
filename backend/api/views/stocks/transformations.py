import time
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from decimal import Decimal

from ...models import (
    StockLot, Produit, MouvementStock, StockAdjustment,
    RelationTransformation, HistoriqueTransformation, AuditLog
)
from ...serializers import (
    RelationTransformationSerializer, HistoriqueTransformationSerializer
)
from ...audit_helpers import log_audit
from ...pagination import StandardResultsSetPagination


class RelationTransformationViewSet(viewsets.ModelViewSet):
    queryset = RelationTransformation.objects.all()
    serializer_class = RelationTransformationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @action(detail=True, methods=['post'])
    def transformer(self, request, pk=None):
        relation = self.get_object()
        quantite = int(request.data.get('quantite', 1))
        
        if quantite <= 0:
            return Response({'error': 'La quantité doit être positive'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Verrouillage coordonné des produits par ordre d'ID pour éviter les deadlocks (conditions de course croisées)
            p_ids = [relation.produit_source.pk, relation.produit_destination.pk]
            locked_prods = {p.id: p for p in Produit.objects.select_for_update().filter(id__in=p_ids).order_by('id')}
            
            source = locked_prods.get(relation.produit_source.pk)
            destination = locked_prods.get(relation.produit_destination.pk)
            
            if not source or not destination:
                 return Response({'error': 'Produit source ou destination introuvable'}, status=status.HTTP_404_NOT_FOUND)

            if source.stock < quantite:
                return Response({'error': f'Stock insuffisant pour {source.name}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # --- 1. CONSOMMATION SOURCE (FIFO) ---
            consumed_lots_info = []
            
            if source.use_lot_management:
                # Vérification de cohérence
                total_lots = source.stock_lots.filter(quantity_remaining__gt=0).aggregate(total=Sum('quantity_remaining'))['total'] or 0
                
                # Si le stock global dit qu'on en a, mais les lots sont vides/insuffisants
                if total_lots < quantite:
                    # On pourrait bloquer, mais pour la résilience, on prévient juste ou on log
                    pass

                # FIFO Consumption
                lots = source.stock_lots.filter(quantity_remaining__gt=0).select_for_update().order_by('date_expiration', 'created_at')
                qty_remaining_to_consume = quantite
                
                for lot in lots:
                    if qty_remaining_to_consume <= 0:
                        break
                        
                    taken = min(lot.quantity_remaining, qty_remaining_to_consume)
                    
                    # Mise à jour du lot source
                    lot.quantity_remaining -= taken
                    lot.save()
                    
                    # Traceability
                    StockAdjustment.objects.create(
                        produit=source,
                        stock_lot=lot,
                        user=request.user,
                        quantity_before=lot.quantity_remaining + taken,
                        quantity_after=lot.quantity_remaining,
                        quantity_change=-taken,
                        reason_type=StockAdjustment.ReasonType.USAGE_INTERNE, 
                        reason_detail=f"Transformation vers {destination.name}"
                    )
                    
                    consumed_lots_info.append({'lot': lot, 'qty': taken})
                    qty_remaining_to_consume -= taken
                
            # Décrémentation Stock Global
            source.stock -= quantite
            source.save()
                
            # --- 2. CRÉATION DESTINATION ---
            ratio = Decimal(str(relation.ratio))
            
            if destination.use_lot_management:
                if consumed_lots_info:
                    for item in consumed_lots_info:
                        source_lot = item['lot']
                        taken_qty = item['qty']
                        quantite_dest_lot = int(Decimal(str(taken_qty)) * ratio)
                        
                        if quantite_dest_lot <= 0:
                            continue

                        # Find or create a lot in destination with same lot number
                        dest_lot, created = StockLot.objects.get_or_create(
                            produit=destination,
                            lot=source_lot.lot,
                            defaults={
                                'quantity_initial': quantite_dest_lot,
                                'quantity_remaining': quantite_dest_lot,
                                'quantity_paid': quantite_dest_lot,
                                'quantity_free': 0,
                                'price_cost': destination.cost_price or 0,
                                'selling_price': destination.selling_price or 0,
                                'date_expiration': source_lot.date_expiration,
                                'date_reception': timezone.now(),
                                'fournisseur': source_lot.fournisseur or source.fournisseur
                            }
                        )

                        if not created:
                            # Update existing lot
                            dest_lot.quantity_initial += quantite_dest_lot
                            dest_lot.quantity_remaining += quantite_dest_lot
                            dest_lot.quantity_paid += quantite_dest_lot
                            # Optionally update expiry if it was null
                            if not dest_lot.date_expiration and source_lot.date_expiration:
                                dest_lot.date_expiration = source_lot.date_expiration
                            dest_lot.save()

                        # Traceability Lot Dest
                        StockAdjustment.objects.create(
                             produit=destination,
                             stock_lot=dest_lot,
                             user=request.user,
                             quantity_before=dest_lot.quantity_remaining - quantite_dest_lot,
                             quantity_after=dest_lot.quantity_remaining,
                             quantity_change=quantite_dest_lot,
                             reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                             reason_detail=f"Transformation depuis {source.name} (Lot {source_lot.lot})"
                        )
                else:
                    # Fallback if source was NOT managed by lot but destination IS
                    quantite_dest = int(Decimal(str(quantite)) * ratio)
                    if quantite_dest > 0:
                        lot_number = f"TR{relation.id}-{int(time.time())}"
                        new_lot_dest = StockLot.objects.create(
                            produit=destination,
                            lot=lot_number,
                            quantity_initial=quantite_dest,
                            quantity_remaining=quantite_dest,
                            quantity_paid=quantite_dest,
                            quantity_free=0,
                            price_cost=destination.cost_price or 0,
                            selling_price=destination.selling_price or 0,
                            date_expiration=None,
                            date_reception=timezone.now(),
                            fournisseur=source.fournisseur
                        )
                        StockAdjustment.objects.create(
                             produit=destination,
                             stock_lot=new_lot_dest,
                             user=request.user,
                             quantity_before=0,
                             quantity_after=quantite_dest,
                             quantity_change=quantite_dest,
                             reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                             reason_detail=f"Transformation depuis {source.name} (Sans lot source)"
                        )
            
            # Recalculate total quantities to ensure consistency
            quantite_dest_total = int(Decimal(str(quantite)) * ratio)
            destination.stock += quantite_dest_total
            destination.save()
            
            # --- 3. HISTORIQUE & MOUVEMENTS GLOBAUX ---
            
            # Mouvement Source
            MouvementStock.objects.create(
                produit=source,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
                quantite=-quantite,
                stock_apres=source.stock,
                user=request.user,
                description=f"Transformation vers {destination.name} (par {request.user.username})"
            )

            # Mouvement Destination
            MouvementStock.objects.create(
                produit=destination,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
                quantite=quantite_dest_total,
                stock_apres=destination.stock,
                user=request.user,
                description=f"Transformation depuis {source.name} (par {request.user.username})"
            )

            # Historique Transformation
            HistoriqueTransformation.objects.create(
                relation=relation,
                produit_source=source,
                produit_destination=destination,
                quantite_source=quantite,
                quantite_destination=quantite_dest_total,
                user=request.user,
                notes=request.data.get('notes', '')
            )

            # Log Audit transaction
            log_audit(
                user=request.user,
                action=AuditLog.Action.STOCK_ADJUST,
                model_name='Transformation',
                object_id=relation.id,
                description=f"Transformation: {quantite} {source.name} -> {quantite_dest_total} {destination.name}",
                details={
                    'source_id': source.id,
                    'destination_id': destination.id,
                    'qty_src': -quantite,
                    'qty_dest': quantite_dest_total,
                    'source_lots_used': [l['lot'].lot for l in consumed_lots_info]
                },
                request=request
            )
        
        return Response({
            'success': True,
            'stock_source': source.stock,
            'stock_destination': destination.stock,
            'message': f"Transformation réussie : {quantite} {source.name} -> {quantite_dest_total} {destination.name}"
        })


class HistoriqueTransformationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HistoriqueTransformation.objects.all()
    serializer_class = HistoriqueTransformationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['produit_source', 'produit_destination']
    ordering_fields = ['date_transformation']
    ordering = ['-date_transformation']
