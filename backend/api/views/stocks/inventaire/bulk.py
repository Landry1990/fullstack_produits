"""
Opérations bulk (en masse) pour les inventaires.
"""
from typing import List, Dict, Any, Optional, Set, Tuple
from django.db import transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status

from api.models import Inventaire, LigneInventaire, Produit, StockLot, AuditLog
from api.audit_helpers import log_audit


def bulk_delete_lignes_inventaire(
    inventaire: Inventaire,
    ids: List[int],
    user,
    request
) -> Response:
    """
    Suppression groupée de lignes d'inventaire.

    Args:
        inventaire: Instance de l'inventaire
        ids: Liste des IDs de lignes à supprimer
        user: Utilisateur effectuant l'action (pour l'audit)
        request: Requête HTTP (pour l'audit)

    Returns:
        Response DRF avec le résultat de la suppression
    """
    if not ids:
        return Response(
            {'error': 'Aucun ID fourni'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # On s'assure que les lignes appartiennent bien à cet inventaire
    lignes = LigneInventaire.objects.filter(id__in=ids, inventaire=inventaire)
    count = lignes.count()

    if count == 0:
        return Response(
            {'error': 'Aucune ligne correspondante trouvée'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Log d'audit avant suppression
    log_audit(
        user=user,
        action=AuditLog.Action.DELETE,
        model_name='LigneInventaire',
        object_id=str(inventaire.id),
        description=f"Suppression massive de {count} ligne(s) dans l'inventaire #{inventaire.id}",
        details={
            'inventaire_id': inventaire.id,
            'lignes_count': count,
            'lignes_ids': list(ids)
        },
        request=request
    )

    lignes.delete()

    return Response({
        'status': 'success',
        'message': f'{count} lignes supprimées avec succès.',
        'count': count
    })


def bulk_lignes_inventaire(
    inventaire: Inventaire,
    lignes_data: List[Dict[str, Any]]
) -> Response:
    """
    Import en masse de lignes d'inventaire optimisé (Réduction N+1).

    Args:
        inventaire: Instance de l'inventaire cible
        lignes_data: Liste de dictionnaires avec les données des lignes

    Returns:
        Response DRF avec le résultat de l'import
    """
    if not isinstance(lignes_data, list):
        return Response(
            {'error': 'Format invalide'},
            status=status.HTTP_400_BAD_REQUEST
        )

    errors: List[str] = []
    imported_count = 0

    # PRE-CHARGEMENT pour éviter le N+1
    produit_ids: Set[int] = {
        d.get('produit') for d in lignes_data if d.get('produit')
    }
    lot_ids: Set[int] = {
        d.get('stock_lot') for d in lignes_data if d.get('stock_lot')
    }

    produits_map = {p.id: p for p in Produit.objects.filter(id__in=produit_ids)}
    lots_map = {l.id: l for l in StockLot.objects.filter(id__in=lot_ids)}

    # Pour les recherches par numéro de lot
    lot_tuples: Set[Tuple[int, str]] = {
        (d.get('produit'), d.get('lot_numero'))
        for d in lignes_data
        if d.get('lot_numero') and d.get('produit')
    }
    existing_lots_by_num: Dict[Tuple[int, str], StockLot] = {}
    if lot_tuples:
        for l in StockLot.objects.filter(produit_id__in=produit_ids):
            existing_lots_by_num[(l.produit_id, l.lot)] = l

    # Groupement par (produit_id, lot_id) pour fusionner avant bulk_create
    lignes_finales: Dict[Tuple[int, Optional[int]], LigneInventaire] = {}

    for index, data in enumerate(lignes_data):
        try:
            result = _process_bulk_line(
                index=index,
                data=data,
                inventaire=inventaire,
                produits_map=produits_map,
                lots_map=lots_map,
                existing_lots_by_num=existing_lots_by_num,
                lignes_finales=lignes_finales
            )
            if result:
                imported_count += result

        except Exception as e:
            errors.append(f"Ligne {index}: {str(e)}")

    if lignes_finales:
        LigneInventaire.objects.bulk_create(lignes_finales.values())

    return Response({
        'status': 'Import terminé',
        'imported': imported_count,
        'errors': errors
    }, status=status.HTTP_201_CREATED if imported_count > 0 else status.HTTP_400_BAD_REQUEST)


def _process_bulk_line(
    index: int,
    data: Dict[str, Any],
    inventaire: Inventaire,
    produits_map: Dict[int, Produit],
    lots_map: Dict[int, StockLot],
    existing_lots_by_num: Dict[Tuple[int, str], StockLot],
    lignes_finales: Dict[Tuple[int, Optional[int]], LigneInventaire]
) -> int:
    """
    Traite une ligne d'import bulk et retourne 1 si une ligne est créée/modifiée, 0 sinon.

    Args:
        index: Index de la ligne pour les messages d'erreur
        data: Données de la ligne
        inventaire: Instance de l'inventaire
        produits_map: Cache des produits
        lots_map: Cache des lots par ID
        existing_lots_by_num: Cache des lots par (produit_id, lot_numero)
        lignes_finales: Dict des lignes à créer (modifié par effet de bord)

    Returns:
        1 si ligne traitée avec succès, 0 sinon
    """
    from django.core.exceptions import ValidationError

    p_id = data.get('produit')
    produit = produits_map.get(p_id)
    if not produit:
        raise ValueError(f"Produit {p_id} inconnu")

    target_lot = None

    # 1. Par ID de lot
    if data.get('stock_lot'):
        target_lot = lots_map.get(data['stock_lot'])

    # 2. Par Numéro de lot
    elif data.get('lot_numero'):
        key = (p_id, data['lot_numero'])
        target_lot = existing_lots_by_num.get(key)
        if not target_lot:
            try:
                # Création à la volée du lot manquant
                target_lot = StockLot.objects.create(
                    produit=produit,
                    lot=data['lot_numero'],
                    date_expiration=data.get('lot_expiration') if data.get('lot_expiration') else None,
                    quantity_remaining=0,
                    quantity_initial=0,
                    price_cost=produit.cost_price or 0,
                    selling_price=produit.selling_price or 0,
                    date_reception=timezone.now()
                )
                existing_lots_by_num[key] = target_lot
            except ValidationError:
                raise ValueError(f"Date invalide pour le lot {data['lot_numero']}")

    # Déterminer le stock théorique
    stock_theorique = target_lot.quantity_remaining if target_lot else produit.stock
    qte_saisie = int(data.get('quantite_physique', data.get('quantite_comptee', stock_theorique)))

    # --- MERGE IN BULK ---
    lot_id = target_lot.id if target_lot else None
    merge_key = (p_id, lot_id)

    if merge_key in lignes_finales:
        lignes_finales[merge_key].quantite_physique += qte_saisie
        # l'écart sera calculé lors du save() ou manuellement
        lignes_finales[merge_key].ecart = (
            lignes_finales[merge_key].quantite_physique - stock_theorique
        )
        return 1
    else:
        # On vérifie s'il existe déjà une ligne en base pour cet inventaire
        existing_in_db = LigneInventaire.objects.filter(
            inventaire=inventaire, produit=produit, stock_lot=target_lot
        ).first()

        if existing_in_db:
            existing_in_db.quantite_physique += qte_saisie
            existing_in_db.ecart = existing_in_db.quantite_physique - stock_theorique
            existing_in_db.save()
            return 1
        else:
            lignes_finales[merge_key] = LigneInventaire(
                inventaire=inventaire,
                produit=produit,
                stock_lot=target_lot,
                stock_theorique=stock_theorique,
                quantite_physique=qte_saisie,
                ecart=qte_saisie - stock_theorique,
                pmp_snapshot=produit.pmp or produit.cost_price or 0
            )
            return 1
