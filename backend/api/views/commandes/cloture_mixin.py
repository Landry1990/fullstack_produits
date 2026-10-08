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
from django.db.models import DecimalField, F, Sum
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
    FactureProduitAllocation,
    MouvementStock,
    PaiementFournisseur,
    Produit,
    Promis,
    StockLot,
    StockObligation,
    StockObligationResolution,
)
from ...optimistic_locking import ConcurrentModificationError
from ...services.realtime import notify_stock_changed
from ...services.stock_obligation_service import StockObligationService
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
                    pending_obligations_map = {}
                    for row in StockObligation.objects.filter(
                        produit_id__in=product_ids,
                        status=StockObligation.Status.EN_ATTENTE,
                        stock_applied=True,
                    ).values('produit_id', 'stock_location').annotate(
                        total=Sum('quantity_remaining')
                    ):
                        pending_obligations_map[(row['produit_id'], row['stock_location'])] = row['total'] or 0

                    untracked_deficit_map = {}
                    for produit in products:
                        location = (
                            StockObligation.StockLocation.RESERVE
                            if produit.has_reserve_storage
                            else StockObligation.StockLocation.RAYON
                        )
                        relevant_stock = (
                            Decimal(produit.stock_reserve or 0)
                            if produit.has_reserve_storage
                            else Decimal(produit.stock)
                        )
                        if relevant_stock < 0:
                            untracked_deficit_map[produit.id] = max(
                                Decimal(0),
                                -relevant_stock - Decimal(
                                    pending_obligations_map.get((produit.id, location), 0)
                                )
                            )
                    
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

                            if new_total_qty > 0 and qty_received > 0:
                                if old_stock > 0:
                                    new_pmp = (old_stock * old_pmp + cout_total) / new_total_qty
                                else:
                                    # Stock négatif (vente à découvert sans promis) :
                                    # le stock restant provient entièrement de cette réception.
                                    # La moyenne pondérée diviserait par un total proche de 0
                                    # et produirait un PMP égal au coût total de la ligne.
                                    new_pmp = effective_cost
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

                            if new_total_qty > 0 and qty_received > 0:
                                if current_stock > 0:
                                    new_pmp = (current_stock * current_pmp + cout_total) / new_total_qty
                                else:
                                    # Même garde que ci-dessus : stock encore négatif
                                    # -> le reliquat vient entièrement de cette ligne.
                                    new_pmp = effective_cost
                                existing_produit.pmp = new_pmp
                            
                            if existing_produit.has_reserve_storage:
                                existing_produit.stock_reserve = Decimal(existing_produit.stock_reserve or 0) + Decimal(total_qty)
                            else:
                                existing_produit.stock += Decimal(total_qty)
                    
                    # Capturer le stock APRES réception pour chaque ligne
                    items_to_update_stock = []
                    received_qty_by_product = {}
                    for item in items:
                        produit = product_map.get(item.produit_id)
                        if produit:
                            item.stock_apres_reception = int(produit.stock) if not produit.has_reserve_storage else int(produit.stock_reserve or 0)
                            items_to_update_stock.append(item)
                            received_qty_by_product[item.produit_id] = (
                                received_qty_by_product.get(item.produit_id, 0)
                                + item.quantity + item.unites_gratuites
                            )
                    
                    # Phase 2: Écritures en base avec optimistic locking
                    
                    # 2.1 Créer tous les lots et mettre à jour stock_apres_reception
                    if lots_to_create:
                        StockLot.objects.bulk_create(lots_to_create, batch_size=100)
                        items_with_lot = [item for item in items if item.lot]
                        if items_with_lot:
                            CommandeProduit.objects.bulk_update(items_with_lot, ['lot'], batch_size=100)

                    created_lots_by_produit = {}
                    for lot in lots_to_create:
                        created_lots_by_produit.setdefault(lot.produit_id, []).append(lot)

                    # 2.1b Satisfaire les obligations de stock avec la quantité reçue.
                    # Les promis passent en premier, puis les anciennes ventes forcées.
                    for produit_id, received_quantity in received_qty_by_product.items():
                        produit = product_map.get(produit_id)
                        if not produit or received_quantity <= 0:
                            continue

                        prod_lots = created_lots_by_produit.get(produit_id, [])
                        resolved_quantity = StockObligationService.resolve_pending_obligations(
                            produit,
                            available_quantity=int(received_quantity),
                            lots=prod_lots,
                            user=request.user,
                            commande=commande,
                            movement_description=f"Résolution dette de stock - commande #{commande.id}",
                        )

                        # Compatibilité : absorber ensuite un ancien déficit qui
                        # n'aurait pas encore de StockObligation associée.
                        remaining_received = Decimal(received_quantity) - Decimal(resolved_quantity or 0)
                        deficit_to_absorb = min(
                            untracked_deficit_map.get(produit_id, Decimal(0)),
                            remaining_received,
                        )
                        if produit.use_lot_management and deficit_to_absorb > 0:
                            for lot in prod_lots:
                                if deficit_to_absorb <= 0:
                                    break
                                available = (
                                    Decimal(lot.quantity_reserved)
                                    if produit.has_reserve_storage
                                    else Decimal(lot.quantity_remaining)
                                )
                                if available <= 0:
                                    continue
                                absorbed = min(available, deficit_to_absorb)
                                if produit.has_reserve_storage:
                                    lot.quantity_reserved -= absorbed
                                else:
                                    lot.quantity_remaining -= absorbed
                                    if lot.quantity_free_remaining > 0:
                                        lot.quantity_free_remaining -= min(
                                            absorbed, Decimal(lot.quantity_free_remaining)
                                        )
                                deficit_to_absorb -= absorbed
                            StockLot.objects.bulk_update(
                                prod_lots,
                                ['quantity_remaining', 'quantity_free_remaining', 'quantity_reserved'],
                                batch_size=100,
                            )
                            produit.calculate_stock_from_lots()
                        untracked_deficit_map[produit_id] = deficit_to_absorb

                    # Recalcul final depuis les lots, en conservant les dettes
                    # encore appliquées au compteur produit.
                    prods_to_resync = {
                        lot.produit_id
                        for lot in lots_to_create
                        if lot.produit_id
                    }
                    for pid in prods_to_resync:
                        prod = product_map.get(pid)
                        if prod and prod.use_lot_management:
                            prod.calculate_stock_from_lots()

                    if items_to_update_stock:
                        # Recalculer stock_apres_reception après resync
                        for item in items_to_update_stock:
                            produit = product_map.get(item.produit_id)
                            if produit:
                                item.stock_apres_reception = int(produit.stock) if not produit.has_reserve_storage else int(produit.stock_reserve or 0)
                        CommandeProduit.objects.bulk_update(items_to_update_stock, ['stock_apres_reception'], batch_size=100)
                    
                    # 2.2 Mettre à jour les produits avec incrémentation de version
                    if produits_to_update:
                        final_stock_values = {
                            pid: (stock, stock_reserve)
                            for pid, stock, stock_reserve in Produit.objects.filter(
                                id__in=prods_to_resync
                            ).values_list('id', 'stock', 'stock_reserve')
                        }
                        for p in produits_to_update:
                            if p.id in final_stock_values:
                                p.stock, p.stock_reserve = final_stock_values[p.id]
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

                    # 2.7 Log d'audit — un seul log de synthèse par clôture
                    # (une commande peut contenir des centaines de lignes)
                    log_audit(
                        user=request.user,
                        action=AuditLog.Action.ORDER_RECEIVE,
                        model_name='Commande',
                        object_id=str(commande.id),
                        description=f"Réception commande #{commande.id} : {len(produits_to_update)} produit(s) mis à jour (stock/PMP), {len(lots_to_create)} lot(s) créé(s)",
                        details={
                            'produits_count': len(produits_to_update),
                            'lots_count': len(lots_to_create),
                            'produit_ids': [p.id for p in produits_to_update][:50],
                        },
                        request=request
                    )

                    business_logger.info(
                        f"[COMMANDE] Cloture OK #{commande.id} | "
                        f"produits={len(product_ids)} | lots={len(lots_to_create)} | user={request.user.username}"
                    )
                    notify_stock_changed(received_qty_by_product.keys())
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

        # Rouvrir d'abord les obligations que cette réception avait couvertes.
        # Elles ne sont pas des ventes : l'annulation doit remettre la dette en
        # attente au lieu de bloquer la suppression des lots.
        obligation_allocations = list(
            FactureProduitAllocation.objects.filter(resolved_commande=commande)
            .select_related(
                'stock_obligation', 'stock_obligation__promis',
                'stock_obligation__produit', 'stock_lot', 'stock_lot__commande_produit'
            )
        )
        for alloc in obligation_allocations:
            obligation = alloc.stock_obligation
            if not obligation:
                continue
            obligation.quantity_remaining += alloc.quantity
            obligation.status = StockObligation.Status.EN_ATTENTE
            obligation.resolved_at = None
            obligation.resolved_by = None
            obligation.resolved_stock_lot = None
            obligation.save(update_fields=[
                'quantity_remaining', 'status', 'resolved_at',
                'resolved_by', 'resolved_stock_lot'
            ])

            lot = alloc.stock_lot
            lot_from_commande = (
                lot is not None and lot.commande_produit_id is not None
                and lot.commande_produit.commande_id == commande.id
            )
            if lot is not None and not lot_from_commande:
                if obligation.stock_location == StockObligation.StockLocation.RESERVE:
                    lot.quantity_reserved += alloc.quantity
                    lot.save(update_fields=['quantity_reserved'])
                else:
                    lot.quantity_remaining += alloc.quantity
                    if alloc.quantity_free:
                        lot.quantity_free_remaining = min(
                            lot.quantity_free,
                            lot.quantity_free_remaining + alloc.quantity_free,
                        )
                    lot.save(update_fields=['quantity_remaining', 'quantity_free_remaining'])

            promis = obligation.promis
            if promis:
                promis.quantite_livree = max(0, (promis.quantite_livree or 0) - alloc.quantity)
                promis.status = Promis.Status.EN_ATTENTE
                promis.date_livraison = None
                promis.save(update_fields=['quantite_livree', 'status', 'date_livraison'])

            produit = obligation.produit
            if produit and not produit.use_lot_management and not obligation.stock_applied:
                # La résolution d'une dette non appliquée avait sorti le stock.
                # On l'annule avant de retirer la réception elle-même.
                if obligation.stock_location == StockObligation.StockLocation.RESERVE:
                    Produit.objects.filter(pk=produit.pk).update(stock_reserve=F('stock_reserve') + alloc.quantity)
                else:
                    Produit.objects.filter(pk=produit.pk).update(stock=F('stock') + alloc.quantity)
            alloc.delete()

        # Les promis manuels/historiques n'ont pas toujours de ligne de facture.
        # Leur résolution est donc tracée séparément et doit aussi être rouverte.
        orphan_resolutions = list(
            StockObligationResolution.objects.filter(
                commande=commande,
                obligation__facture_produit__isnull=True,
            ).select_related(
                'obligation', 'obligation__promis', 'obligation__produit',
                'stock_lot', 'stock_lot__commande_produit'
            )
        )
        for resolution in orphan_resolutions:
            obligation = resolution.obligation
            obligation.quantity_remaining += resolution.quantity
            obligation.status = StockObligation.Status.EN_ATTENTE
            obligation.resolved_at = None
            obligation.resolved_by = None
            obligation.resolved_stock_lot = None
            obligation.save(update_fields=[
                'quantity_remaining', 'status', 'resolved_at',
                'resolved_by', 'resolved_stock_lot'
            ])

            lot = resolution.stock_lot
            lot_from_commande = (
                lot is not None and lot.commande_produit_id is not None
                and lot.commande_produit.commande_id == commande.id
            )
            if lot is not None and not lot_from_commande:
                if obligation.stock_location == StockObligation.StockLocation.RESERVE:
                    lot.quantity_reserved += resolution.quantity
                    lot.save(update_fields=['quantity_reserved'])
                else:
                    lot.quantity_remaining += resolution.quantity
                    if resolution.quantity_free:
                        lot.quantity_free_remaining = min(
                            lot.quantity_free,
                            lot.quantity_free_remaining + resolution.quantity_free,
                        )
                    lot.save(update_fields=['quantity_remaining', 'quantity_free_remaining'])

            promis = obligation.promis
            if promis:
                promis.quantite_livree = max(0, (promis.quantite_livree or 0) - resolution.quantity)
                promis.status = Promis.Status.EN_ATTENTE
                promis.date_livraison = None
                promis.save(update_fields=['quantite_livree', 'status', 'date_livraison'])

            produit = obligation.produit
            if produit and not produit.use_lot_management and not obligation.stock_applied:
                if obligation.stock_location == StockObligation.StockLocation.RESERVE:
                    Produit.objects.filter(pk=produit.pk).update(stock_reserve=F('stock_reserve') + resolution.quantity)
                else:
                    Produit.objects.filter(pk=produit.pk).update(stock=F('stock') + resolution.quantity)

        StockObligationResolution.objects.filter(commande=commande).delete()

        # Les réintégrations de dettes non appliquées ont pu modifier le compteur
        # via F() sur une autre instance Produit. On resynchronise les objets
        # verrouillés avant le retrait de la réception elle-même.
        for produit in product_map.values():
            produit.refresh_from_db(fields=['stock', 'stock_reserve'])

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
                # Les stocks négatifs peuvent être légitimes (promis / vente
                # forcée) : l'annulation retire simplement la quantité reçue.
                produit.stock = old_stock - qty_to_remove
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
        notify_stock_changed(produits_dict.keys())
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

