from django.db import transaction
from django.db.models import Case, F, IntegerField, Q, Sum, When
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...idempotency import idempotent_action
from ...models import (
    AuditLog,
    Avoir,
    AvoirClient,
    Commande,
    FactureProduit,
    MouvementStock,
    Produit,
    ReapproSession,
    StockAdjustment,
    StockLot,
    StockObligation,
)
from ...services.realtime import notify_stock_changed
from ...services.stock_obligation_service import StockObligationService
from ...sudo_utils import validate_sudo_mode


class ProduitStockMixin:
    """Mixin pour la gestion des stocks, ajustements, et historique des produits."""

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        produit = self.get_object()
        
        mouvements = MouvementStock.objects.filter(produit=produit).select_related('user', 'avoir_client').values(
            'date', 'type_mouvement', 'quantite', 'stock_apres', 'description', 'user__username', 'id', 'facture', 'commande', 'avoir_client', 'avoir_client__numero'
        )
        
        import re
        def extract_commande_id(desc):
            if not desc: return None
            match = re.search(r"[Cc]ommande\s*#(\d+)", desc)
            return int(match.group(1)) if match else None

        def extract_avoir_numero(desc):
            if not desc: return None
            match = re.search(r"Avoir\s+([A-Z0-9\-]+)", desc)
            return match.group(1) if match else None

        # Pre-load avoir data for all potential avoir numeros
        avoir_numeros = set()
        for m in mouvements:
            if m['type_mouvement'] in (MouvementStock.TypeMouvement.AVOIR, MouvementStock.TypeMouvement.RETOUR):
                num = extract_avoir_numero(m['description'])
                if num:
                    avoir_numeros.add(num)
        
        avoir_map = {}
        if avoir_numeros:
            for a in Avoir.objects.filter(numero__in=avoir_numeros).values('id', 'numero'):
                avoir_map[a['numero']] = a['id']

        history = []
        for m in mouvements:
            commande_id = m['commande'] or extract_commande_id(m['description'])
            item = {
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
            }
            if m['avoir_client']:
                avoir_numero = m['avoir_client__numero']
                item['avoir_client'] = m['avoir_client']
                item['avoir_client_numero'] = avoir_numero
                item['avoir'] = m['avoir_client']
                item['avoir_numero'] = avoir_numero
                item['libelle'] = f"Avoir client {avoir_numero}"
            elif m['type_mouvement'] in (MouvementStock.TypeMouvement.AVOIR, MouvementStock.TypeMouvement.RETOUR):
                avoir_numero = extract_avoir_numero(m['description'])
                if avoir_numero:
                    item['avoir'] = avoir_map.get(avoir_numero)
                    item['avoir_numero'] = avoir_numero
                    item['libelle'] = f"Avoir {avoir_numero}"
            history.append(item)
            
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
                # Pas de snapshot réel pour les ventes → None : la
                # boucle finale garde le recalcul chaîné pour ces
                # lignes (un 0 ici serait pris pour un vrai snapshot).
                'stock_apres': None, 
                'libelle': f"Vente Facture #{v['facture__numero_facture'] or v['facture__id']}",
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
        
        # « stock_apres » : snapshot réel enregistré au moment du
        # mouvement quand il existe — plus juste que la chaîne
        # recalculée à rebours (qui masque les stocks négatifs et les
        # resynchronisations stock=somme des lots faites en réception).
        # Les lignes sans snapshot (anciennes données) gardent le
        # recalcul chaîné depuis le stock actuel.
        running_stock = produit.total_stock

        for item in history:
            change_qty = item['quantity']
            if item.get('type') == MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK:
                change_qty = 0

            stored = item.get('stock_apres')
            if stored is not None:
                item['stock_apres'] = stored
            else:
                item['stock_apres'] = running_stock

            stock_before = item['stock_apres'] - change_qty
            item['stock_avant'] = stock_before
            running_stock = stock_before
            
        return Response(history)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    @idempotent_action
    def adjust_stock(self, request, pk=None):
        # Permission check — same as transfer_to_shelf
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_adjust_stock')
        if error_res:
            return error_res

        # Lock product (and optional lot) to prevent concurrent manual adjustments.
        produit = Produit.objects.select_for_update().get(pk=self.kwargs['pk'])

        new_quantity = request.data.get('new_quantity')
        new_reserve_quantity = request.data.get('new_reserve_quantity')
        reason_type = request.data.get('reason_type')
        reason_detail = request.data.get('reason_detail', '')
        stock_lot_id = request.data.get('stock_lot_id')
        new_lot_number = request.data.get('new_lot_number', '').strip() if request.data.get('new_lot_number') else ''
        new_lot_expiration = request.data.get('new_lot_expiration', '').strip() if request.data.get('new_lot_expiration') else ''

        if new_quantity is None and new_reserve_quantity is None:
            return Response({'detail': 'new_quantity ou new_reserve_quantity est requis'}, status=status.HTTP_400_BAD_REQUEST)

        from ...models import ConfigurationOption
        valid_reasons = [choice[0] for choice in StockAdjustment.ReasonType.choices]
        custom_reasons = list(ConfigurationOption.objects.filter(
            type=ConfigurationOption.Type.STOCK_ADJUSTMENT_REASON,
            is_active=True
        ).values_list('code', flat=True))

        if reason_type not in valid_reasons and reason_type not in custom_reasons:
            return Response({'detail': 'reason_type invalide. Choisir parmi les motifs standards ou personnaliss.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Cast strict : rejette booléens, floats non entiers (1.5), NaN, inf
            if new_quantity is not None:
                if isinstance(new_quantity, bool) or (isinstance(new_quantity, float) and not new_quantity.is_integer()):
                    raise ValueError
                new_quantity = int(new_quantity)
            if new_reserve_quantity is not None:
                if isinstance(new_reserve_quantity, bool) or (isinstance(new_reserve_quantity, float) and not new_reserve_quantity.is_integer()):
                    raise ValueError
                new_reserve_quantity = int(new_reserve_quantity)
        except (TypeError, ValueError, OverflowError):
            return Response({'detail': 'Les quantités doivent être des entiers'}, status=status.HTTP_400_BAD_REQUEST)

        if (new_quantity is not None and new_quantity < 0) or \
                (new_reserve_quantity is not None and new_reserve_quantity < 0):
            return Response({'detail': 'Les quantités ne peuvent pas être négatives.'}, status=status.HTTP_400_BAD_REQUEST)

        stock_lot = None
        create_new_lot = bool(new_lot_number)
        new_lot_date_exp = None
        if new_lot_number:
            import datetime as _dt

            if new_lot_expiration:
                try:
                    new_lot_date_exp = _dt.datetime.strptime(new_lot_expiration, '%Y-%m-%d').date()
                except ValueError:
                    return Response({'detail': 'Format de date d\'expiration invalide (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)
        elif stock_lot_id:
            try:
                stock_lot = StockLot.objects.select_for_update().get(pk=stock_lot_id, produit=produit)
            except StockLot.DoesNotExist:
                return Response({'detail': 'Lot introuvable'}, status=status.HTTP_400_BAD_REQUEST)

        quantity_before = produit.stock
        adjust_rayon = new_quantity is not None
        if new_quantity is None:
            new_quantity = quantity_before
        quantity_change = new_quantity - quantity_before

        reserve_before = produit.stock_reserve or 0
        adjust_reserve = new_reserve_quantity is not None
        if new_reserve_quantity is None:
            new_reserve_quantity = reserve_before
        reserve_change = new_reserve_quantity - reserve_before

        # Un ajustement absolu écrit le stock physique. Le delta à reporter sur
        # les lots doit donc partir de la somme physique des lots, pas du
        # compteur produit qui peut déjà inclure une dette PROMIS/FORCE.
        rayon_lot_change = quantity_change
        reserve_lot_change = reserve_change
        if produit.use_lot_management:
            lot_totals = produit.stock_lots.aggregate(
                physical_rayon=Sum('quantity_remaining'),
                physical_reserve=Sum('quantity_reserved'),
            )
            rayon_lot_change = (
                new_quantity - (lot_totals['physical_rayon'] or 0)
                if adjust_rayon else 0
            )
            reserve_lot_change = (
                new_reserve_quantity - (lot_totals['physical_reserve'] or 0)
                if adjust_reserve else 0
            )

        if create_new_lot:
            if rayon_lot_change < 0 or reserve_lot_change < 0:
                return Response(
                    {'detail': 'Un nouveau lot ne peut pas absorber une diminution de stock.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            stock_lot = StockLot.objects.create(
                produit=produit,
                quantity_initial=0,
                quantity_paid=0,
                quantity_free=0,
                quantity_free_remaining=0,
                quantity_remaining=0,
                quantity_reserved=0,
                price_cost=produit.pmp or 0,
                selling_price=produit.selling_price or 0,
                lot=new_lot_number,
                date_expiration=new_lot_date_exp,
                date_reception=timezone.now(),
                is_divers=True
            )

        if stock_lot:
            if stock_lot.quantity_remaining + rayon_lot_change < 0:
                return Response(
                    {'detail': f'Le lot {stock_lot.lot} ne contient pas assez de stock rayon.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if stock_lot.quantity_reserved + reserve_lot_change < 0:
                return Response(
                    {'detail': f'Le lot {stock_lot.lot} ne contient pas assez de stock réserve.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        adjustment = StockAdjustment.objects.create(
            produit=produit, stock_lot=stock_lot, user=request.user,
            quantity_before=quantity_before, quantity_after=new_quantity, quantity_change=quantity_change,
            reserve_before=reserve_before, reserve_after=new_reserve_quantity, reserve_change=reserve_change,
            reason_type=reason_type, reason_detail=(reason_detail or '').strip()
        )
        
        if stock_lot:
            if rayon_lot_change != 0:
                stock_lot.quantity_remaining += rayon_lot_change
            if reserve_lot_change != 0:
                stock_lot.quantity_reserved += reserve_lot_change
            # Pour un nouveau lot, mettre à jour quantity_initial
            if create_new_lot:
                stock_lot.quantity_initial = stock_lot.quantity_remaining + stock_lot.quantity_reserved
                stock_lot.save(update_fields=['quantity_remaining', 'quantity_reserved', 'quantity_initial'])
            else:
                stock_lot.save(update_fields=['quantity_remaining', 'quantity_reserved'])
        elif produit.use_lot_management:
            # Aucun lot spécifique fourni : distribuer le delta physique sur
            # les lots existants pour atteindre la quantité comptée.
            today = timezone.now().date()

            if rayon_lot_change > 0:
                # Ajouter au lot le plus ancien non périmé (FEFO)
                target_lot = (
                    produit.stock_lots
                    .filter(Q(date_expiration__gte=today) | Q(date_expiration__isnull=True))
                    .order_by('date_expiration', 'date_reception')
                    .first()
                )
                if target_lot:
                    target_lot.quantity_remaining += rayon_lot_change
                    target_lot.save(update_fields=['quantity_remaining'])
                else:
                    # Aucun lot valide : créer un lot contenant uniquement le delta.
                    StockLot.objects.create(
                        produit=produit,
                        quantity_initial=rayon_lot_change,
                        quantity_paid=0,
                        quantity_free=0,
                        quantity_free_remaining=0,
                        quantity_remaining=rayon_lot_change,
                        quantity_reserved=0,
                        price_cost=produit.pmp or 0,
                        selling_price=produit.selling_price or 0,
                        lot=f"ADJ-{produit.id}-{today.strftime('%Y%m%d')}",
                        date_reception=timezone.now(),
                    )
            elif rayon_lot_change < 0:
                # Déduire des lots en FEFO (non périmés d'abord, puis périmés)
                lots_to_deduct = list(
                    produit.stock_lots
                    .filter(quantity_remaining__gt=0)
                    .order_by('date_expiration', 'date_reception')
                    .select_for_update()
                )
                remaining = -rayon_lot_change
                for lot in lots_to_deduct:
                    if remaining <= 0:
                        break
                    taken = min(lot.quantity_remaining, remaining)
                    lot.quantity_remaining -= taken
                    lot.save(update_fields=['quantity_remaining'])
                    remaining -= taken

            if reserve_lot_change > 0:
                target_lot = (
                    produit.stock_lots
                    .order_by('date_expiration', 'date_reception')
                    .first()
                )
                if target_lot:
                    target_lot.quantity_reserved += reserve_lot_change
                    target_lot.save(update_fields=['quantity_reserved'])
            elif reserve_lot_change < 0:
                lots_to_deduct = list(
                    produit.stock_lots
                    .filter(quantity_reserved__gt=0)
                    .order_by('date_expiration', 'date_reception')
                    .select_for_update()
                )
                remaining = -reserve_lot_change
                for lot in lots_to_deduct:
                    if remaining <= 0:
                        break
                    taken = min(lot.quantity_reserved, remaining)
                    lot.quantity_reserved -= taken
                    lot.save(update_fields=['quantity_reserved'])
                    remaining -= taken

            # Le signal a recalculé produit.stock depuis les lots.
            # Rafraîchir pour avoir la valeur cohérente.
            produit.refresh_from_db()

        # L'ajustement manuel est une valeur absolue. Les promis restent en
        # attente, mais ne sont plus retranchés du nouveau compteur physique.
        if adjust_rayon:
            StockObligationService.mark_unapplied_after_absolute_stock_reset(
                [produit.id], StockObligation.StockLocation.RAYON
            )
        if adjust_reserve:
            StockObligationService.mark_unapplied_after_absolute_stock_reset(
                [produit.id], StockObligation.StockLocation.RESERVE
            )
        produit.stock = new_quantity
        produit.stock_reserve = new_reserve_quantity
        produit.version += 1
        produit.save(update_fields=['stock', 'stock_reserve', 'version'])
        
        type_mv = MouvementStock.TypeMouvement.AJUSTEMENT
        if quantity_change == -reserve_change and quantity_change != 0:
            type_mv = MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK
            
        MouvementStock.objects.create(
            produit=produit, type_mouvement=type_mv,
            quantite=quantity_change + reserve_change, stock_apres=produit.total_stock,
            user=validation_user, description=f"Ajustement manuel: {reason_detail or reason_type}. Rayon: {quantity_change:+d}, Réserve: {reserve_change:+d}"
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

        notify_stock_changed([produit.id])
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

        produit = Produit.objects.select_for_update().get(pk=self.kwargs['pk'])
        StockObligationService.reapply_pending_obligations([produit.id])
        produit.refresh_from_db(fields=['stock', 'stock_reserve'])
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

        lots = produit.stock_lots.filter(quantity_reserved__gt=0).select_for_update().order_by('date_reception')
        transferred_lots = []
        remaining_to_transfer = quantity
        for lot in lots:
            if remaining_to_transfer <= 0: break
            transfer_qty = min(remaining_to_transfer, lot.quantity_reserved)
            lot.quantity_reserved -= transfer_qty
            lot.quantity_remaining += transfer_qty
            lot.save(update_fields=['quantity_reserved', 'quantity_remaining'])
            transferred_lots.append(lot)
            remaining_to_transfer -= transfer_qty

        if remaining_to_transfer > 0:
            return Response({'detail': f"Quantité réellement transférable ({quantity - remaining_to_transfer}) inférieure à la demande."}, status=status.HTTP_400_BAD_REQUEST)

        if produit.use_lot_management:
            # Les lot.save() ont déjà recalculé stock/stock_reserve.
            produit.refresh_from_db(fields=['stock', 'stock_reserve'])
        else:
            produit.stock += quantity
            produit.stock_reserve -= quantity
        oldest_shelf_lot = produit.stock_lots.filter(quantity_remaining__gt=0).order_by('date_reception').first()
        if oldest_shelf_lot:
            produit.selling_price = oldest_shelf_lot.selling_price
            produit.expire_date = oldest_shelf_lot.date_expiration

        produit.save(update_fields=['stock', 'stock_reserve', 'selling_price', 'expire_date'])

        # Les unités transférées en rayon doivent couvrir en priorité les
        # promis/dettes déjà facturés au lieu de devenir revendables.
        StockObligationService.resolve_pending_obligations(
            produit,
            available_quantity=quantity,
            lots=transferred_lots if produit.use_lot_management else None,
            user=validation_user,
            movement_description='Réappro rayon - résolution dette de stock',
            lot_field='quantity_remaining',
            stock_location=StockObligation.StockLocation.RAYON,
        )
        produit.refresh_from_db(fields=['stock', 'stock_reserve'])
        
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

        notify_stock_changed([produit.id])
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
            
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_adjust_stock')
        if error_res:
            return error_res

        results = []
        transferred_ids = []
        with transaction.atomic():
            session = ReapproSession.objects.create(user=request.user, total_products=0, total_units=0)
            for pid in product_ids:
                try:
                    produit = Produit.objects.select_for_update().get(pk=pid, has_reserve_storage=True)
                    StockObligationService.reapply_pending_obligations([produit.id])
                    produit.refresh_from_db(fields=['stock', 'stock_reserve'])
                    needed = max(0, produit.capacite_rayon - produit.stock)
                    quantity = min(needed, produit.stock_reserve)
                    
                    if quantity <= 0: continue

                    lots = produit.stock_lots.filter(quantity_reserved__gt=0).select_for_update().order_by('date_expiration', 'id')
                    transferred_lots = []
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
                        transferred_lots.append(lot)
                        remaining_to_transfer -= can_take

                    if remaining_to_transfer > 0:
                        quantity -= remaining_to_transfer

                    if produit.use_lot_management:
                        produit.refresh_from_db(fields=['stock', 'stock_reserve'])
                    else:
                        produit.stock += quantity
                        produit.stock_reserve -= quantity
                    oldest_shelf_lot = produit.stock_lots.filter(quantity_remaining__gt=0).order_by('date_reception').first()
                    if oldest_shelf_lot:
                        produit.selling_price = oldest_shelf_lot.selling_price
                        produit.expire_date = oldest_shelf_lot.date_expiration
                    produit.version += 1
                    produit.save(update_fields=['stock', 'stock_reserve', 'selling_price', 'expire_date', 'version'])
                    StockObligationService.resolve_pending_obligations(
                        produit,
                        available_quantity=quantity,
                        lots=transferred_lots if produit.use_lot_management else None,
                        user=validation_user,
                        movement_description=f'Réappro groupée #{session.id} - résolution dette de stock',
                        lot_field='quantity_remaining',
                        stock_location=StockObligation.StockLocation.RAYON,
                    )
                    produit.refresh_from_db(fields=['stock', 'stock_reserve'])
                    
                    MouvementStock.objects.create(
                        produit=produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK,
                        quantite=quantity, stock_apres=produit.total_stock, user=validation_user,
                        description=f"Transfert groupé (Session #{session.id}): {quantity} unités du stock réserve vers le rayon."
                    )
                    
                    session.total_products += 1
                    session.total_units += quantity
                    transferred_ids.append(pid)
                    results.append({'id': pid, 'success': True, 'transferred': quantity})
                except Exception as e:
                    results.append({'id': pid, 'success': False, 'error': str(e)})

            notify_stock_changed(transferred_ids)
            if session.total_products > 0: session.save(update_fields=['total_products', 'total_units'])
            else: session.delete()

        return Response({'detail': f"{len([r for r in results if r['success']])} produits réapprovisionnés.", 'results': results, 'session_id': session.id if getattr(session, 'id', None) else None})
