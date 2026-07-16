from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db import transaction, models
from django.db.utils import DataError
from django.db.models import F, Sum, Value
from django.utils import timezone
from django.core.cache import cache
import logging

from ..models import (
    Facture, FactureProduit, FactureProduitAllocation, Caisse, 
    Produit, StockLot, LoyaltySetting, Promis, Ordonnancier, 
    LigneOrdonnancier, MouvementStock, get_next_ticket_session,
    CouponMonnaie, DepotClient, AuditLog
)
from ..audit_helpers import log_audit
from .promotion_service import PromotionService

logger = logging.getLogger(__name__)


class SalesService:
    @staticmethod
    @transaction.atomic
    def finalize_sale(user, data, centralized=True, image_file=None):
        """
        Atomic implementation of sale finalization.
        Creates Facture, FactureProduit, Promis, Ordonnancier, and handles validation.
        """
        # 1. Extract data
        client_id = data.get('client')
        client_name_override = data.get('client_name_override')
        ayant_droit_id = data.get('ayant_droit')
        try:
            remise_montant = Decimal(str(data.get('remise', '0') or '0'))
        except (InvalidOperation, ValueError):
            remise_montant = Decimal('0')
        produits_data = data.get('produits') or []
        paiements_data = data.get('paiements', [])
        loyalty_data = data.get('loyalty', {})
        ordonnance_data = data.get('ordonnance')
        coupon_numero = data.get('coupon_numero')
        validation_user = data.get('validation_user') or user

        if not isinstance(produits_data, list) or not produits_data:
            raise ValueError("La liste des produits ne peut pas être vide.")

        # Vérification poste de vente actif obligatoire
        from ..models import PosteVente
        poste_vente_id = data.get('poste_vente_id')
        poste_vente = None
        
        if poste_vente_id:
            # Vérifier que le poste de vente existe et est actif
            poste_vente = PosteVente.objects.filter(
                id=poste_vente_id,
                est_actif=True
            ).select_related('caisse', 'vendeur').first()

            if not poste_vente:
                raise ValueError(
                    "Le point de vente sélectionné n'est pas actif ou n'existe pas. "
                    "Veuillez ouvrir un point de vente avant de réaliser une vente."
                )

            # Vérifier que l'utilisateur courant est celui qui a ouvert le poste de vente
            # (sauf en mode caisse centralisée où les POS envoient vers la caisse de la caissière,
            #  et sauf pour les superusers)
            if not centralized and poste_vente.vendeur != user and not user.is_superuser:
                raise ValueError(
                    f"Seul {poste_vente.vendeur.username} (qui a ouvert ce point de vente) "
                    f"peut encaisser ici. Veuillez ouvrir votre propre point de vente."
                )
        else:
            # Mode non-centralisé - vérifier si l'utilisateur a un poste de vente actif
            poste_vente = PosteVente.objects.filter(
                vendeur=user,
                est_actif=True
            ).select_related('caisse').first()
            
            if not poste_vente:
                raise ValueError(
                    "Vous n'avez aucun point de vente actif. "
                    "Veuillez ouvrir un point de vente avant de réaliser une vente."
                )
        
        poste_caisse_id = poste_vente.caisse_id if poste_vente else None
        poste_vente_id = poste_vente.id if poste_vente else None

        # En mode caisse centrale, une caisse physique doit être ouverte
        if centralized:
            caisse_ouverte = PosteVente.objects.filter(est_actif=True, caisse__isnull=False).first()
            if not caisse_ouverte:
                raise ValueError(
                    "Aucun point de caisse n'est ouvert. "
                    "Veuillez ouvrir un point de caisse avant de réaliser une vente."
                )

        # Validate each product entry before touching the DB
        valid_product_ids = set(
            Produit.objects.filter(
                id__in=[p.get('produit') for p in produits_data if p.get('produit')]
            ).values_list('id', flat=True)
        )
        for p in produits_data:
            pid = p.get('produit')
            if not pid or pid not in valid_product_ids:
                raise ValueError(f"Produit introuvable (id={pid}).")
            try:
                price = Decimal(str(p.get('selling_price', '0')))
                # Guard against values exceeding DecimalField(max_digits=12, decimal_places=2)
                if abs(price) >= Decimal('10000000000'):
                    raise ValueError(f"Prix de vente hors limites pour le produit id={pid}.")
            except (InvalidOperation, ValueError) as exc:
                raise ValueError(f"Prix de vente invalide pour le produit id={pid}: {exc}") from exc
            try:
                qty = int(p.get('quantity', 0))
            except (TypeError, ValueError):
                raise ValueError(f"Quantité invalide pour le produit id={pid}.")

        # 2. Handle Existing Facture or Create New
        existing_id = data.get('existing_id')
        if data.get('poste_vente_id') and poste_vente:
            poste_vente_id = poste_vente.id
            poste_caisse_id = poste_vente.caisse_id
        
        if existing_id:
            try:
                facture = Facture.objects.get(id=existing_id)
                # Ensure we reset status to draft before re-validating
                facture.status = Facture.Status.BROUILLON
                facture.client_id = client_id  # type: ignore[attr-defined]
                facture.client_name_override = client_name_override
                facture.ayant_droit_id = ayant_droit_id  # type: ignore[attr-defined]
                facture.remise = remise_montant
                facture.created_by = validation_user
                facture.validated_by = validation_user  # type: ignore[attr-defined]
                if poste_vente:
                    facture.poste_vente = poste_vente
                if poste_caisse_id:
                    facture.poste_caisse_id = poste_caisse_id  # type: ignore[attr-defined]
                if centralized and not facture.ticket_session:  # type: ignore[attr-defined]
                    facture.ticket_session = get_next_ticket_session()
                facture.save()
                
                # Cleanup existing lines and associated objects to replace them with the current cart
                facture.produits.all().delete()
                Promis.objects.filter(facture=facture).delete()
                Ordonnancier.objects.filter(facture=facture).delete()
            except Facture.DoesNotExist:
                raise ValueError(f"La facture #{existing_id} est introuvable.")
        else:
            facture = Facture.objects.create(
                client_id=client_id,  # type: ignore[attr-defined]
                client_name_override=client_name_override,
                ayant_droit_id=ayant_droit_id,  # type: ignore[attr-defined]
                remise=remise_montant,
                status=Facture.Status.BROUILLON,
                created_by=validation_user,
                validated_by=validation_user,  # type: ignore[attr-defined]
                poste_caisse_id=poste_caisse_id,  # type: ignore[attr-defined]
                poste_vente=poste_vente,
                ticket_session=get_next_ticket_session() if centralized else None
            )

        # 3. Add products (Optimized: bulk_create)
        try:
            facture_produits_to_create = [
                FactureProduit(
                    facture=facture,
                    produit_id=p.get('produit'),
                    quantity=int(p.get('quantity', 0)),
                    selling_price=Decimal(str(p.get('selling_price', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    discount=Decimal(str(p.get('discount', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    tva=Decimal(str(p.get('tva', '0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    stock_lot_id=p.get('lot_id')
                ) for p in produits_data
            ]
            if facture_produits_to_create:
                FactureProduit.objects.bulk_create(facture_produits_to_create)
                # Associer les allocations explicites pour validate_invoice
                for item, p in zip(facture_produits_to_create, produits_data):
                    allocs = p.get('lot_allocations')
                    if allocs:
                        item._lot_allocations = allocs
        except DataError as e:
            raise ValueError(f"Valeur numérique hors limites dans les produits : {e}") from e

        # Recalculate totals before validation
        facture.calculate_totals(save=True)

        # 4. Handle Coupon
        if coupon_numero:
            try:
                coupon = CouponMonnaie.objects.get(numero=coupon_numero, status=CouponMonnaie.Status.ACTIF)
                coupon.status = CouponMonnaie.Status.UTILISE
                coupon.facture_utilisation = facture
                coupon.date_utilisation = timezone.now()
                coupon.utilise_par = validation_user
                coupon.save()
            except CouponMonnaie.DoesNotExist:
                pass

        # 5. Handle Promis (Optimized: bulk_create)
        promis_to_create = [
            Promis(
                facture=facture,
                client_id=client_id,
                client_name=client_name_override or '',
                client_phone=p.get('promis_phone', ''),
                produit_id=p['produit'],
                quantite=p['promis_quantity'],
                status=Promis.Status.EN_ATTENTE,
                created_by=validation_user
            ) for p in produits_data if p.get('is_promis') and p.get('promis_quantity', 0) > 0
        ]
        if promis_to_create:
            Promis.objects.bulk_create(promis_to_create)

        # 6. Handle Ordonnancier
        if ordonnance_data:
            ord_obj = Ordonnancier.objects.create(
                patient_nom=ordonnance_data.get('patient_nom'),
                prescripteur_nom=ordonnance_data.get('prescripteur_nom'),
                image_ordonnance=image_file,
                facture=facture,
                enregistre_par=validation_user
            )
            ordonnance_lignes_to_create = [
                LigneOrdonnancier(
                    ordonnancier=ord_obj,
                    produit_id=l.get('produit_id'),
                    produit_nom=l.get('produit_nom'),
                    quantite=l.get('quantite'),
                    surveillance_category=l.get('surveillance_category', 'NONE')
                ) for l in ordonnance_data.get('lignes', [])
            ]
            if ordonnance_lignes_to_create:
                LigneOrdonnancier.objects.bulk_create(ordonnance_lignes_to_create)

        # 6b. Store ticket payment info for accurate reprints
        montant_verse = data.get('montant_verse')
        montant_rendu = data.get('montant_rendu')
        if montant_verse is not None:
            try:
                facture.montant_verse = Decimal(str(montant_verse))
            except (InvalidOperation, TypeError, ValueError):
                pass
        if montant_rendu is not None:
            try:
                facture.montant_rendu = Decimal(str(montant_rendu))
            except (InvalidOperation, TypeError, ValueError):
                pass
        facture.save(update_fields=['montant_verse', 'montant_rendu'] if (montant_verse is not None or montant_rendu is not None) else None)

        # 7. Validation Logic (Destocking, FIFO, loyalty)
        # En mode caisse centralisée : la facture reste PROFORMA et attend l'encaissement à la caisse.
        # En mode direct : validation immédiate avec déstockage.
        if centralized:
            facture.status = Facture.Status.PROFORMA
            facture._skip_audit = True
            facture.save(update_fields=['status'])
        else:
            validation_data = {
                'use_pending_discount': loyalty_data.get('use_pending_discount', False),
                'points_to_use': loyalty_data.get('points_to_use', 0),
                'paiement_immediat': sum(Decimal(str(p['montant'])) for p in paiements_data),
                'mode_paiement': data.get('mode_paiement')
            }
            SalesService.validate_invoice(facture, validation_user, validation_data)

        # 8. Payments
        # En mode direct : les paiements sont enregistrés immédiatement.
        # En mode caisse centralisée : les paiements sont créés au moment de l'encaissement à la caisse centrale.
        if not centralized and paiements_data:
            if not Caisse.objects.filter(facture=facture).exists():
                for p_data in paiements_data:
                    if Decimal(str(p_data.get('montant', 0))) > 0:
                        paiement = Caisse.objects.create(
                            facture=facture,
                            mode_paiement=p_data.get('mode', 'especes'),
                            montant=Decimal(str(p_data['montant'])),
                            reference=p_data.get('reference'),
                            statut='completee',
                            user=validation_user,
                            part_patient=p_data.get('part_patient'),
                            part_assurance=p_data.get('part_assurance')
                        )
                        from .payment_service import PaymentService
                        PaymentService.process_payment(paiement, is_created=True)
                facture.refresh_from_db()

        return facture

    @staticmethod
    @transaction.atomic
    def validate_invoice(facture, validation_user, data):
        """
        Performs stock validation, FIFO/FEFO allocation, loyalty updates.
        The validation_user is the user who authorized the sale (e.g. via sudo).
        """
        if facture.status == Facture.Status.VALIDEE:
            return facture

        if facture.status not in [Facture.Status.BROUILLON, Facture.Status.PROFORMA]:
            raise ValueError(f"Impossible de valider une facture avec le statut {facture.get_status_display()}.")

        items = FactureProduit.objects.filter(facture=facture)

        # 1. Integrity check
        if facture.remise > facture.total_ht:
            raise ValueError(f"La remise globale ({facture.remise} F) ne peut pas être supérieure au total des produits ({facture.total_ht} F).")

        # 2. OPTIMISTIC LOCKING: Récupérer produits sans verrou
        # Les versions seront vérifiées avant sauvegarde
        product_ids = [item.produit_id for item in items]
        products_map = {p.id: p for p in Produit.objects.filter(id__in=product_ids)}
        
        # Sauvegarder les versions pour vérification avant commit
        initial_versions = {pid: p.version for pid, p in products_map.items()}
        
        # PLAFOND DE CRÉDIT check
        if facture.client:
            paiement_immediat = Decimal(str(data.get('paiement_immediat', 0)))
            new_debt_increment = max(Decimal('0'), facture.total_ttc - paiement_immediat)
            
            # -1 means unlimited credit. Default 0 means no credit allowed. 
            # Per user request, this check only applies to PROFESSIONNEL clients.
            if facture.client.client_type == 'PROFESSIONNEL' and facture.client.plafond != Decimal('-1') and (facture.client.current_debt + new_debt_increment) > facture.client.plafond:
                 raise ValueError(f"Le plafond de crédit du client professionnel est dépassé (Limite: {facture.client.plafond} F, Dette actuelle: {facture.client.current_debt} F, Nouveau: +{new_debt_increment} F).")

        # Aggregate requested quantities
        requested_map = {}
        for item in items:
            requested_map[item.produit_id] = requested_map.get(item.produit_id, 0) + item.quantity
        
        # Aggregate promis quantities
        promis_map = {p.produit_id: p.quantite for p in Promis.objects.filter(facture=facture)}

        # Stock check
        can_sell_negative = validation_user.is_superuser or (hasattr(validation_user, 'profile') and validation_user.profile.can_sell_negative_stock)
        
        for pid, total_qty in requested_map.items():
            produit = products_map.get(pid)
            if not produit: continue
            
            promis_qty = promis_map.get(pid, 0)
            effective_qty = Decimal(str(total_qty - promis_qty))
            
            if effective_qty > 0 and produit.stock < effective_qty and not can_sell_negative:
                 raise ValueError(f"Stock insuffisant pour le produit {produit.name}. Quantité totale demandée: {total_qty}, Disponible: {produit.stock}")
            
            if effective_qty < 0:
                can_return = validation_user.is_superuser or (hasattr(validation_user, 'profile') and validation_user.profile.can_do_returns)
                if not can_return:
                    raise ValueError(f"Permission de retour refusée pour {produit.name}.")

        # 3. Lot Allocation (FIFO/FEFO) avec Optimistic Locking
        lot_ids_to_lock = [item.stock_lot_id for item in items if item.stock_lot_id]
        # Inclure aussi les lots des allocations explicites
        explicit_alloc_lot_ids = [
            alloc.get('lot_id') or alloc.get('stock_lot_id')
            for item in items
            for alloc in getattr(item, '_lot_allocations', []) or []
            if alloc.get('lot_id') or alloc.get('stock_lot_id')
        ]
        all_lot_ids = list(set(lot_ids_to_lock + explicit_alloc_lot_ids))
        lots_map = {l.id: l for l in StockLot.objects.filter(id__in=all_lot_ids)} if all_lot_ids else {}
        
        # Sauvegarder versions des lots
        initial_lot_versions = {lid: l.version for lid, l in lots_map.items()}
        
        # Prepare FIFO queues (sans verrou - vérification à la fin)
        fifo_prods = [item.produit_id for item in items if item.quantity > 0 and not item.stock_lot_id and not getattr(item, '_lot_allocations', None)]
        fifo_lots_queue = {}
        fifo_lots_versions = {}
        if fifo_prods:
            fifo_lots = StockLot.objects.filter(
                produit_id__in=fifo_prods,
                quantity_remaining__gt=0
            ).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
            for lot in fifo_lots:
                fifo_lots_queue.setdefault(lot.produit_id, []).append(lot)
                fifo_lots_versions[lot.id] = lot.version

        allocations_to_create = []
        items_to_update = []
        lots_to_update_set = set()
        prods_to_sync_from_lots = set()
        manual_stock_decrements = {}

        lots_to_check_versions = {}  # Pour vérifier versions avant sauvegarde
        
        for item in items:
            produit = products_map.get(item.produit_id)
            if not produit:
                continue
            lots_updated = False
            
            if item.quantity > 0:
                qty_to_alloc = item.quantity
                if item.stock_lot_id:
                    target_lot = lots_map.get(item.stock_lot_id)
                    if target_lot is None:
                        raise ValueError(f"Lot de stock {item.stock_lot_id} introuvable pour le produit {item.produit_id}.")
                    if target_lot.quantity_remaining < qty_to_alloc:
                        raise ValueError(f"Stock insuffisant dans le lot {target_lot.lot}.")
                    
                    allocations_to_create.append(FactureProduitAllocation(
                        facture_produit=item, stock_lot=target_lot, quantity=qty_to_alloc,
                        cost_price=target_lot.price_cost, selling_price=item.selling_price
                    ))
                    target_lot.quantity_remaining -= qty_to_alloc
                    if target_lot.quantity_free_remaining > 0:
                        target_lot.quantity_free_remaining -= min(qty_to_alloc, target_lot.quantity_free_remaining)
                    lots_to_update_set.add(target_lot)
                    lots_to_check_versions[target_lot.id] = initial_lot_versions.get(target_lot.id, 1)
                    item.lot = target_lot.lot[:20] 
                    item.date_expiration = target_lot.date_expiration
                    items_to_update.append(item)
                    lots_updated = True
                else:
                    available = fifo_lots_queue.get(produit.id, [])
                    used_lots_names = []
                    for lot in available:
                        if qty_to_alloc <= 0: break
                        qty_from_lot = min(lot.quantity_remaining, qty_to_alloc)
                        allocations_to_create.append(FactureProduitAllocation(
                            facture_produit=item, stock_lot=lot, quantity=qty_from_lot,
                            cost_price=lot.price_cost, selling_price=item.selling_price
                        ))
                        lot.quantity_remaining -= qty_from_lot
                        if lot.quantity_free_remaining > 0:
                            lot.quantity_free_remaining -= min(qty_from_lot, lot.quantity_free_remaining)
                        lots_to_update_set.add(lot)
                        used_lots_names.append(lot.lot)
                        qty_to_alloc -= qty_from_lot
                        lots_updated = True
                    if used_lots_names:
                        item.lot = ",".join([n for n in used_lots_names if n])[:20]
                        if available:
                            item.date_expiration = available[0].date_expiration
                        items_to_update.append(item)
            elif getattr(item, '_lot_allocations', None):
                # Allocation explicite définie par l'utilisateur
                used_lots_names = []
                for alloc in item._lot_allocations:
                    lot_id = alloc.get('lot_id') or alloc.get('stock_lot_id')
                    qty = int(alloc.get('quantity', 0))
                    if not lot_id or qty <= 0:
                        continue
                    target_lot = lots_map.get(lot_id)
                    if target_lot is None:
                        raise ValueError(f"Lot de stock {lot_id} introuvable pour le produit {item.produit_id}.")
                    if target_lot.quantity_remaining < qty:
                        raise ValueError(f"Stock insuffisant dans le lot {target_lot.lot} (demandé {qty}, disponible {target_lot.quantity_remaining}).")
                    allocations_to_create.append(FactureProduitAllocation(
                        facture_produit=item, stock_lot=target_lot, quantity=qty,
                        cost_price=target_lot.price_cost, selling_price=item.selling_price
                    ))
                    target_lot.quantity_remaining -= qty
                    if target_lot.quantity_free_remaining > 0:
                        target_lot.quantity_free_remaining -= min(qty, target_lot.quantity_free_remaining)
                    lots_to_update_set.add(target_lot)
                    lots_to_check_versions[target_lot.id] = initial_lot_versions.get(target_lot.id, 1)
                    used_lots_names.append(target_lot.lot)
                    lots_updated = True
                if used_lots_names:
                    item.lot = ",".join([n for n in used_lots_names if n])[:20]
                    item.date_expiration = None
                    items_to_update.append(item)
            elif item.quantity < 0:
                target_lot = lots_map.get(item.stock_lot_id) or (StockLot.objects.filter(produit=produit).order_by('-created_at').first() if produit.use_lot_management else None)
                if target_lot:
                    target_lot.quantity_remaining -= item.quantity # item.quantity is negative
                    restoring_qty = -item.quantity
                    space_for_free = target_lot.quantity_free - target_lot.quantity_free_remaining
                    if space_for_free > 0:
                        target_lot.quantity_free_remaining += min(restoring_qty, space_for_free)
                    lots_to_update_set.add(target_lot)
                    item.lot = (target_lot.lot or "RETOUR")[:20] 
                    item.date_expiration = target_lot.date_expiration
                    items_to_update.append(item)
                    lots_updated = True

            if produit.use_lot_management and lots_updated:
                prods_to_sync_from_lots.add(produit.id)
            else:
                manual_stock_decrements[produit.id] = manual_stock_decrements.get(produit.id, 0) + item.quantity

        # EXECUTE BULK OPS
        if allocations_to_create: FactureProduitAllocation.objects.bulk_create(allocations_to_create)
        if items_to_update: FactureProduit.objects.bulk_update(items_to_update, ['lot', 'date_expiration'])
        if lots_to_update_set: StockLot.objects.bulk_update(list(lots_to_update_set), ['quantity_remaining', 'quantity_free_remaining'])
        if manual_stock_decrements:
            for pid, qty in manual_stock_decrements.items():
                Produit.objects.filter(id=pid).update(stock=F('stock') - qty)
        if prods_to_sync_from_lots:
            # Sync stock from lots sum
            from django.db.models import Subquery, OuterRef
            total_lots_sum = StockLot.objects.filter(produit=OuterRef('pk')).order_by().values('produit').annotate(total=Sum('quantity_remaining')).values('total')
            Produit.objects.filter(id__in=prods_to_sync_from_lots).update(stock=models.functions.Coalesce(Subquery(total_lots_sum), Value(0)))

        # 4. Stock Movements (Traceability)
        updated_products = Produit.objects.filter(id__in=product_ids)
        product_stock_map = {p.id: p.total_stock for p in updated_products}
        mouvements_to_create = []
        for item in items:
            if item.quantity == 0: continue
            is_return = item.quantity < 0
            prefix = "Retour" if is_return else "Vente"
            desc = f"{prefix} Facture #{facture.numero_facture or facture.id}"
            
            mouvements_to_create.append(MouvementStock(
                produit_id=item.produit_id,
                type_mouvement=MouvementStock.TypeMouvement.RETOUR if is_return else MouvementStock.TypeMouvement.SORTIE,
                quantite=-item.quantity,
                stock_apres=product_stock_map.get(item.produit_id),
                user=validation_user,
                facture=facture,
                description=desc,
                date=timezone.now()
            ))
        if mouvements_to_create: MouvementStock.objects.bulk_create(mouvements_to_create)

        # 5. Loyalty Management
        if facture.client and facture.client.client_type != 'PROFESSIONNEL' and facture.client.is_loyalty_member:
            # Exclure explicitement 'CLIENTS DIVERS' de l'accumulation de points
            if facture.client.name.strip().upper() != 'CLIENTS DIVERS':
                loyalty_conf = LoyaltySetting.objects.first()
                if loyalty_conf:
                    client = facture.client
                    client._skip_audit = True
                    save_client = False
                    if str(data.get('use_pending_discount', False)).lower() == 'true' and client.pending_discount > 0:
                        client.pending_discount = 0
                        save_client = True
                    points_to_use = int(data.get('points_to_use', 0))
                    if points_to_use > 0 and client.points_fidelite >= points_to_use:
                        client.points_fidelite -= points_to_use
                        facture.points_fidelite_utilises = points_to_use
                        facture.montant_fidelite = points_to_use * loyalty_conf.point_value
                        save_client = True
                    if facture.total_ttc > 0 and loyalty_conf.amount_per_point > 0:
                        points_gagnes = int(facture.total_ttc // loyalty_conf.amount_per_point)
                        facture.points_fidelite_gagnes = points_gagnes
                        client.points_fidelite += points_gagnes
                        save_client = True
                    if loyalty_conf.auto_reward_threshold > 0 and client.points_fidelite >= loyalty_conf.auto_reward_threshold:
                        client.points_fidelite -= loyalty_conf.auto_reward_threshold
                        client.pending_discount = max(client.pending_discount, loyalty_conf.auto_reward_percent)
                        save_client = True
                    if save_client: client.save()

        # 6. Final updates
        facture.status = Facture.Status.VALIDEE
        facture._skip_audit = True
        if not facture.numero_facture:
            facture.numero_facture = f"FAC-{facture.id:06d}"
        if not facture.validated_by:
            facture.validated_by = validation_user
        facture.save(update_fields=['status', 'numero_facture', 'validated_by', 'points_fidelite_utilises', 'montant_fidelite', 'points_fidelite_gagnes'])
        
        Produit.objects.filter(id__in=product_ids).update(dernier_vente=timezone.now().date())
        PromotionService.apply_promotions_to_invoice(facture)
        facture.calculate_totals(save=True)

        # 7. Automated debt for professional clients
        if facture.client and facture.client.client_type == 'PROFESSIONNEL' and facture.part_client is not None:
            part_assurance = facture.total_ttc - Decimal(str(facture.part_client))
            if part_assurance > 0:
                paiement_en_compte = Caisse.objects.create(
                    facture=facture, mode_paiement='en_compte', montant=part_assurance, statut='completee',
                    user=validation_user, part_assurance=part_assurance, part_patient=Decimal('0.00')
                )
                from .payment_service import PaymentService
                PaymentService.process_payment(paiement_en_compte, is_created=True)
        

        # Cache invalidation
        cache_key = f'stats_jour_{timezone.now().strftime("%Y-%m-%d")}'
        cache.delete(cache_key)

        return facture

    @staticmethod
    @transaction.atomic
    def cancel_invoice(facture, user, motif=""):
        """
        Cancels an invoice and restores stock levels.
        """
        if facture.status == Facture.Status.ANNULEE:
            return False, "Cette facture est déjà annulée."

        was_validated = facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]
        
        if was_validated:
            # 1. Restore Lots (with .save() to trigger signals and keep traceability)
            allocations = list(
                FactureProduitAllocation.objects.filter(facture_produit__facture=facture)
                .select_related('stock_lot', 'facture_produit', 'facture_produit__produit')
            )
            lot_ids = [alloc.stock_lot_id for alloc in allocations if alloc.stock_lot_id]
            locked_lots = {
                lot.id: lot
                for lot in StockLot.objects.filter(id__in=lot_ids).select_for_update().order_by('id')
            } if lot_ids else {}

            for alloc in allocations:
                lot = locked_lots.get(alloc.stock_lot_id) if alloc.stock_lot_id else None
                if not lot:
                    continue
                lot.quantity_remaining += alloc.quantity
                # Restaurer les unités gratuites sans dépasser le total gratuit initial
                lot.quantity_free_remaining = min(
                    lot.quantity_free_remaining + alloc.quantity,
                    lot.quantity_free
                )
                lot.save()

            # 2. Determine which products were actually allocated from lots
            product_ids_with_allocations = set()
            for alloc in allocations:
                if alloc.facture_produit and alloc.facture_produit.produit_id:
                    product_ids_with_allocations.add(alloc.facture_produit.produit_id)
            FactureProduitAllocation.objects.filter(id__in=[a.id for a in allocations]).delete()

            # 3. Restore stock: recalculate from lots only when lots were used, otherwise manual restore
            items = FactureProduit.objects.filter(facture=facture).select_related('produit')
            products_to_refresh = set()
            for item in items:
                produit = item.produit
                if produit and produit.use_lot_management and item.produit_id in product_ids_with_allocations:
                    produit.calculate_stock_from_lots()
                    products_to_refresh.add(produit.id)
                else:
                    Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + item.quantity)

            # Refresh in-memory products to get correct stock for movements
            refreshed_products = {
                p.id: p for p in Produit.objects.filter(id__in=products_to_refresh)
            }

            mouvements_to_create = []
            for item in items:
                produit = refreshed_products.get(item.produit_id, item.produit)
                mouvements_to_create.append(MouvementStock(
                    produit=produit, type_mouvement=MouvementStock.TypeMouvement.RETOUR,
                    quantite=item.quantity, stock_apres=produit.total_stock if produit else 0,
                    description=f"Annulation Facture #{facture.numero_facture or facture.id}",
                    user=user, facture=facture
                ))
            MouvementStock.objects.bulk_create(mouvements_to_create)

        facture.date_annulation = timezone.now()
        facture.status = Facture.Status.ANNULEE
        facture.cancelled_by = user
        if motif:
            facture.notes = f"{facture.notes or ''}\n[Annulation le {facture.date_annulation.strftime('%d/%m/%Y %H:%M')}] Motif: {motif}".strip()
        facture.save(update_fields=['status', 'notes', 'date_annulation', 'cancelled_by'])

        # 3. Cancel associated payments (Caisse)
        payments = Caisse.objects.filter(facture=facture, statut='completee')
        for p in payments:
            if p.mode_paiement == 'depot' and facture.client:
                DepotClient.objects.create(
                    client=facture.client,
                    type=DepotClient.Type.ANNULATION_ACHAT,
                    montant=p.montant,
                    facture=facture,
                    created_by=user,
                    notes=f"Annulation Facture {facture.numero_facture or facture.id}"
                )
        
        payments.update(statut='annulee')

        cache_key = f'stats_jour_{timezone.now().strftime("%Y-%m-%d")}'
        cache.delete(cache_key)
        
        return True, "Facture annulée avec succès."

    @staticmethod
    @transaction.atomic
    def modify_sale(facture, user, data):
        """
        Modifies a validated invoice, adjusts products, and creates payment adjustments.
        """
        if facture.status not in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
             raise ValueError("Seules les factures validées ou payées peuvent être modifiées.")
        
        # Recover date safely (fixes environment issues in serial test runs)
        val_date = getattr(facture, 'date', None)
        if val_date and hasattr(val_date, 'date') and val_date.date() < timezone.now().date():
             raise ValueError("Cette vente ne peut plus être modifiée car elle date d'un jour antérieur.")
        
        old_total = facture.total_ttc
        new_products = data.get('produits', [])
        
        if not new_products:
             raise ValueError("La liste des produits est requise.")
        
        # 1. Restore Stock (Temporary)
        allocations = list(
            FactureProduitAllocation.objects.filter(facture_produit__facture=facture)
            .select_related('stock_lot', 'facture_produit')
        )
        lot_ids = [alloc.stock_lot_id for alloc in allocations if alloc.stock_lot_id]
        locked_lots = {
            lot.id: lot
            for lot in StockLot.objects.filter(id__in=lot_ids).select_for_update().order_by('id')
        } if lot_ids else {}
        for alloc in allocations:
            lot = locked_lots.get(alloc.stock_lot_id) if alloc.stock_lot_id else None
            if not lot:
                continue
            lot.quantity_remaining += alloc.quantity
            lot.quantity_free_remaining = min(
                lot.quantity_free_remaining + alloc.quantity,
                lot.quantity_free
            )
            lot.save()
        FactureProduitAllocation.objects.filter(id__in=[a.id for a in allocations]).delete()

        old_items = FactureProduit.objects.filter(facture=facture)
        old_items_data = []
        old_quantity_by_product = {}
        old_product_ids = set()
        old_product_ids_with_allocations = set()
        for alloc in allocations:
            if alloc.facture_produit and alloc.facture_produit.produit_id:
                old_product_ids_with_allocations.add(alloc.facture_produit.produit_id)
        for item in old_items:
            old_items_data.append({'produit_id': item.produit_id, 'quantity': item.quantity})
            old_quantity_by_product[item.produit_id] = old_quantity_by_product.get(item.produit_id, 0) + item.quantity
            old_product_ids.add(item.produit_id)
            if item.produit and (not item.produit.use_lot_management or item.produit_id not in old_product_ids_with_allocations):
                Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + item.quantity)
        old_items.delete()

        # 2. Apply Changes
        facture.remise = Decimal(str(data.get('remise', '0')))
        if data.get('client'): facture.client_id = data.get('client')
        facture.client_name_override = data.get('client_name_override', facture.client_name_override)
        facture.save()

        # 3. Create New Products
        new_quantity_by_product = {}
        new_product_ids = set()
        new_product_ids_with_allocations = set()
        product_ids = [p.get('produit') for p in new_products]
        products_by_id = Produit.objects.in_bulk(product_ids) if product_ids else {}

        for prod_data in new_products:
            produit_id = prod_data.get('produit')
            quantity = int(prod_data.get('quantity', 1))
            selling_price = prod_data.get('selling_price', '0')
            lot_id = prod_data.get('lot_id')
            produit = products_by_id.get(produit_id)

            fp = FactureProduit.objects.create(
                facture=facture, produit_id=produit_id, quantity=quantity,
                selling_price=selling_price, discount=Decimal(str(prod_data.get('discount', '0'))),
                tva=Decimal(str(prod_data.get('tva', '0'))), stock_lot_id=lot_id
            )
            new_quantity_by_product[produit_id] = new_quantity_by_product.get(produit_id, 0) + quantity
            new_product_ids.add(produit_id)
            
            lots_allocated_for_this_item = False
            if quantity > 0 and produit and produit.use_lot_management:
                quantity_to_allocate = quantity
                if lot_id:
                    target_lot = StockLot.objects.get(id=lot_id)
                    FactureProduitAllocation.objects.create(
                        facture_produit=fp, stock_lot=target_lot, quantity=quantity_to_allocate,
                        cost_price=target_lot.price_cost, selling_price=selling_price
                    )
                    target_lot.quantity_remaining -= quantity_to_allocate
                    if target_lot.quantity_free_remaining > 0:
                        target_lot.quantity_free_remaining -= min(quantity_to_allocate, target_lot.quantity_free_remaining)
                    target_lot.save()
                    lots_allocated_for_this_item = True
                else:
                    available_lots = StockLot.objects.filter(produit_id=produit_id, quantity_remaining__gt=0).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
                    for lot in available_lots:
                        if quantity_to_allocate <= 0: break
                        qty_from_lot = min(lot.quantity_remaining, quantity_to_allocate)
                        FactureProduitAllocation.objects.create(
                            facture_produit=fp, stock_lot=lot, quantity=qty_from_lot,
                            cost_price=lot.price_cost, selling_price=selling_price
                        )
                        lot.quantity_remaining -= qty_from_lot
                        if lot.quantity_free_remaining > 0: lot.quantity_free_remaining -= min(qty_from_lot, lot.quantity_free_remaining)
                        lot.save()
                        quantity_to_allocate -= qty_from_lot
                        lots_allocated_for_this_item = True
            
            if lots_allocated_for_this_item:
                new_product_ids_with_allocations.add(produit_id)
            elif produit and not produit.use_lot_management:
                Produit.objects.filter(pk=produit_id).update(stock=F('stock') - quantity)
            elif produit and produit.use_lot_management:
                # Produit en gestion par lots mais aucun lot disponible : ajustement manuel
                Produit.objects.filter(pk=produit_id).update(stock=F('stock') - quantity)

            # Sync FactureProduit fields from allocated lots
            if lot_id:
                target_lot = StockLot.objects.get(id=lot_id)
                fp.lot = target_lot.lot[:20]
                fp.date_expiration = target_lot.date_expiration
                fp.save(update_fields=['lot', 'date_expiration'])
            elif produit and produit.use_lot_management and lots_allocated_for_this_item:
                allocations = FactureProduitAllocation.objects.filter(facture_produit=fp).select_related('stock_lot')
                if allocations.exists():
                    fp.lot = ",".join([a.stock_lot.lot for a in allocations if a.stock_lot and a.stock_lot.lot])[:20]
                    fp.date_expiration = min([a.stock_lot.date_expiration for a in allocations if a.stock_lot and a.stock_lot.date_expiration]) if any(a.stock_lot.date_expiration for a in allocations if a.stock_lot) else None
                    fp.save(update_fields=['lot', 'date_expiration'])

        # Recalculate stock from lots only for products that actually had lot allocations
        products_to_sync = old_product_ids_with_allocations | new_product_ids_with_allocations
        for pid in products_to_sync:
            produit = products_by_id.get(pid) or Produit.objects.filter(pk=pid).first()
            if produit and produit.use_lot_management:
                produit.calculate_stock_from_lots()
        
        # 4. Finalize totals and adjustment
        PromotionService.apply_promotions_to_invoice(facture)
        facture.calculate_totals(save=True)
        facture.refresh_from_db()
        difference = facture.total_ttc - old_total
        
        if difference != 0:
            # Correction : L'ajustement ne doit être créé que si un paiement a déjà été encaissé
            # (Cas fréquent à la caisse centrale où la vente est modifiée avant d'être payée)
            total_paye = Caisse.objects.filter(facture=facture, statut='completee').aggregate(
                total=Sum('montant')
            )['total'] or Decimal('0')

            if total_paye > 0 or facture.status == Facture.Status.PAYEE:
                paiement_adj = Caisse.objects.create(
                    facture=facture, mode_paiement='especes', montant=difference,
                    statut='completee', user=user, reference=f"Ajustement modification facture {facture.numero_facture or facture.id}"
                )
                from .payment_service import PaymentService
                PaymentService.process_payment(paiement_adj, is_created=True)

        # 5. Traceability: stock movements and audit log
        all_product_ids = set(old_quantity_by_product.keys()) | set(new_quantity_by_product.keys())
        if all_product_ids:
            updated_products = Produit.objects.filter(id__in=all_product_ids)
            product_stock_map = {p.id: p.total_stock for p in updated_products}
            mouvements_to_create = []
            for pid in all_product_ids:
                old_qty = old_quantity_by_product.get(pid, 0)
                new_qty = new_quantity_by_product.get(pid, 0)
                delta = old_qty - new_qty  # positive = returned to stock, negative = sold from stock
                if delta == 0:
                    continue
                is_return = delta > 0
                mouvements_to_create.append(MouvementStock(
                    produit_id=pid,
                    type_mouvement=MouvementStock.TypeMouvement.RETOUR if is_return else MouvementStock.TypeMouvement.SORTIE,
                    quantite=delta if is_return else -delta,
                    stock_apres=product_stock_map.get(pid),
                    user=user,
                    facture=facture,
                    description=f"{'Retour' if is_return else 'Sortie'} suite modification Facture #{facture.numero_facture or facture.id}",
                    date=timezone.now()
                ))
            if mouvements_to_create:
                MouvementStock.objects.bulk_create(mouvements_to_create)

            log_audit(
                user=user,
                action=AuditLog.Action.STOCK_ADJUST,
                model_name='Facture',
                object_id=str(facture.id),
                description=f"Modification vente #{facture.numero_facture or facture.id} - ajustement stock tracé",
                details={
                    'old_total': str(old_total),
                    'new_total': str(facture.total_ttc),
                    'old_quantities': old_quantity_by_product,
                    'new_quantities': new_quantity_by_product,
                },
            )

        return facture, old_total, difference
