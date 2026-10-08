"""
Gestion des dettes de stock créées par les ventes.

Une StockObligation représente une quantité facturée qui n'est pas encore
couplée à un lot physique :
- PROMIS : le client a payé mais n'a pas encore reçu la quantité ;
- FORCE : la quantité a été livrée alors qu'aucun lot ne couvrait la sortie.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Case, F, IntegerField, Sum, When
from django.utils import timezone

from ..models import (
    FactureProduitAllocation,
    MouvementStock,
    Produit,
    Promis,
    StockLot,
    StockObligation,
    StockObligationResolution,
)
from .realtime import notify_stock_changed

logger = logging.getLogger(__name__)


class StockObligationService:
    """Opérations communes sur les dettes de stock."""

    @staticmethod
    def estimated_cost(produit):
        """Coût de secours pour une quantité vendue avant allocation réelle."""
        return produit.pmp or produit.cost_price or Decimal('0')

    @staticmethod
    def create_obligation(
        facture_produit,
        quantity,
        obligation_type,
        promis=None,
        user=None,
        stock_applied=True,
        stock_location=StockObligation.StockLocation.RAYON,
    ):
        """Crée une dette de stock pour une ligne de facture."""
        produit = facture_produit.produit
        return StockObligation.objects.create(
            produit=produit,
            produit_nom=produit.name if produit else facture_produit.produit_nom,
            facture=facture_produit.facture,
            facture_produit=facture_produit,
            promis=promis,
            type=obligation_type,
            quantity=quantity,
            quantity_remaining=quantity,
            stock_applied=stock_applied,
            stock_location=stock_location,
            cost_price=StockObligationService.estimated_cost(produit),
            selling_price=facture_produit.selling_price or Decimal('0'),
            created_by=user,
        )

    @staticmethod
    def create_for_promis(
        promis,
        facture_produit=None,
        quantity=None,
        user=None,
        stock_applied=True,
        stock_location=StockObligation.StockLocation.RAYON,
    ):
        """Crée une obligation pour un promis lié ou non à une facture."""
        produit = promis.produit
        return StockObligation.objects.create(
            produit=produit,
            produit_nom=produit.name if produit else promis.produit_nom,
            facture=promis.facture,
            facture_produit=facture_produit,
            promis=promis,
            type=StockObligation.TypeObligation.PROMIS,
            quantity=quantity or promis.quantite,
            quantity_remaining=quantity or promis.quantite,
            stock_applied=stock_applied,
            stock_location=stock_location,
            cost_price=StockObligationService.estimated_cost(produit),
            selling_price=(
                facture_produit.selling_price
                if facture_produit else Decimal('0')
            ),
            created_by=user,
        )

    @staticmethod
    def cancel_obligation(obligation, user=None):
        """
        Annule le reste d'une dette.
        Si la dette était incluse dans Produit.stock, elle y est réintégrée.
        """
        obligation = StockObligation.objects.select_for_update().get(pk=obligation.pk)
        if obligation.status != StockObligation.Status.EN_ATTENTE:
            return 0

        restored_quantity = obligation.quantity_remaining if obligation.stock_applied else 0
        if restored_quantity:
            StockObligationService._add_product_stock(
                obligation.produit, restored_quantity, obligation.stock_location
            )
            notify_stock_changed([obligation.produit_id])

        obligation.quantity_remaining = 0
        obligation.stock_applied = False
        obligation.status = StockObligation.Status.ANNULEE
        obligation.cancelled_at = timezone.now()
        obligation.cancelled_by = user
        obligation.save(update_fields=[
            'quantity_remaining', 'stock_applied', 'status',
            'cancelled_at', 'cancelled_by'
        ])
        return restored_quantity

    @staticmethod
    def mark_unapplied_after_absolute_stock_reset(product_ids, stock_location=None):
        """
        Une remise à niveau physique brute (inventaire, ajustement absolu) ne
        conserve plus la dette dans Produit.stock. Les obligations restent
        en attente mais ne seront plus comptées une deuxième fois.
        """
        if not product_ids:
            return
        obligations = StockObligation.objects.filter(
            produit_id__in=product_ids,
            status=StockObligation.Status.EN_ATTENTE,
            stock_applied=True,
        )
        if stock_location:
            obligations = obligations.filter(stock_location=stock_location)
        obligations.update(stock_applied=False)

    @staticmethod
    def reapply_pending_obligations(product_ids):
        """
        Reprend une dette mise en attente par un comptage brut dès qu'une
        opération normale de stock a besoin du stock vendable. Cela évite de
        vendre/transformer des unités déjà promises.
        """
        if not product_ids:
            return {}

        obligation_ids = list(
            StockObligation.objects.filter(
                produit_id__in=product_ids,
                status=StockObligation.Status.EN_ATTENTE,
                stock_applied=False,
            ).values_list('id', flat=True)
        )
        if not obligation_ids:
            return {}

        locked = list(
            StockObligation.objects.select_for_update()
            .filter(id__in=obligation_ids, stock_applied=False)
            .order_by('id')
        )
        grouped = {}
        for obligation in locked:
            key = (obligation.produit_id, obligation.stock_location)
            grouped[key] = grouped.get(key, 0) + (obligation.quantity_remaining or 0)

        reapplied = {}
        for (produit_id, location), quantity in grouped.items():
            if quantity <= 0:
                continue
            if location == StockObligation.StockLocation.RESERVE:
                Produit.objects.filter(pk=produit_id).update(
                    stock_reserve=F('stock_reserve') - quantity
                )
            else:
                Produit.objects.filter(pk=produit_id).update(stock=F('stock') - quantity)
            reapplied[(produit_id, location)] = quantity

        notify_stock_changed(pid for pid, _location in reapplied)

        StockObligation.objects.filter(
            id__in=[o.id for o in locked]
        ).update(stock_applied=True)
        return reapplied

    @staticmethod
    def pending_quantity(product_id, location=StockObligation.StockLocation.RAYON, stock_applied=None):
        obligations = StockObligation.objects.filter(
            produit_id=product_id,
            status=StockObligation.Status.EN_ATTENTE,
            stock_location=location,
        )
        if stock_applied is not None:
            obligations = obligations.filter(stock_applied=stock_applied)
        return obligations.aggregate(total=Sum('quantity_remaining'))['total'] or 0

    @staticmethod
    def pending_applied_quantity(product_id, location=StockObligation.StockLocation.RAYON):
        return StockObligationService.pending_quantity(
            product_id, location=location, stock_applied=True
        )

    @staticmethod
    def resolve_pending_obligations(
        produit,
        available_quantity,
        lots=None,
        user=None,
        commande=None,
        movement_description='Résolution dette de stock',
        lot_field=None,
        promis=None,
        stock_location=None,
    ):
        """
        Résout les dettes en attente d'un produit avec une quantité entrante.
        Retourne le total résolu.

        Priorité : promis (chronologique), puis ventes forcées.
        """
        if not produit or available_quantity <= 0:
            return 0

        obligations_queryset = StockObligation.objects.select_for_update().filter(
            produit=produit,
            status=StockObligation.Status.EN_ATTENTE,
        )
        if promis is not None:
            obligations_queryset = obligations_queryset.filter(promis=promis)
        if stock_location is not None:
            obligations_queryset = obligations_queryset.filter(stock_location=stock_location)

        obligations = list(
            obligations_queryset.annotate(
                priority=Case(
                    When(type=StockObligation.TypeObligation.PROMIS, then=0),
                    default=1,
                    output_field=IntegerField(),
                )
            )
            .order_by('priority', 'created_at', 'id')
        )
        if not obligations:
            return 0

        lots_to_update = set()
        allocations_to_create = []
        allocations_to_update = []
        resolutions_to_create = []
        promis_to_update = {}
        movements = []
        remaining_capacity = int(available_quantity)

        available_lots = list(lots) if lots is not None else list(
            StockLot.objects.select_for_update()
            .filter(produit=produit)
            .order_by('date_expiration', 'date_reception', 'id')
        )
        lot_index = 0
        if lot_field is None:
            lot_field = 'quantity_reserved' if produit.has_reserve_storage else 'quantity_remaining'

        def lot_available(lot):
            return getattr(lot, lot_field)

        def consume_from_lot(lot, qty):
            free_taken = 0
            setattr(lot, lot_field, getattr(lot, lot_field) - qty)
            if lot_field == 'quantity_remaining' and lot.quantity_free_remaining > 0:
                free_taken = min(qty, lot.quantity_free_remaining)
                lot.quantity_free_remaining -= free_taken
            lots_to_update.add(lot)
            return lot, free_taken

        for obligation in obligations:
            while remaining_capacity > 0 and obligation.quantity_remaining > 0:
                qty_to_resolve = min(obligation.quantity_remaining, remaining_capacity)
                resolved_for_obligation = 0
                pending_alloc = None
                if obligation.facture_produit_id:
                    pending_alloc = FactureProduitAllocation.objects.select_for_update().filter(
                        stock_obligation=obligation,
                        is_pending=True,
                    ).order_by('id').first()

                while qty_to_resolve > 0:
                    chunk = qty_to_resolve
                    if pending_alloc:
                        chunk = min(pending_alloc.quantity, qty_to_resolve)

                    target_lot = None
                    if produit.use_lot_management:
                        while lot_index < len(available_lots) and lot_available(available_lots[lot_index]) <= 0:
                            lot_index += 1
                        if lot_index >= len(available_lots):
                            break
                        target_lot = available_lots[lot_index]
                        chunk = min(chunk, lot_available(target_lot))
                        if chunk <= 0:
                            break
                        target_lot, free_taken = consume_from_lot(target_lot, chunk)
                    else:
                        free_taken = 0

                    if pending_alloc:
                        if pending_alloc.quantity == chunk:
                            pending_alloc.stock_lot = target_lot
                            pending_alloc.resolved_commande = commande
                            pending_alloc.is_pending = False
                            pending_alloc.quantity_free = free_taken
                            if target_lot:
                                pending_alloc.cost_price = target_lot.price_cost
                            allocations_to_update.append(pending_alloc)
                        else:
                            pending_alloc.quantity -= chunk
                            allocations_to_update.append(pending_alloc)
                            allocations_to_create.append(FactureProduitAllocation(
                                facture_produit_id=obligation.facture_produit_id,
                                stock_lot=target_lot,
                                stock_obligation=obligation,
                                resolved_commande=commande,
                                is_pending=False,
                                quantity=chunk,
                                quantity_free=free_taken,
                                cost_price=(target_lot.price_cost if target_lot else obligation.cost_price),
                                selling_price=obligation.selling_price,
                            ))
                    elif obligation.facture_produit_id:
                        allocations_to_create.append(FactureProduitAllocation(
                            facture_produit_id=obligation.facture_produit_id,
                            stock_lot=target_lot,
                            stock_obligation=obligation,
                            resolved_commande=commande,
                            is_pending=False,
                            quantity=chunk,
                            quantity_free=free_taken,
                            cost_price=(target_lot.price_cost if target_lot else obligation.cost_price),
                            selling_price=obligation.selling_price,
                        ))

                    resolutions_to_create.append(StockObligationResolution(
                        obligation=obligation,
                        produit=produit,
                        commande=commande,
                        stock_lot=target_lot,
                        quantity=chunk,
                        quantity_free=free_taken,
                        created_by=user,
                    ))

                    qty_to_resolve -= chunk
                    resolved_for_obligation += chunk
                    remaining_capacity -= chunk
                    if target_lot:
                        obligation.resolved_stock_lot = target_lot

                    if qty_to_resolve > 0 and obligation.facture_produit_id:
                        pending_alloc = FactureProduitAllocation.objects.select_for_update().filter(
                            stock_obligation=obligation,
                            is_pending=True,
                        ).order_by('id').first()

                if resolved_for_obligation <= 0:
                    break

                obligation.quantity_remaining -= resolved_for_obligation
                if not obligation.stock_applied:
                    # Dette détachée par un comptage brut : les unités résolues
                    # quittent réellement le compteur physique. Pour un produit
                    # à lots la baisse vient du recalcul depuis les lots ;
                    # sinon on décrémente directement.
                    if not produit.use_lot_management:
                        StockObligationService._add_product_stock(
                            produit, -resolved_for_obligation, obligation.stock_location
                        )
                    movements.append(MouvementStock(
                        produit=produit,
                        type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                        quantite=-resolved_for_obligation,
                        stock_apres=produit.total_stock,
                        user=user,
                        commande=commande,
                        description=(
                            f"{movement_description} - {obligation.get_type_display()} "
                            f"#{obligation.id} ({resolved_for_obligation} unité(s))"
                        ),
                    ))

                promis = obligation.promis
                if promis:
                    promis.quantite_livree = (promis.quantite_livree or 0) + resolved_for_obligation
                    promis_to_update[promis.id] = promis

                if obligation.quantity_remaining <= 0:
                    obligation.status = StockObligation.Status.RESOLUE
                    obligation.resolved_at = timezone.now()
                    obligation.resolved_by = user

        if lots_to_update:
            StockLot.objects.bulk_update(
                list(lots_to_update),
                ['quantity_remaining', 'quantity_free_remaining', 'quantity_reserved'],
                batch_size=100,
            )
        if allocations_to_update:
            FactureProduitAllocation.objects.bulk_update(
                allocations_to_update,
                [
                    'quantity', 'quantity_free', 'stock_lot',
                    'resolved_commande', 'is_pending', 'cost_price'
                ],
                batch_size=100,
            )
        if allocations_to_create:
            FactureProduitAllocation.objects.bulk_create(allocations_to_create, batch_size=100)
        if resolutions_to_create:
            StockObligationResolution.objects.bulk_create(resolutions_to_create, batch_size=100)
        if promis_to_update:
            Promis.objects.bulk_update(
                list(promis_to_update.values()), ['quantite_livree'], batch_size=100
            )

        obligations_to_save = [o for o in obligations if o.quantity_resolved > 0]
        if obligations_to_save:
            StockObligation.objects.bulk_update(
                obligations_to_save,
                [
                    'quantity_remaining', 'status', 'resolved_stock_lot',
                    'resolved_at', 'resolved_by'
                ],
                batch_size=100,
            )

        if produit.use_lot_management and lots_to_update:
            produit.calculate_stock_from_lots()

        resolved_promis = []
        promis_ids = list(promis_to_update)
        if promis_ids:
            for promis in Promis.objects.select_for_update().filter(id__in=promis_ids):
                remaining = StockObligation.objects.filter(
                    promis=promis,
                    status=StockObligation.Status.EN_ATTENTE,
                ).aggregate(total=Sum('quantity_remaining'))['total'] or 0
                if remaining <= 0 and promis.status == Promis.Status.EN_ATTENTE:
                    promis.status = Promis.Status.DELIVRE
                    promis.date_livraison = timezone.now()
                    resolved_promis.append(promis)
            if resolved_promis:
                Promis.objects.bulk_update(
                    resolved_promis, ['status', 'date_livraison'], batch_size=100
                )

        if movements:
            for movement in movements:
                movement.stock_apres = produit.total_stock
            MouvementStock.objects.bulk_create(movements, batch_size=100)

        total_resolved = available_quantity - remaining_capacity
        if total_resolved:
            notify_stock_changed([produit.id])
        return total_resolved

    @staticmethod
    def resolve_for_promis(promis, user=None):
        """Résout les obligations d'un promis avec les lots disponibles."""
        produit = promis.produit
        if not produit:
            raise ValueError("Produit introuvable pour ce promis.")

        remaining = StockObligation.objects.filter(
            promis=promis,
            status=StockObligation.Status.EN_ATTENTE,
        ).aggregate(total=Sum('quantity_remaining'))['total'] or 0
        if remaining <= 0:
            promis.status = Promis.Status.DELIVRE
            promis.date_livraison = timezone.now()
            promis.save(update_fields=['status', 'date_livraison'])
            return 0

        if produit.use_lot_management:
            lot_field = 'quantity_reserved' if produit.has_reserve_storage else 'quantity_remaining'
            physical_available = StockLot.objects.filter(produit=produit).aggregate(
                total=Sum(lot_field)
            )['total'] or 0
            if physical_available < remaining:
                raise ValueError(
                    f"Stock insuffisant pour délivrer {remaining} unité(s) de {produit.name} "
                    f"(disponible: {physical_available})."
                )
            resolved = StockObligationService.resolve_pending_obligations(
                produit,
                available_quantity=remaining,
                user=user,
                movement_description=f'Délivrance Promis #{promis.id}',
                promis=promis,
            )
        else:
            stock_location = (
                StockObligation.StockLocation.RESERVE
                if produit.has_reserve_storage
                else StockObligation.StockLocation.RAYON
            )
            accounting_stock = (
                produit.stock_reserve if produit.has_reserve_storage else produit.stock
            ) or 0
            applied_debt = StockObligationService.pending_quantity(
                produit.id, location=stock_location, stock_applied=True
            )
            physical_available = accounting_stock + applied_debt
            if physical_available < remaining:
                raise ValueError(
                    f"Stock insuffisant pour délivrer {remaining} unité(s) de {produit.name} "
                    f"(disponible: {physical_available})."
                )
            resolved = StockObligationService.resolve_pending_obligations(
                produit,
                available_quantity=remaining,
                user=user,
                movement_description=f'Délivrance Promis #{promis.id}',
                promis=promis,
            )

        promis.refresh_from_db()
        return resolved

    @staticmethod
    def cancel_for_promis(promis, user=None):
        """Annule toutes les obligations restantes d'un promis."""
        restored = 0
        obligations = StockObligation.objects.select_for_update().filter(
            promis=promis,
            status=StockObligation.Status.EN_ATTENTE,
        )
        for obligation in obligations:
            restored += StockObligationService.cancel_obligation(obligation, user=user)
        return restored

    @staticmethod
    def _add_product_stock(produit, quantity, location):
        if not produit or quantity == 0:
            return
        if location == StockObligation.StockLocation.RESERVE:
            Produit.objects.filter(pk=produit.pk).update(stock_reserve=F('stock_reserve') + quantity)
            produit.stock_reserve = (produit.stock_reserve or 0) + quantity
        else:
            Produit.objects.filter(pk=produit.pk).update(stock=F('stock') + quantity)
            produit.stock = (produit.stock or 0) + quantity
