from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.db.models import F, Sum, IntegerField, Case, When

from ...models import Produit, StockLot, StockAdjustment, ReapproSession, AuditLog, FactureProduit, Commande, MouvementStock
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode

class ProduitStockMixin:
    """Mixin pour la gestion des stocks, ajustements, et historique des produits."""

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        produit = self.get_object()
        
        mouvements = MouvementStock.objects.filter(produit=produit).select_related('user').values(
            'date', 'type_mouvement', 'quantite', 'stock_apres', 'description', 'user__username', 'id', 'facture', 'commande'
        )
        
        import re
        def extract_commande_id(desc):
            if not desc: return None
            match = re.search(r"[Cc]ommande\s*#(\d+)", desc)
            return int(match.group(1)) if match else None

        history = []
        for m in mouvements:
            commande_id = m['commande'] or extract_commande_id(m['description'])
            history.append({
                'date': m['date'],
                'type': m['type_mouvement'],
                'quantity': m['quantite'], 
                'stock_apres': m['stock_apres'],
                'libelle': m['description'] or m['type_mouvement'],
                'prix_unitaire': 0, 
                'user': m['user__username'],
                'source': 'MOUVEMENT',
                'id': m['id'],
                'facture': m['facture'],
                'commande': commande_id
            })
            
        ventes = FactureProduit.objects.filter(
            produit=produit, 
            facture__status__in=['VAL', 'PAY']  
        ).select_related('facture', 'facture__client').values(
            'facture__date', 'quantity', 'selling_price', 'facture__numero_facture', 'facture__client__name', 'facture__id'
        )
        
        for v in ventes:
            if any(h.get('facture') == v['facture__id'] for h in history):
                continue

            history.append({
                'date': v['facture__date'],
                'type': 'SORTIE',
                'quantity': -v['quantity'], 
                'stock_apres': 0, 
                'libelle': f"Vente: Facture #{v['facture__numero_facture'] or v['facture__id']} - {v['facture__client__name'] or 'Client Divers'}",
                'prix_unitaire': v['selling_price'],
                'user': '',
                'source': 'VENTE',
                'id': v['facture__id'],
                'facture': v['facture__id']
            })
            
        adjustments = StockAdjustment.objects.filter(produit=produit).select_related('user').values(
            'created_at', 'quantity_change', 'quantity_after', 'reason_type', 'reason_detail', 'user__username', 'id'
        )
        
        existing_movements = []
        for m in history:
             if m['source'] == 'MOUVEMENT':
                 existing_movements.append(m)

        for adj in adjustments:
            is_duplicate = False
            adj_time = adj['created_at'].timestamp()
            
            for m in existing_movements:
                m_time = m['date'].timestamp()
                time_diff = abs(m_time - adj_time)
                
                if time_diff < 60 and m['quantity'] == adj['quantity_change']:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                type_mouvement = 'ENTREE' if adj['quantity_change'] >= 0 else 'SORTIE'
                history.append({
                    'date': adj['created_at'],
                    'type': type_mouvement,
                    'quantity': adj['quantity_change'],  
                    'stock_apres': adj['quantity_after'],  
                    'libelle': f"Ajustement: {adj['reason_detail'] or adj['reason_type']}",
                    'commande': extract_commande_id(adj['reason_detail'] or adj['reason_type']),
                    'prix_unitaire': 0,
                    'user': adj['user__username'] or '',
                    'source': 'AJUSTEMENT',
                    'id': adj['id']
                })

        all_potential_cmd_ids = set()
        for item in history:
            if item.get('commande'):
                all_potential_cmd_ids.add(item['commande'])
        
        if all_potential_cmd_ids:
            cmd_data = {
                c['id']: c['numero_facture']
                for c in Commande.objects.filter(id__in=all_potential_cmd_ids).values('id', 'numero_facture')
            }
            for item in history:
                cmd_id = item.get('commande')
                if cmd_id:
                    if cmd_id in cmd_data:
                        item['commande_numero'] = cmd_data[cmd_id]
                    else:
                        item['commande'] = None

        history.sort(key=lambda x: x['date'], reverse=True)
        
        current_stock = produit.total_stock 
        running_stock = current_stock
        
        for item in history:
            item['stock_apres'] = running_stock
            change_qty = item['quantity']
            if item.get('type') == MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK:
                change_qty = 0
                
            stock_before = running_stock - change_qty
            item['stock_avant'] = stock_before
            running_stock = stock_before
            
        return Response(history)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def adjust_stock(self, request, pk=None):
        produit = self.get_object()
        
        new_quantity = request.data.get('new_quantity')
        new_reserve_quantity = request.data.get('new_reserve_quantity')
        reason_type = request.data.get('reason_type')
        reason_detail = request.data.get('reason_detail', '')
        stock_lot_id = request.data.get('stock_lot_id')
        
        if new_quantity is None and new_reserve_quantity is None:
            return Response({'detail': 'new_quantity ou new_reserve_quantity est requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        from ...models import ConfigurationOption
        valid_reasons = [choice[0] for choice in StockAdjustment.ReasonType.choices]
        custom_reasons = list(ConfigurationOption.objects.filter(
            type=ConfigurationOption.Type.STOCK_ADJUSTMENT_REASON, 
            is_active=True
        ).values_list('code', flat=True))
        
        if reason_type not in valid_reasons and reason_type not in custom_reasons:
            return Response({'detail': f'reason_type invalide. Choisir parmi les motifs standards ou personnaliss.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if new_quantity is not None:
                new_quantity = int(new_quantity)
            if new_reserve_quantity is not None:
                new_reserve_quantity = int(new_reserve_quantity)
        except ValueError:
            return Response({'detail': 'Les quantités doivent être des entiers'}, status=status.HTTP_400_BAD_REQUEST)
        
        stock_lot = None
        if stock_lot_id:
            try:
                stock_lot = StockLot.objects.get(pk=stock_lot_id, produit=produit)
            except StockLot.DoesNotExist:
                return Response({'detail': 'Lot introuvable'}, status=status.HTTP_400_BAD_REQUEST)
        
        quantity_before = produit.stock
        if new_quantity is None:
            new_quantity = quantity_before
        quantity_change = new_quantity - quantity_before

        reserve_before = produit.stock_reserve or 0
        if new_reserve_quantity is None:
            new_reserve_quantity = reserve_before
        reserve_change = new_reserve_quantity - reserve_before
        
        adjustment = StockAdjustment.objects.create(
            produit=produit, stock_lot=stock_lot, user=request.user,
            quantity_before=quantity_before, quantity_after=new_quantity, quantity_change=quantity_change,
            reserve_before=reserve_before, reserve_after=new_reserve_quantity, reserve_change=reserve_change,
            reason_type=reason_type, reason_detail=(reason_detail or '').strip()
        )
        
        produit.stock = new_quantity
        produit.stock_reserve = new_reserve_quantity
        produit.save(update_fields=['stock', 'stock_reserve'])
        
        if stock_lot:
            if quantity_change != 0:
                new_lot_qty = stock_lot.quantity_remaining + quantity_change
                stock_lot.quantity_remaining = max(0, new_lot_qty)
            if reserve_change != 0:
                new_reserve_qty = stock_lot.quantity_reserved + reserve_change
                stock_lot.quantity_reserved = max(0, new_reserve_qty)
            stock_lot.save(update_fields=['quantity_remaining', 'quantity_reserved'])
        
        type_mv = MouvementStock.TypeMouvement.AJUSTEMENT
        if quantity_change == -reserve_change and quantity_change != 0:
            type_mv = MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK
            
        MouvementStock.objects.create(
            produit=produit, type_mouvement=type_mv,
            quantite=quantity_change + reserve_change, stock_apres=produit.total_stock,
            user=request.user, description=f"Ajustement manuel: {reason_detail or reason_type}. Rayon: {quantity_change:+d}, Réserve: {reserve_change:+d}"
        )
        
        log_audit(
            user=request.user, action=AuditLog.Action.STOCK_ADJUST,
            model_name='Produit', object_id=produit.id,
            description=f"Ajustement stock: Rayon {quantity_change:+d}, Réserve {reserve_change:+d} ({reason_detail or reason_type})",
            details={
                'produit_id': produit.id, 'produit_nom': produit.name,
                'quantity_before': quantity_before, 'quantity_after': new_quantity, 'quantity_change': quantity_change,
                'reason_type': reason_type, 'reason_detail': reason_detail,
                'stock_lot': stock_lot.lot if stock_lot else None
            }, request=request
        )
        
        return Response({
            'status': 'success', 'adjustment_id': adjustment.id, 'produit_name': produit.name,
            'quantity_before': quantity_before, 'quantity_after': new_quantity, 'quantity_change': quantity_change,
            'reason': f"{adjustment.get_reason_type_display()}: {adjustment.reason_detail}"
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def transfer_to_shelf(self, request, pk=None):
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_adjust_stock')
        if error_res: return error_res

        produit = self.get_object()
        if not produit.has_reserve_storage:
            return Response({'detail': "La gestion de réserve n'est pas activée pour ce produit."}, status=status.HTTP_400_BAD_REQUEST)
        
        quantity = request.data.get('quantity')
        if quantity:
            try: quantity = int(quantity)
            except ValueError: return Response({'detail': "La quantité doit être un nombre entier."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            needed = max(0, produit.capacite_rayon - produit.stock)
            quantity = min(needed, produit.stock_reserve)
            
        if quantity <= 0: return Response({'detail': "Quantité de transfert nulle ou négative."}, status=status.HTTP_400_BAD_REQUEST)
        if quantity > produit.stock_reserve: return Response({'detail': f"Quantité demandée ({quantity}) supérieure au stock en réserve ({produit.stock_reserve})."}, status=status.HTTP_400_BAD_REQUEST)
            
        lots = produit.stock_lots.filter(quantity_reserved__gt=0).order_by('date_reception')
        remaining_to_transfer = quantity
        for lot in lots:
            if remaining_to_transfer <= 0: break
            transfer_qty = min(remaining_to_transfer, lot.quantity_reserved)
            lot.quantity_reserved -= transfer_qty
            lot.quantity_remaining += transfer_qty
            lot.save(update_fields=['quantity_reserved', 'quantity_remaining'])
            remaining_to_transfer -= transfer_qty
            
        produit.stock += quantity
        produit.stock_reserve -= quantity
        oldest_shelf_lot = produit.stock_lots.filter(quantity_remaining__gt=0).order_by('date_reception').first()
        if oldest_shelf_lot:
            produit.selling_price = oldest_shelf_lot.selling_price
            produit.expire_date = oldest_shelf_lot.date_expiration
            
        produit.save(update_fields=['stock', 'stock_reserve', 'selling_price', 'expire_date'])
        
        base_desc = f" (Validé par {validation_user.username})" if validation_user != request.user else ""
        MouvementStock.objects.create(
            produit=produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK,
            quantite=-quantity, stock_apres=produit.total_stock, user=validation_user, description=f"Sortie Réserve: {quantity} unités.{base_desc}"
        )
        MouvementStock.objects.create(
            produit=produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK,
            quantite=quantity, stock_apres=produit.total_stock, user=validation_user, description=f"Entrée Rayon: {quantity} unités.{base_desc}"
        )
        
        log_audit(
            user=request.user, action=AuditLog.Action.STOCK_ADJUST, model_name='Produit', object_id=produit.id,
            description=f"Réappro Rayon (Split): {quantity} unités de la Réserve vers le Rayon. Opérateur: {validation_user.username}",
            details={
                'produit': produit.name, 'quantite': quantity, 'new_selling_price': str(produit.selling_price),
                'new_expire_date': str(produit.expire_date), 'source': 'reserve', 'destination': 'rayon',
                'validator': validation_user.username, 'is_sudo': validation_user != request.user
            }, request=request
        )
        
        return Response({'detail': f"Transfert de {quantity} effectué avec succès par {validation_user.username}.", 'stock_rayon': produit.stock, 'stock_reserve': produit.stock_reserve})

    @action(detail=False, methods=['get'])
    def reappro_summary(self, request):
        needs_reappro_qs = Produit.objects.filter(
            has_reserve_storage=True, stock__lte=F('min_rayon'), stock_reserve__gt=0, is_active=True
        )
        count = needs_reappro_qs.count()
        suggestion_aggregate = needs_reappro_qs.annotate(needed=F('capacite_rayon') - F('stock')).aggregate(
            total_suggested=Sum(Case(When(needed__lt=F('stock_reserve'), then=F('needed')), default=F('stock_reserve'), output_field=IntegerField()))
        )
        return Response({'product_count': count, 'total_units_suggested': suggestion_aggregate['total_suggested'] or 0})

    @action(detail=False, methods=['post'])
    def bulk_transfer_to_shelf(self, request):
        product_ids = request.data.get('product_ids', [])
        if not product_ids: return Response({'detail': 'Aucun produit sélectionné'}, status=status.HTTP_400_BAD_REQUEST)
            
        sudo_password = request.data.get('sudo_password')
        validated_by_id = request.data.get('validated_by_id')
        
        validation_user = request.user
        if validated_by_id and sudo_password:
            valid, user_or_err = validate_sudo_mode(validated_by_id, sudo_password)
            if not valid: return Response({'detail': user_or_err}, status=status.HTTP_403_FORBIDDEN)
            validation_user = user_or_err
        elif not (request.user.is_superuser or getattr(request.user, 'can_adjust_stock', False) or (hasattr(request.user, 'profile') and getattr(request.user.profile, 'can_adjust_stock', False))):
            return Response({'detail': 'Permission refusée (Mode Validation requis)'}, status=status.HTTP_403_FORBIDDEN)

        results = []
        with transaction.atomic():
            session = ReapproSession.objects.create(user=request.user, total_products=0, total_units=0)
            for pid in product_ids:
                try:
                    produit = Produit.objects.select_for_update().get(pk=pid, has_reserve_storage=True)
                    needed = max(0, produit.capacite_rayon - produit.stock)
                    quantity = min(needed, produit.stock_reserve)
                    
                    if quantity <= 0: continue
                        
                    lots = produit.stock_lots.filter(quantity_reserved__gt=0).order_by('date_expiration', 'id')
                    remaining_to_transfer = quantity
                    
                    for lot in lots:
                        if remaining_to_transfer <= 0: break
                        can_take = min(lot.quantity_reserved, remaining_to_transfer)
                        lot.quantity_reserved -= can_take
                        lot.quantity_remaining += can_take
                        lot.save(update_fields=['quantity_reserved', 'quantity_remaining'])
                        
                        StockAdjustment.objects.create(
                            produit=produit, stock_lot=lot, user=request.user, reappro_session=session,
                            quantity_before=produit.stock, quantity_after=produit.stock + can_take, quantity_change=can_take,
                            reserve_before=produit.stock_reserve, reserve_after=produit.stock_reserve - can_take, reserve_change=-can_take,
                            reason_type='REAPPRO', reason_detail=f"Réappro session #{session.id} - Lot {lot.lot}"
                        )
                        remaining_to_transfer -= can_take
                    
                    produit.stock += quantity
                    produit.stock_reserve -= quantity
                    produit.save(update_fields=['stock', 'stock_reserve'])
                    
                    MouvementStock.objects.create(
                        produit=produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK,
                        quantite=quantity, stock_apres=produit.total_stock, user=validation_user,
                        description=f"Transfert groupé (Session #{session.id}): {quantity} unités du stock réserve vers le rayon."
                    )
                    
                    session.total_products += 1
                    session.total_units += quantity
                    results.append({'id': pid, 'success': True, 'transferred': quantity})
                except Exception as e:
                    results.append({'id': pid, 'success': False, 'error': str(e)})
            
            if session.total_products > 0: session.save(update_fields=['total_products', 'total_units'])
            else: session.delete() 

        return Response({'detail': f"{len([r for r in results if r['success']])} produits réapprovisionnés.", 'results': results, 'session_id': session.id if getattr(session, 'id', None) else None})
