import time
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...models import (
    AuditLog,
    HistoriqueTransformation,
    MouvementStock,
    Produit,
    RelationTransformation,
    StockAdjustment,
    StockLot,
)
from ...pagination import StandardResultsSetPagination
from ...serializers import (
    HistoriqueTransformationSerializer,
    RelationTransformationSerializer,
)


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
            
            # --- 1. CONSOMMATION SOURCE ---
            consumed_lots_info = []
            
            if source.use_lot_management:
                # Vérification de cohérence
                total_lots = source.stock_lots.filter(quantity_remaining__gt=0).aggregate(total=Sum('quantity_remaining'))['total'] or 0
                
                # Si le stock global dit qu'on en a, mais les lots sont vides/insuffisants
                if total_lots < quantite:
                    # On pourrait bloquer, mais pour la résilience, on prévient juste ou on log
                    pass

                # Sélection manuelle des lots possible via request.data.lots
                selected_lots = request.data.get('lots')
                
                if selected_lots and isinstance(selected_lots, list):
                    # Mode sélection manuelle
                    lot_ids = [item.get('lot_id') for item in selected_lots if item.get('lot_id')]
                    lots = source.stock_lots.filter(
                        id__in=lot_ids,
                        quantity_remaining__gt=0
                    ).select_for_update().order_by('date_expiration', 'created_at')
                    
                    lot_map = {lot.id: lot for lot in lots}
                    qty_remaining_to_consume = quantite
                    
                    for item in selected_lots:
                        if qty_remaining_to_consume <= 0:
                            break
                        lot_id = item.get('lot_id')
                        lot = lot_map.get(lot_id)
                        if not lot:
                            continue
                        requested_qty = int(item.get('quantity', 0))
                        if requested_qty <= 0:
                            continue
                        taken = min(lot.quantity_remaining, requested_qty, qty_remaining_to_consume)
                        if taken <= 0:
                            continue
                        
                        lot.quantity_remaining -= taken
                        lot.save()
                        
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
                    
                    # Compléter avec FEFO si la sélection manuelle est insuffisante
                    if qty_remaining_to_consume > 0:
                        remaining_lots = source.stock_lots.filter(
                            quantity_remaining__gt=0
                        ).exclude(
                            id__in=[l['lot'].id for l in consumed_lots_info]
                        ).select_for_update().order_by('date_expiration', 'created_at')
                        
                        for lot in remaining_lots:
                            if qty_remaining_to_consume <= 0:
                                break
                            taken = min(lot.quantity_remaining, qty_remaining_to_consume)
                            lot.quantity_remaining -= taken
                            lot.save()
                            
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
                else:
                    # FEFO Consumption (First Expired, First Out)
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
            if source.use_lot_management:
                # Les lots ont déjà été sauvegardés, le signal a synchronisé le stock.
                # Rafraîchir pour avoir la valeur cohérente en mémoire.
                source.refresh_from_db()
            else:
                source.stock -= quantite
                source.version += 1
                source.save(update_fields=['stock', 'version'])
                
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

                        # Prix de revient dérivé du lot source (prix source / ratio)
                        # Ex: 1 boîte de 100 à 1000F → 10 boîtes de 10 à 100F chacune
                        derived_price_cost = (source_lot.price_cost or 0) / ratio if ratio > 0 else (destination.cost_price or 0)

                        # Find or create a lot in destination with same lot number
                        dest_lot, created = StockLot.objects.get_or_create(
                            produit=destination,
                            lot=source_lot.lot,
                            defaults={
                                'quantity_initial': quantite_dest_lot,
                                'quantity_remaining': quantite_dest_lot,
                                'quantity_paid': quantite_dest_lot,
                                'quantity_free': 0,
                                'price_cost': derived_price_cost,
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
                        derived_price_cost = (source.cost_price or 0) / ratio if ratio > 0 else (destination.cost_price or 0)
                        new_lot_dest = StockLot.objects.create(
                            produit=destination,
                            lot=lot_number,
                            quantity_initial=quantite_dest,
                            quantity_remaining=quantite_dest,
                            quantity_paid=quantite_dest,
                            quantity_free=0,
                            price_cost=derived_price_cost,
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
            if destination.use_lot_management:
                # Les lots destination ont été créés/mis à jour, le signal a synchronisé le stock.
                destination.refresh_from_db()
            else:
                destination.stock += quantite_dest_total
                destination.version += 1
                destination.save(update_fields=['stock', 'version'])
            
            # --- 3. HISTORIQUE & MOUVEMENTS GLOBAUX ---
            
            # Mouvement Source
            MouvementStock.objects.create(
                produit=source,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
                quantite=-quantite,
                stock_apres=source.total_stock,
                user=request.user,
                description=f"Transformation vers {destination.name} (par {request.user.username})"
            )

            # Mouvement Destination
            MouvementStock.objects.create(
                produit=destination,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
                quantite=quantite_dest_total,
                stock_apres=destination.total_stock,
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

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """
        Prévisualise la transformation sans modifier les stocks.
        Retourne le stock source restant, les lots qui seront consommés (FIFO),
        et la quantité destination calculée.
        """
        relation = self.get_object()
        quantite = int(request.data.get('quantite', 1))

        if quantite <= 0:
            return Response({'error': 'La quantité doit être positive'}, status=status.HTTP_400_BAD_REQUEST)

        source = relation.produit_source
        destination = relation.produit_destination

        if source.stock < quantite:
            return Response({
                'error': f'Stock insuffisant pour {source.name}',
                'stock_source': source.stock
            }, status=status.HTTP_400_BAD_REQUEST)

        from decimal import Decimal
        ratio = Decimal(str(relation.ratio))
        quantite_dest_total = int(Decimal(str(quantite)) * ratio)

        lots_preview = []
        if source.use_lot_management:
            all_lots = source.stock_lots.filter(quantity_remaining__gt=0).order_by('date_expiration', 'created_at')
            qty_remaining_to_consume = quantite
            for lot in all_lots:
                if qty_remaining_to_consume <= 0:
                    taken = 0
                else:
                    taken = min(lot.quantity_remaining, qty_remaining_to_consume)
                    qty_remaining_to_consume -= taken
                lots_preview.append({
                    'lot_id': lot.id,
                    'lot': lot.lot,
                    'quantity_remaining': lot.quantity_remaining,
                    'quantity_consumed': taken,
                    'quantity_remaining_after': lot.quantity_remaining - taken,
                    'date_expiration': lot.date_expiration.isoformat() if lot.date_expiration else None,
                    'fournisseur': lot.fournisseur.name if lot.fournisseur else None,
                    'selected': taken > 0
                })

        return Response({
            'stock_source': source.stock,
            'stock_source_after': source.stock - quantite,
            'stock_destination': destination.stock,
            'stock_destination_after': destination.stock + quantite_dest_total,
            'quantite_source': quantite,
            'quantite_destination': quantite_dest_total,
            'ratio': relation.ratio,
            'use_lot_management': source.use_lot_management,
            'lots': lots_preview,
            'manual_lots_enabled': source.use_lot_management
        })

    @action(detail=False, methods=['get'])
    def transformations_needed(self, request):
        """
        Retourne les produits destination en stock bas (<= min_rayon ou 0)
        qui ont une relation de transformation active avec un produit source
        ayant suffisamment de stock pour être transformé.
        """
        relations = RelationTransformation.objects.filter(
            actif=True
        ).select_related('produit_source', 'produit_destination')

        results = []
        for rel in relations:
            dest = rel.produit_destination
            source = rel.produit_source

            # Destination en stock bas : stock <= 1
            if dest.stock > 1:
                continue

            # Source a assez de stock pour au moins 1 transformation
            if source.stock < 1:
                continue

            # Quantité transformable = floor(source.stock) unités source → source.stock * ratio unités destination
            qty_transformable = int(source.stock)
            qty_dest_obtained = int(Decimal(str(qty_transformable)) * Decimal(str(rel.ratio)))

            results.append({
                'relation_id': rel.id,
                'source_id': source.id,
                'source_name': source.name,
                'source_stock': source.stock,
                'destination_id': dest.id,
                'destination_name': dest.name,
                'destination_stock': dest.stock,
                'ratio': float(rel.ratio),
                'qty_transformable': qty_transformable,
                'qty_dest_obtained': qty_dest_obtained,
            })

        results.sort(key=lambda x: x['destination_stock'])
        return Response({'count': len(results), 'items': results})


class HistoriqueTransformationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HistoriqueTransformation.objects.all()
    serializer_class = HistoriqueTransformationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['produit_source', 'produit_destination']
    ordering_fields = ['date_transformation']
    ordering = ['-date_transformation']

    @action(detail=True, methods=['post'])
    def reverser(self, request, pk=None):
        """
        Annule une transformation : reprend la quantité au produit destination
        et la restitue au produit source.
        """
        hist = self.get_object()

        if hist.reversed:
            return Response(
                {'error': 'Cette transformation a déjà été annulée'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if hist.reversed_by is not None:
            return Response(
                {'error': 'Cette entrée est une annulation et ne peut pas être annulée'},
                status=status.HTTP_400_BAD_REQUEST
            )

        source = hist.produit_source
        destination = hist.produit_destination

        if not source or not destination:
            return Response(
                {'error': 'Produit source ou destination introuvable (supprimé)'},
                status=status.HTTP_404_NOT_FOUND
            )

        qty_dest = hist.quantite_destination
        qty_src = hist.quantite_source

        if qty_dest <= 0 or qty_src <= 0:
            return Response(
                {'error': 'Quantités invalides dans l\'historique'},
                status=status.HTTP_400_BAD_REQUEST
            )

        notes = request.data.get('notes', f'Annulation de la transformation #{hist.id}')

        with transaction.atomic():
            p_ids = [source.pk, destination.pk]
            locked_prods = {p.id: p for p in Produit.objects.select_for_update().filter(id__in=p_ids).order_by('id')}
            source = locked_prods.get(source.pk)
            destination = locked_prods.get(destination.pk)

            if not source or not destination:
                return Response(
                    {'error': 'Produit source ou destination introuvable'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if destination.stock < qty_dest:
                return Response(
                    {'error': f'Stock insuffisant pour {destination.name} (disponible: {destination.stock}, requis: {qty_dest})'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # --- 1. CONSOMMATION DESTINATION (on reprend ce qui avait été créé) ---
            consumed_dest_lots = []

            if destination.use_lot_management:
                lots = destination.stock_lots.filter(
                    quantity_remaining__gt=0
                ).select_for_update().order_by('date_expiration', 'created_at')
                qty_remaining = qty_dest

                for lot in lots:
                    if qty_remaining <= 0:
                        break
                    taken = min(lot.quantity_remaining, qty_remaining)
                    lot.quantity_remaining -= taken
                    lot.save()

                    StockAdjustment.objects.create(
                        produit=destination,
                        stock_lot=lot,
                        user=request.user,
                        quantity_before=lot.quantity_remaining + taken,
                        quantity_after=lot.quantity_remaining,
                        quantity_change=-taken,
                        reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                        reason_detail=f"Annulation transformation #{hist.id} (vers {source.name})"
                    )
                    consumed_dest_lots.append({'lot': lot, 'qty': taken})
                    qty_remaining -= taken

                if qty_remaining > 0:
                    return Response(
                        {'error': f'Lots destination insuffisants pour {destination.name} (manquant: {qty_remaining})'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                destination.refresh_from_db()
            else:
                destination.stock -= qty_dest
                destination.version += 1
                destination.save(update_fields=['stock', 'version'])

            # --- 2. RESTITUTION SOURCE (on rend ce qui avait été consommé) ---
            if source.use_lot_management:
                lot_number = f"REV-{hist.id}-{int(time.time())}"
                new_lot = StockLot.objects.create(
                    produit=source,
                    lot=lot_number,
                    quantity_initial=qty_src,
                    quantity_remaining=qty_src,
                    quantity_paid=qty_src,
                    quantity_free=0,
                    price_cost=source.cost_price or 0,
                    selling_price=source.selling_price or 0,
                    date_expiration=None,
                    date_reception=timezone.now(),
                    fournisseur=source.fournisseur
                )
                StockAdjustment.objects.create(
                    produit=source,
                    stock_lot=new_lot,
                    user=request.user,
                    quantity_before=0,
                    quantity_after=qty_src,
                    quantity_change=qty_src,
                    reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                    reason_detail=f"Annulation transformation #{hist.id} (depuis {destination.name})"
                )
                source.refresh_from_db()
            else:
                source.stock += qty_src
                source.version += 1
                source.save(update_fields=['stock', 'version'])

            # --- 3. MOUVEMENTS STOCK ---
            MouvementStock.objects.create(
                produit=destination,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
                quantite=-qty_dest,
                stock_apres=destination.total_stock,
                user=request.user,
                description=f"Annulation transformation #{hist.id} (vers {source.name}) par {request.user.username}"
            )
            MouvementStock.objects.create(
                produit=source,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
                quantite=qty_src,
                stock_apres=source.total_stock,
                user=request.user,
                description=f"Annulation transformation #{hist.id} (depuis {destination.name}) par {request.user.username}"
            )

            # --- 4. NOUVELLE ENTREE HISTORIQUE (l'annulation) ---
            reversal_entry = HistoriqueTransformation.objects.create(
                relation=hist.relation,
                produit_source=destination,
                produit_destination=source,
                produit_source_nom=destination.name,
                produit_destination_nom=source.name,
                quantite_source=qty_dest,
                quantite_destination=qty_src,
                user=request.user,
                notes=notes,
                reversed_by=hist,
            )

            # --- 5. MARQUER L'ORIGINAL COMME ANNULÉ ---
            hist.reversed = True
            hist.save(update_fields=['reversed'])

            # --- 6. AUDIT ---
            log_audit(
                user=request.user,
                action=AuditLog.Action.STOCK_ADJUST,
                model_name='TransformationReversal',
                object_id=hist.id,
                description=f"Annulation transformation #{hist.id}: {qty_dest} {destination.name} -> {qty_src} {source.name}",
                details={
                    'original_hist_id': hist.id,
                    'reversal_hist_id': reversal_entry.id,
                    'source_id': source.id,
                    'destination_id': destination.id,
                    'qty_dest_consumed': -qty_dest,
                    'qty_src_restored': qty_src,
                },
                request=request
            )

        return Response({
            'success': True,
            'message': f"Transformation annulée : {qty_dest} {destination.name} -> {qty_src} {source.name}",
            'stock_source': source.stock,
            'stock_destination': destination.stock,
        })
