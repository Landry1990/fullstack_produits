"""
Validation d'inventaire avec support des lots et gestion des stocks.
Utilise Optimistic Locking (pas de select_for_update) pour 12 postes simultanés.
"""
from typing import Dict, List, Optional, Tuple, Any
from django.db import transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum
import time

from api.models import (
    Inventaire, LigneInventaire, Produit, StockLot,
    StockAdjustment, MouvementStock, AuditLog
)
from api.audit_helpers import log_audit
from api.sudo_utils import validate_sudo_mode
from api.optimistic_locking import ConcurrentModificationError


def validate_inventaire(
    inventaire: Inventaire,
    request
) -> Response:
    """
    Validation de l'inventaire avec support des lots.
    Support du mode SUDO (validated_by_id).
    Optimisé: utilise bulk_update/bulk_create pour minimiser les requêtes SQL.

    Args:
        inventaire: Instance de l'inventaire à valider
        request: Requête HTTP contenant éventuellement validated_by_id

    Returns:
        Response DRF avec le résultat de la validation
    """
    if inventaire.status == Inventaire.Status.VALIDEE:
        return Response(
            {'detail': 'Cet inventaire est déjà validé.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    validator, error_res = validate_sudo_mode(request, permission_attr='can_adjust_stock')
    if error_res:
        return error_res

    inventaire.validated_by = validator

    # 1. Préparation et Verrouillage Atomique
    # On récupère toutes les lignes avec leurs relations
    lignes = list(inventaire.lignes.select_related('produit', 'stock_lot').all())
    if not lignes:
        return Response(
            {'detail': 'Cet inventaire est vide.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # On verrouille les Produits et les Lots pour éviter toute modification concurrentielle (ex: vente)
    product_ids = {l.produit_id for l in lignes if l.produit_id}
    lot_ids = {l.stock_lot_id for l in lignes if l.stock_lot_id}

    # OPTIMISTIC LOCKING: Récupérer sans verrou, vérifier versions avant sauvegarde
    products_list = list(Produit.objects.filter(id__in=product_ids))
    products_map = {p.id: p for p in products_list}
    initial_product_versions = {p.id: p.version for p in products_list}

    lots_list = list(StockLot.objects.filter(id__in=lot_ids))
    lots_map = {l.id: l for l in lots_list}
    initial_lot_versions = {l.id: l.version for l in lots_list}

    # Collections pour les opérations batch
    lots_to_update: Dict[int, StockLot] = {}
    adjustments_to_create: List[StockAdjustment] = []
    mouvements_to_create: List[MouvementStock] = []
    remaining_capacities: Dict[int, int] = {}
    now = timezone.now()

    # Phase 2 : Traitement en mémoire
    for ligne in lignes:
        produit = products_map.get(ligne.produit_id)
        if not produit:
            continue

        target_lot = lots_map.get(ligne.stock_lot_id)
        if not target_lot:
            lot_number = f"LOT-INV-{inventaire.id}"
            target_lot, created = StockLot.objects.get_or_create(
                produit=produit, lot=lot_number,
                defaults={
                    'quantity_initial': ligne.quantite_physique,
                    'quantity_remaining': ligne.quantite_physique,
                    'price_cost': ligne.pmp_snapshot or produit.cost_price or 0,
                    'date_reception': inventaire.date,
                    'fournisseur': produit.fournisseur
                }
            )
            ligne.stock_lot = target_lot

        # Calculer l'écart et le PMP en mémoire
        ligne.ecart = ligne.quantite_physique - ligne.stock_theorique
        if (not ligne.pmp_snapshot or ligne.pmp_snapshot == 0) and ligne.produit:
            ligne.pmp_snapshot = ligne.produit.pmp or ligne.produit.cost_price or 0

        # Déterminer la répartition du stock sur le lot
        if inventaire.inventory_type == Inventaire.TypeStock.GLOBAL:
            # Logique d'overflow : on remplit le rayon jusqu'à capacité, le reste en réserve
            if produit.id not in remaining_capacities:
                # On initialise la capacité restante basée sur les paramètres du produit
                remaining_capacities[produit.id] = produit.capacite_rayon if produit.has_reserve_storage else 999999999

            qty_rayon = min(ligne.quantite_physique, remaining_capacities[produit.id])
            qty_reserve = ligne.quantite_physique - qty_rayon
            remaining_capacities[produit.id] -= qty_rayon

            target_lot.quantity_remaining = qty_rayon
            target_lot.quantity_reserved = qty_reserve
        elif inventaire.inventory_type == Inventaire.TypeStock.RESERVE:
            target_lot.quantity_reserved = ligne.quantite_physique
        else:
            # RAYON
            target_lot.quantity_remaining = ligne.quantite_physique

        lots_to_update[target_lot.id] = target_lot

        # Préparer la traçabilité (sans écrire en DB)
        ecart = ligne.ecart
        if ecart != 0:
            adjustments_to_create.append(StockAdjustment(
                produit=produit, stock_lot=target_lot, user=validator,
                quantity_before=ligne.stock_theorique,
                quantity_after=ligne.quantite_physique,
                quantity_change=ecart,
                reason_type='INVENTAIRE',
                reason_detail=f"Inventaire #{inventaire.id}"
            ))
            mouvements_to_create.append(MouvementStock(
                produit=produit,
                inventaire=inventaire,
                type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                quantite=ecart,
                user=validator,
                description=f"Inventaire #{inventaire.id} (Lot {target_lot.lot})",
                date=now
            ))

    # Phase 3 : Création Groupée (Writings)

    # 3a. Mise à jour des lignes
    if lignes:
        LigneInventaire.objects.bulk_update(lignes, ['ecart', 'pmp_snapshot', 'stock_lot'])

    # 3b. Mise à jour des lots avec incrémentation de version
    if lots_to_update:
        for lot in lots_to_update.values():
            lot.version += 1
        StockLot.objects.bulk_update(lots_to_update.values(), ['quantity_remaining', 'quantity_reserved', 'version'])

    # 3c. Création des ajustements de stock
    if adjustments_to_create:
        StockAdjustment.objects.bulk_create(adjustments_to_create)

    # Phase 4 : Recalcul Groupé des Produits avec Optimistic Locking
    # Vérifier qu'aucun produit n'a été modifié entre-temps
    current_versions = {p.id: p.version for p in Produit.objects.filter(id__in=product_ids)}
    version_conflicts = [
        pid for pid in initial_product_versions
        if initial_product_versions[pid] != current_versions.get(pid, 0)
    ]
    if version_conflicts:
        return Response({
            'detail': f'Conflit de concurrence détecté sur {len(version_conflicts)} produits.',
            'error_code': 'CONCURRENT_MODIFICATION'
        }, status=status.HTTP_409_CONFLICT)
    
    # On active la gestion par lots si nécessaire
    prods_needing_lot_flag = [p for p in products_list if not p.use_lot_management]
    if prods_needing_lot_flag:
        for p in prods_needing_lot_flag:
            p.use_lot_management = True
        Produit.objects.bulk_update(prods_needing_lot_flag, ['use_lot_management'])

    # Recalcul massif des stocks consolidés (produit = somme des lots)
    for prod in products_list:
        # On agrège les lots pour ce produit
        results = StockLot.objects.filter(produit=prod).aggregate(
            total_remaining=Sum('quantity_remaining'),
            total_reserved=Sum('quantity_reserved')
        )
        prod.stock = results['total_remaining'] or 0
        prod.stock_reserve = results['total_reserved'] or 0

        # Mise à jour du snapshot de stock final dans les objets mouvements EN MÉMOIRE
        # avant qu'ils ne soient créés en base
        for mov in mouvements_to_create:
            if mov.produit_id == prod.id:
                mov.stock_apres = prod.total_stock

    # Phase 5 : Finalisation des écritures
    # 5a. Création des mouvements (avec le stock_apres maintenant renseigné)
    if mouvements_to_create:
        MouvementStock.objects.bulk_create(mouvements_to_create)

    # 5b. Sauvegarde massive des produits avec incrémentation de version
    for prod in products_list:
        prod.version += 1
    Produit.objects.bulk_update(products_list, ['stock', 'stock_reserve', 'version'])

    inventaire.status = Inventaire.Status.VALIDEE
    inventaire.save()

    log_audit(
        user=request.user,
        action=AuditLog.Action.INVENTORY_VALIDATE,
        model_name='Inventaire',
        object_id=inventaire.id,
        description=f"Inventaire #{inventaire.id} validé par {validator.username}",
        request=request
    )

    return Response({'status': 'Inventaire validé.', 'validated_by': validator.username})
