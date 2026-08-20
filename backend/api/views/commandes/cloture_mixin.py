"""Mixin pour les opérations de clôture et annulation de réception.

Extrait de commandes.py pour séparer la logique métier complexe de clôture
(mise à jour stock, PMP, lots, promis, mouvements) du ViewSet principal.
"""
import logging
import time
from datetime import date, timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.db.models import DecimalField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...idempotency import idempotent_action
from ...models import (
    AuditLog,
    Commande,
    CommandeProduit,
    FactureProduit,
    FactureProduitAllocation,
    MouvementStock,
    PaiementFournisseur,
    Produit,
    Promis,
    StockLot,
)
from ...optimistic_locking import ConcurrentModificationError
from ...sudo_utils import validate_sudo_mode

logger = logging.getLogger(__name__)
business_logger = logging.getLogger('api.business')


class CommandeClotureMixin:
    """Mixin: clôture et annulation de réception des commandes."""

    @action(detail=True, methods=['post'])
    @idempotent_action
    def cloturer(self, request, pk=None):
        """
        Clôture une commande avec Optimistic Locking (sans select_for_update).
        Met à jour le stock et calcule le PMP avec vérification de versions.
        """
        import time

        from django.db import transaction

        from ...optimistic_locking import ConcurrentModificationError
        
        max_retries = 3
        expected_versions = {}
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    commande = self.get_object()
                    
                    if commande.status == Commande.Status.CLOTUREE:
                        return Response({'detail': 'Cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

                    # Validation Sudo
                    _validation_user, error_res = validate_sudo_mode(request, permission_attr='can_close_commande')
                    if error_res:
                        return error_res

                    # Enregistrer l'utilisateur qui clôture
                    commande.closed_by = request.user
                    commande.date_cloture = timezone.now()

                    # Prefetch tous les produits
                    items = list(commande.produits.select_related('produit', 'produit__fournisseur').all())
                    
                    if not items:
                        return Response({'detail': 'Aucun produit dans cette commande.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # OPTIMISTIC LOCKING: Récupérer produits sans verrou
                    product_ids = [item.produit_id for item in items]
                    products = list(Produit.objects.filter(id__in=product_ids))
                    product_map = {p.id: p for p in products}
                    
                    # Vérifier les versions si retry
                    if expected_versions:
                        conflicts = []
                        for pid, expected in expected_versions.items():
                            current = product_map.get(pid)
                            if current and current.version != expected:
                                conflicts.append(f"Produit {pid}: v{expected} -> v{current.version}")
                        if conflicts:
                            raise ConcurrentModificationError('CommandeCloture', commande.id, 0, attempt)
                    
                    # Sauvegarder versions pour vérification
                    initial_versions = {p.id: p.version for p in products}
                    
                    # Préparer les lots de stock à créer en batch
                    lots_to_create = []
                    produits_to_update = []
                    produits_dict = {}
                    
                    # Phase 1: Calculs en mémoire
                    for item in items:
                        quantity_paid = item.quantity
                        quantity_free = item.unites_gratuites
                        total_qty = quantity_paid + quantity_free
                        
                        if total_qty > 0:
                            effective_cost = (quantity_paid * item.price_cost) / total_qty
                        else:
                            effective_cost = item.price_cost
                        
                        produit = product_map.get(item.produit_id)
                        if not produit:
                            continue
                        
                        # Préparer le lot de stock
                        if produit.use_lot_management:
                            lot_number = item.lot
                            if not lot_number:
                                lot_number = f"CMD{commande.id}-{item.id}"
                                item.lot = lot_number
                            
                            lot = StockLot(
                                produit=produit,
                                commande_produit=item,
                                fournisseur=commande.fournisseur if commande.fournisseur else produit.fournisseur,
                                quantity_initial=total_qty,
                                quantity_paid=quantity_paid,
                                quantity_free=quantity_free,
                                quantity_free_remaining=quantity_free,
                                quantity_remaining=0 if produit.has_reserve_storage else total_qty,
                                quantity_reserved=total_qty if produit.has_reserve_storage else 0,
                                price_cost=effective_cost,
                                selling_price=produit.selling_price,
                                lot=lot_number,
                                date_expiration=item.date_expiration,
                                date_reception=commande.date_cloture,
                                is_divers=(commande.type == 'DIV' or (commande.fournisseur and commande.fournisseur.is_divers))
                            )
                            lots_to_create.append(lot)
                        
                        # Remplir automatiquement le fournisseur principal du produit s'il est vide
                        if not produit.fournisseur and commande.fournisseur:
                            produit.fournisseur = commande.fournisseur
                        
                        # Calculer le nouveau PMP et stock
                        if produit.id not in produits_dict:
                            old_stock = Decimal(produit.stock) + Decimal(produit.stock_reserve or 0)
                            old_pmp = Decimal(produit.pmp)
                            qty_received = Decimal(total_qty)
                            cout_total = Decimal(quantity_paid) * Decimal(item.price_cost)
                            
                            new_total_qty = old_stock + qty_received
                            
                            if new_total_qty > 0:
                                current_val = old_stock * old_pmp
                                incoming_val = cout_total
                                new_pmp = (current_val + incoming_val) / new_total_qty
                                produit.pmp = new_pmp
                            
                            res_stock = Decimal(produit.stock_reserve or 0)
                            if produit.has_reserve_storage:
                                produit.stock_reserve = res_stock + qty_received
                            else:
                                produit.stock = Decimal(produit.stock) + qty_received
                            
                            produits_dict[produit.id] = produit
                            produits_to_update.append(produit)
                        else:
                            existing_produit = produits_dict[produit.id]
                            current_stock = Decimal(existing_produit.stock) + Decimal(existing_produit.stock_reserve or 0)
                            current_pmp = Decimal(existing_produit.pmp)
                            qty_received = Decimal(total_qty)
                            cout_total = Decimal(quantity_paid) * Decimal(item.price_cost)
                            
                            new_total_qty = current_stock + qty_received
                            
                            if new_total_qty > 0:
                                current_val = current_stock * current_pmp
                                incoming_val = cout_total
                                new_pmp = (current_val + incoming_val) / new_total_qty
                                existing_produit.pmp = new_pmp
                            
                            if existing_produit.has_reserve_storage:
                                existing_produit.stock_reserve = Decimal(existing_produit.stock_reserve or 0) + Decimal(total_qty)
                            else:
                                existing_produit.stock += Decimal(total_qty)
                    
                    # Capturer le stock APRES réception pour chaque ligne
                    items_to_update_stock = []
                    for item in items:
                        produit = product_map.get(item.produit_id)
                        if produit:
                            item.stock_apres_reception = int(produit.stock) if not produit.has_reserve_storage else int(produit.stock_reserve or 0)
                            items_to_update_stock.append(item)
                    
                    # Phase 2: Écritures en base avec optimistic locking
                    
                    # 2.1 Créer tous les lots et mettre à jour stock_apres_reception
                    promis_allocations_to_create = []
                    promis_to_update = []
                    promis_mouvements_to_create = []
                    if lots_to_create:
                        StockLot.objects.bulk_create(lots_to_create, batch_size=100)
                        items_with_lot = [item for item in items if item.lot]
                        if items_with_lot:
                            CommandeProduit.objects.bulk_update(items_with_lot, ['lot'], batch_size=100)

                        # 2.1b Satisfaire les promis en attente avec les lots nouvellement créés
                        created_lots_by_produit = {}
                        for lot in lots_to_create:
                            created_lots_by_produit.setdefault(lot.produit_id, []).append(lot)

                        # Récupérer les lots fraîchement créés (ils ont maintenant un ID)
                        new_lot_ids = [lot.id for lot in lots_to_create]
                        fresh_lots = {lot.id: lot for lot in StockLot.objects.filter(id__in=new_lot_ids)}
                        for lot in lots_to_create:
                            fresh = fresh_lots.get(lot.id)
                            if fresh:
                                lot.id = fresh.id

                        for produit_id, prod_lots in created_lots_by_produit.items():
                            pending_promis = list(Promis.objects.filter(
                                produit_id=produit_id,
                                status=Promis.Status.EN_ATTENTE,
                                is_active=True
                            ).select_related('facture'))

                            for promis in pending_promis:
                                qty_to_satisfy = promis.quantite
                                if qty_to_satisfy <= 0:
                                    continue

                                # Trouver les FactureProduit de la facture du promis pour ce produit
                                fp_items = list(FactureProduit.objects.filter(
                                    facture=promis.facture,
                                    produit_id=produit_id
                                ))

                                for lot in prod_lots:
                                    if qty_to_satisfy <= 0:
                                        break
                                    # Pour les produits avec réserve, le stock est en quantity_reserved
                                    # Pour les autres, il est en quantity_remaining
                                    prod = product_map.get(produit_id)
                                    if prod and prod.has_reserve_storage:
                                        available = lot.quantity_reserved
                                    else:
                                        available = lot.quantity_remaining
                                    if available <= 0:
                                        continue
                                    qty_from_lot = min(available, qty_to_satisfy)

                                    if prod and prod.has_reserve_storage:
                                        lot.quantity_reserved -= qty_from_lot
                                    else:
                                        lot.quantity_remaining -= qty_from_lot
                                        if lot.quantity_free_remaining > 0:
                                            lot.quantity_free_remaining -= min(qty_from_lot, lot.quantity_free_remaining)

                                    # Créer une allocation pour tracer le lien promis → lot
                                    for fp in fp_items:
                                        promis_allocations_to_create.append(FactureProduitAllocation(
                                            facture_produit=fp,
                                            stock_lot=lot,
                                            quantity=qty_from_lot,
                                            cost_price=lot.price_cost,
                                            selling_price=fp.selling_price
                                        ))

                                    qty_to_satisfy -= qty_from_lot

                                if qty_to_satisfy <= 0:
                                    promis.status = Promis.Status.DELIVRE
                                    promis.date_livraison = timezone.now()
                                    promis_to_update.append(promis)

                                    produit = product_map.get(produit_id)
                                    promis_mouvements_to_create.append(MouvementStock(
                                        produit=produit,
                                        type_mouvement=MouvementStock.TypeMouvement.SORTIE,
                                        quantite=-promis.quantite,
                                        stock_apres=None,
                                        user=request.user,
                                        description=f"Satisfaction Promis #{promis.id} lors réception commande #{commande.id}"
                                    ))

                        # Appliquer les mises à jour de lots
                        lots_with_promis = [lot for lot in lots_to_create if lot.quantity_remaining < lot.quantity_initial or lot.quantity_reserved < lot.quantity_initial]
                        if lots_with_promis:
                            StockLot.objects.bulk_update(lots_with_promis, ['quantity_remaining', 'quantity_free_remaining', 'quantity_reserved'], batch_size=100)

                        if promis_allocations_to_create:
                            FactureProduitAllocation.objects.bulk_create(promis_allocations_to_create, batch_size=100)

                        if promis_to_update:
                            Promis.objects.bulk_update(promis_to_update, ['status', 'date_livraison'], batch_size=100)

                        # promis_mouvements_to_create seront créés après resync (stock_apres correct)

                    # Resync stock depuis la somme des lots pour les produits gérés par lots
                    # (important après décrémentation promis pour cohérence stock général ↔ lots)
                    prods_to_resync = set()
                    prods_to_resync_reserve = set()
                    for lot in lots_to_create:
                        if lot.produit_id:
                            prod = product_map.get(lot.produit_id)
                            if prod and prod.use_lot_management:
                                if prod.has_reserve_storage:
                                    prods_to_resync_reserve.add(lot.produit_id)
                                else:
                                    prods_to_resync.add(lot.produit_id)
                    if prods_to_resync:
                        total_lots_sum = StockLot.objects.filter(
                            produit=OuterRef('pk')
                        ).order_by().values('produit').annotate(
                            total=Sum('quantity_remaining')
                        ).values('total')
                        Produit.objects.filter(id__in=prods_to_resync).update(
                            stock=Coalesce(Subquery(total_lots_sum), Value(0))
                        )
                        # P0: Single batch query instead of N individual Produit.objects.get()
                        resynced_stocks = dict(
                            Produit.objects.filter(id__in=prods_to_resync).values_list('id', 'stock')
                        )
                        for pid in prods_to_resync:
                            prod = product_map.get(pid)
                            if prod:
                                prod.stock = resynced_stocks.get(pid, prod.stock)
                    if prods_to_resync_reserve:
                        total_reserved_sum = StockLot.objects.filter(
                            produit=OuterRef('pk')
                        ).order_by().values('produit').annotate(
                            total=Sum('quantity_reserved')
                        ).values('total')
                        Produit.objects.filter(id__in=prods_to_resync_reserve).update(
                            stock_reserve=Coalesce(Subquery(total_reserved_sum), Value(0))
                        )
                        # P0: Single batch query instead of N individual Produit.objects.get()
                        resynced_reserves = dict(
                            Produit.objects.filter(id__in=prods_to_resync_reserve).values_list('id', 'stock_reserve')
                        )
                        for pid in prods_to_resync_reserve:
                            prod = product_map.get(pid)
                            if prod:
                                prod.stock_reserve = resynced_reserves.get(pid, prod.stock_reserve)

                    # Créer les mouvements de stock des promis après resync (stock_apres correct)
                    if promis_mouvements_to_create:
                        for mvt in promis_mouvements_to_create:
                            if mvt.produit_id:
                                prod = product_map.get(mvt.produit_id)
                                if prod:
                                    mvt.stock_apres = prod.total_stock
                        MouvementStock.objects.bulk_create(promis_mouvements_to_create, batch_size=100)

                    if items_to_update_stock:
                        # Recalculer stock_apres_reception après resync
                        for item in items_to_update_stock:
                            produit = product_map.get(item.produit_id)
                            if produit:
                                item.stock_apres_reception = int(produit.stock) if not produit.has_reserve_storage else int(produit.stock_reserve or 0)
                        CommandeProduit.objects.bulk_update(items_to_update_stock, ['stock_apres_reception'], batch_size=100)
                    
                    # 2.2 Mettre à jour les produits avec incrémentation de version
                    if produits_to_update:
                        # P0: Batch query for resynced values instead of N individual Produit.objects.get()
                        pids_to_resync = {p.id for p in produits_to_update if p.id in prods_to_resync}
                        pids_to_resync_reserve = {p.id for p in produits_to_update if p.id in prods_to_resync_reserve}
                        if pids_to_resync:
                            final_stocks = dict(Produit.objects.filter(id__in=pids_to_resync).values_list('id', 'stock'))
                        else:
                            final_stocks = {}
                        if pids_to_resync_reserve:
                            final_reserves = dict(Produit.objects.filter(id__in=pids_to_resync_reserve).values_list('id', 'stock_reserve'))
                        else:
                            final_reserves = {}
                        for p in produits_to_update:
                            if p.id in final_stocks:
                                p.stock = final_stocks[p.id]
                            if p.id in final_reserves:
                                p.stock_reserve = final_reserves[p.id]
                            p.version += 1
                        
                        update_fields = ['pmp', 'stock', 'stock_reserve', 'version']
                        Produit.objects.bulk_update(produits_to_update, update_fields, batch_size=100)
                    
                    # 2.3 Mettre à jour le statut de la commande
                    commande.status = Commande.Status.CLOTUREE
                    commande.date = commande.date_cloture
                    
                    if commande.numero_facture == 'REASSORT_AUTO':
                        commande.numero_facture = f"REASSORT_{commande.date_cloture.strftime('%Y%m%d_%H%M')}_{commande.id}"

                    # Calcul de l'échéance (gère aussi les achats de mise en place
                    # à condition négociée, cf. Commande.compute_date_echeance)
                    commande.date_echeance = commande.compute_date_echeance()

                    commande.save(update_fields=['status', 'date_cloture', 'date', 'date_echeance', 'numero_facture', 'closed_by'])

                    # Achat de mise en place réglé au comptant : enregistrer automatiquement
                    # le paiement fournisseur pour le montant total (certains grossistes ne
                    # font pas crédit du tout, la commande est réglée avant/à la clôture).
                    # Idempotent : on ne crée le paiement que s'il n'en existe déjà un pour
                    # cette commande (évite les doublons en cas de re-clôture après annulation
                    # de réception ou de retry de l'optimistic locking).
                    if commande.is_mise_en_place and commande.paye_a_la_cloture and commande.fournisseur:
                        existing_auto = PaiementFournisseur.objects.filter(
                            commandes=commande,
                            notes__startswith=f"Paiement automatique - achat au comptant / mise en place (Commande #{commande.id})"
                        ).exists()
                        if not existing_auto:
                            total_cost = CommandeProduit.objects.filter(commande=commande).aggregate(
                                total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
                            )['total'] or Decimal('0.00')
                            if total_cost > 0:
                                paiement = PaiementFournisseur.objects.create(
                                    fournisseur=commande.fournisseur,
                                    montant=total_cost,
                                    date_paiement=commande.date_cloture.date(),
                                    mode_paiement='ESP',
                                    created_by=request.user,
                                    notes=f"Paiement automatique - achat au comptant / mise en place (Commande #{commande.id})"
                                )
                                paiement.commandes.add(commande)
                    
                    # 2.4 Mettre à jour la date de dernier achat
                    today = date.today()
                    Produit.objects.filter(id__in=product_ids).update(dernier_achat=today)

                    # 2.5 Créer les mouvements de stock
                    mouvements_to_create = []
                    for item in items:
                        produit = product_map.get(item.produit_id)
                        if not produit:
                            continue
                        total_qty = item.quantity + item.unites_gratuites
                        fournisseur_name = commande.fournisseur.name if commande.fournisseur else (commande.fournisseur_nom or 'N/A')
                        mouvements_to_create.append(MouvementStock(
                            produit=produit,
                            type_mouvement=MouvementStock.TypeMouvement.ENTREE,
                            quantite=total_qty,
                            stock_apres=produit.total_stock,
                            user=request.user,
                            commande=commande,
                            description=f"Réception Fournisseur: {fournisseur_name} - Lot: {item.lot or 'N/A'}"
                        ))
                    
                    if mouvements_to_create:
                        MouvementStock.objects.bulk_create(mouvements_to_create, batch_size=100)

                    # 2.6 Invalider le cache
                    cache.delete('dashboard_stats')

                    # 2.7 Log d'audit
                    for p in produits_to_update:
                        log_audit(
                            user=request.user,
                            action=AuditLog.Action.UPDATE,
                            model_name='Produit',
                            object_id=str(p.id),
                            description=f"Stock/PMP mis à jour via clôture commande #{commande.id}",
                            details={'stock': str(p.stock), 'pmp': str(p.pmp)},
                            request=request
                        )

                    business_logger.info(
                        f"[COMMANDE] Cloture OK #{commande.id} | "
                        f"produits={len(product_ids)} | lots={len(lots_to_create)} | user={request.user.username}"
                    )
                    return Response({'status': 'Commande clôturée avec optimistic locking.', 'versions_updated': len(produits_to_update)})
                    
            except ConcurrentModificationError:
                if attempt == max_retries - 1:
                    return Response({
                        'detail': 'Conflit de concurrence détecté après plusieurs tentatives.',
                        'error_code': 'CONCURRENT_MODIFICATION',
                        'hint': 'Veuillez réessayer dans quelques secondes'
                    }, status=status.HTTP_409_CONFLICT)
                time.sleep(0.1 * (2 ** attempt))
                expected_versions = initial_versions  # Retry avec versions attendues
                continue
        
        return Response({'detail': 'Erreur inattendue lors de la clôture.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler_reception(self, request, pk=None):
        """
        Annule la réception d'une commande clôturée.
        - Retire le stock ajouté lors de la clôture
        - Supprime les lots de stock créés
        - Enregistre un ajustement de stock négatif
        - Repasse la commande en statut PREP
        """
        commande = self.get_object()
        business_logger.info(f"[COMMANDE] Annulation reception demandee #{commande.id} par {request.user.username}")
        
        if commande.status != Commande.Status.CLOTUREE:
            business_logger.warning(f"[COMMANDE] Annulation refusee #{commande.id} - status={commande.status}")
            return Response(
                {'detail': 'Seule une commande clôturée peut être annulée.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Récupérer tous les produits de la commande
        items = commande.produits.select_related('produit').all()
        
        if not items.exists():
            commande.status = Commande.Status.EN_PREPARATION
            commande.date_cloture = None
            commande.save(update_fields=['status', 'date_cloture'])
            return Response({'status': 'Commande vide, statut repassé en préparation.'})
        
        # Verrouiller les produits pour éviter les modifications concurrentes
        # TRÈS IMPORTANT: order_by('id') pour éviter les deadlocks en DB !
        product_ids = [item.produit_id for item in items]
        locked_products = list(Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id'))
        product_map = {p.id: p for p in locked_products}
        
        produits_dict = {}
        
        # Phase 1: Calculer les retraits de stock
        for item in items:
            quantity_paid = item.quantity
            quantity_free = item.unites_gratuites
            total_qty = quantity_paid + quantity_free
            
            produit = product_map.get(item.produit_id)
            if not produit:
                continue
            
            # Accumuler les quantités à retirer par produit
            if produit.id not in produits_dict:
                produits_dict[produit.id] = {
                    'produit': produit,
                    'qty_to_remove': Decimal(total_qty),
                    'items': [item]
                }
            else:
                produits_dict[produit.id]['qty_to_remove'] += Decimal(total_qty)
                produits_dict[produit.id]['items'].append(item)
        
        # Phase 2: Vérifier l'absence de ventes sur ces lots avant suppression
        lots_to_delete = StockLot.objects.filter(commande_produit__commande=commande)
        
        # Vérifier si un de ces lots est déjà utilisé dans une vente (via allocation)
        # On évite le ProtectedError brutal et on renvoie un message métier
        if FactureProduitAllocation.objects.filter(stock_lot__in=lots_to_delete).exists():
            business_logger.warning(f"[COMMANDE] Annulation refusee #{commande.id} - du stock a deja ete vendu")
            return Response(
                {'detail': 'Impossible d\'annuler la réception : une partie de cette commande a déjà été vendue.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        deleted_lots_count = lots_to_delete.count()
        lots_to_delete.delete()
        
        # Phase 3: Mettre à jour les stocks (recalcul depuis les lots pour les produits en gestion par lots)
        mouvements_to_create = []
        for data in produits_dict.values():
            produit = data['produit']
            qty_to_remove = data['qty_to_remove']
            
            if produit.use_lot_management:
                produit.calculate_stock_from_lots()
            else:
                old_stock = Decimal(produit.stock)
                new_stock = old_stock - qty_to_remove
                if new_stock < 0:
                    new_stock = Decimal(0)
                produit.stock = new_stock
                produit.save(update_fields=['stock'])
            
            # Créer un MouvementStock pour traçabilité
            mouvements_to_create.append(MouvementStock(
                produit=produit,
                type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                quantite=-int(qty_to_remove),  # Négatif car on retire
                stock_apres=int(produit.total_stock),
                user=request.user,
                commande=commande,
                description=f"Annulation réception commande #{commande.id}{' (' + commande.numero_facture + ')' if commande.numero_facture else ''}"
            ))
        
        # Phase 4: Créer les mouvements en bulk
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create, batch_size=100)
        
        # Phase 5: Mettre à jour le statut de la commande
        commande.status = Commande.Status.EN_PREPARATION
        commande.date_cloture = None
        commande.save(update_fields=['status', 'date_cloture'])

        # Supprimer le paiement automatique créé à la clôture si la commande
        # était un achat au comptant (paye_a_la_cloture). On identifie le
        # paiement par sa note, ce qui évite de supprimer un paiement manuel.
        if commande.is_mise_en_place and commande.paye_a_la_cloture:
            auto_paiements = PaiementFournisseur.objects.filter(
                commandes=commande,
                notes__startswith=f"Paiement automatique - achat au comptant / mise en place (Commande #{commande.id})"
            )
            auto_paiements.delete()
        
        # Log audit
        # Log audit
        log_audit(
            user=request.user,
            action=AuditLog.Action.ORDER_CANCEL,
            model_name='Commande',
            object_id=commande.id,
            description=f"Annulation réception commande #{commande.id}: stock retiré, {deleted_lots_count} lots supprimés",
            details={
                 'commande_id': commande.id,
                 'produits_affectes': len(produits_dict),
                 'lots_supprimes': deleted_lots_count
            },
            request=request
        )
        
        business_logger.info(
            f"[COMMANDE] Annulation reception OK #{commande.id} | "
            f"produits={len(produits_dict)} | lots_supprimes={deleted_lots_count} | user={request.user.username}"
        )
        return Response({
            'status': 'Réception annulée avec succès.',
            'details': {
                'produits_affectes': len(produits_dict),
                'lots_supprimes': deleted_lots_count,
                'nouveau_statut': 'En préparation'
            }
        })

    @action(detail=True, methods=['get'])
    def transformations_disponibles(self, request, pk=None):
        """Retourne les produits de la commande qui ont une relation de
        transformation (reconditionnement) active, avec la quantité reçue
        et le stock source actuel.

        Permet au frontend de proposer un reconditionnement automatique
        après la clôture de la commande.
        """
        from ...models import RelationTransformation

        commande = self.get_object()

        if commande.status != Commande.Status.CLOTUREE:
            return Response(
                {'detail': 'La commande doit être clôturée pour proposer un reconditionnement.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = list(
            commande.produits.select_related('produit').all()
        )
        if not items:
            return Response({'count': 0, 'items': []})

        # Produit source → quantité totale reçue dans cette commande
        source_qty_map = {}
        produit_map = {}
        for item in items:
            if not item.produit_id:
                continue
            total_qty = item.quantity + item.unites_gratuites
            if total_qty <= 0:
                continue
            source_qty_map[item.produit_id] = source_qty_map.get(item.produit_id, 0) + total_qty
            produit_map[item.produit_id] = item.produit

        if not source_qty_map:
            return Response({'count': 0, 'items': []})

        relations = RelationTransformation.objects.filter(
            actif=True,
            produit_source_id__in=list(source_qty_map.keys()),
        ).select_related('produit_source', 'produit_destination')

        items_result = []
        for rel in relations:
            source = rel.produit_source
            dest = rel.produit_destination
            qty_recue = source_qty_map.get(source.id, 0)
            # Quantité reconditionnable = min(qty reçue, stock actuel)
            # (le stock actuel peut être < qty reçue si des ventes ont eu lieu)
            stock_source = int(source.stock)
            qty_transformable = min(qty_recue, stock_source)
            if qty_transformable <= 0:
                continue
            from decimal import Decimal
            qty_dest_obtained = int(Decimal(str(qty_transformable)) * Decimal(str(rel.ratio)))
            items_result.append({
                'relation_id': rel.id,
                'source_id': source.id,
                'source_name': source.name,
                'source_cip': source.cip1 or '',
                'source_stock': stock_source,
                'qty_recue': qty_recue,
                'qty_transformable': qty_transformable,
                'destination_id': dest.id,
                'destination_name': dest.name,
                'destination_stock': int(dest.stock),
                'ratio': float(rel.ratio),
                'qty_dest_obtained': qty_dest_obtained,
            })

        return Response({'count': len(items_result), 'items': items_result})

