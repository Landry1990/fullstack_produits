"""
Opérations bulk (en masse) pour les inventaires.
"""
from typing import Any

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.models import AuditLog, Inventaire, LigneInventaire, Produit, StockLot
from api.serializers import LigneInventaireSerializer
from api.utils.validation import parse_id, validation_error_message


def bulk_delete_lignes_inventaire(
    inventaire: Inventaire,
    ids: list[int],
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

    # Assainissement des IDs : liste obligatoire, chaque id → entier >= 1
    # (sinon id__in=['abc'] lèverait ValueError → 500)
    if not isinstance(ids, (list, tuple)):
        return Response(
            {'error': "Le paramètre 'ids' doit être une liste d'identifiants."},
            status=status.HTTP_400_BAD_REQUEST
        )
    try:
        ids = [parse_id(value, field='ids') for value in ids]
    except DRFValidationError as exc:
        return Response(
            {'error': validation_error_message(exc)},
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
    lignes_data: list[dict[str, Any]]
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

    errors: list[str] = []
    imported_count = 0

    def _safe_int_id(val: Any) -> int | None:
        """Retourne un int ou None si la valeur n'est pas un ID convertible."""
        try:
            return int(val)
        except (TypeError, ValueError, OverflowError):
            return None

    # PRE-CHARGEMENT pour éviter le N+1
    # (IDs non convertibles / lignes non-dict ignorés ici — la ligne produira
    #  une erreur collectée plus bas dans _process_bulk_line)
    produit_ids: set[int] = {
        pid for pid in (
            _safe_int_id(d.get('produit') if isinstance(d, dict) else None)
            for d in lignes_data
        )
        if pid is not None
    }
    lot_ids: set[int] = {
        lid for lid in (
            _safe_int_id(d.get('stock_lot') if isinstance(d, dict) else None)
            for d in lignes_data
        )
        if lid is not None
    }

    # select_related('rayon') : produit.rayon.name est lu lors de la
    # sérialisation des lignes retournées — sans lui, un lazy-load par produit.
    produits_map = {
        p.id: p
        for p in Produit.objects.filter(id__in=produit_ids).select_related('rayon')
    }
    lots_map = {l.id: l for l in StockLot.objects.filter(id__in=lot_ids)}

    # Pour les recherches par numéro de lot
    lot_tuples: set[tuple[int, str]] = {
        (_safe_int_id(d.get('produit')), d.get('lot_numero'))
        for d in lignes_data
        if isinstance(d, dict) and d.get('lot_numero') and _safe_int_id(d.get('produit')) is not None
    }
    existing_lots_by_num: dict[tuple[int, str], StockLot] = {}
    if lot_tuples:
        lot_nums = {num for _, num in lot_tuples}
        for l in StockLot.objects.filter(produit_id__in=produit_ids, lot__in=lot_nums):
            existing_lots_by_num[(l.produit_id, l.lot)] = l

    # Pré-chargement des lignes déjà présentes pour cet inventaire :
    # une seule requête au lieu d'un .filter().first() par ligne du payload.
    # select_related pour la sérialisation de la réponse (évite le lazy-load).
    existing_lignes_map: dict[tuple[int, int | None], LigneInventaire] = {
        (l.produit_id, l.stock_lot_id): l
        for l in LigneInventaire.objects
        .filter(inventaire=inventaire, produit_id__in=produit_ids)
        .select_related('produit', 'produit__rayon', 'stock_lot')
    }

    # Groupement par (produit_id, lot_id) pour fusionner avant bulk_create
    lignes_finales: dict[tuple[int, int | None], LigneInventaire] = {}
    # Lignes existantes mises à jour (collectées pour un seul bulk_update)
    lignes_maj: dict[tuple[int, int | None], LigneInventaire] = {}

    for index, data in enumerate(lignes_data):
        try:
            result = _process_bulk_line(
                index=index,
                data=data,
                inventaire=inventaire,
                produits_map=produits_map,
                lots_map=lots_map,
                existing_lots_by_num=existing_lots_by_num,
                existing_lignes_map=existing_lignes_map,
                lignes_finales=lignes_finales,
                lignes_maj=lignes_maj
            )
            if result:
                imported_count += result

        except Exception as e:
            errors.append(f"Ligne {index}: {e!s}")

    if lignes_finales:
        LigneInventaire.objects.bulk_create(lignes_finales.values())
    if lignes_maj:
        LigneInventaire.objects.bulk_update(lignes_maj.values(), ['quantite_physique', 'ecart'])

    # Les lignes créées/mises à jour sont renvoyées sérialisées : le client
    # peut fusionner sa copie locale sans recharger tout l'inventaire (GET lignes).
    affected = [*lignes_maj.values(), *lignes_finales.values()]
    lignes_payload = LigneInventaireSerializer(affected, many=True).data

    return Response({
        'status': 'Import terminé',
        'imported': imported_count,
        'errors': errors,
        'lignes': lignes_payload,
    }, status=status.HTTP_201_CREATED if imported_count > 0 else status.HTTP_400_BAD_REQUEST)


def _process_bulk_line(
    index: int,
    data: dict[str, Any],
    inventaire: Inventaire,
    produits_map: dict[int, Produit],
    lots_map: dict[int, StockLot],
    existing_lots_by_num: dict[tuple[int, str], StockLot],
    existing_lignes_map: dict[tuple[int, int | None], LigneInventaire],
    lignes_finales: dict[tuple[int, int | None], LigneInventaire],
    lignes_maj: dict[tuple[int, int | None], LigneInventaire]
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
        existing_lignes_map: Cache des lignes existantes par (produit_id, lot_id)
        lignes_finales: Dict des lignes à créer (modifié par effet de bord)
        lignes_maj: Dict des lignes existantes à mettre à jour (modifié par effet de bord)

    Returns:
        1 si ligne traitée avec succès, 0 sinon
    """
    from django.core.exceptions import ValidationError

    p_id = data.get('produit')
    try:
        # Normalise les IDs numériques envoyés en string ('5' → 5)
        p_id = int(p_id)
    except (TypeError, ValueError, OverflowError):
        raise ValueError(f"Produit {p_id!r} inconnu")

    produit = produits_map.get(p_id)
    if not produit:
        raise ValueError(f"Produit {p_id} inconnu")
    if produit.is_service:
        raise ValueError(f"Le produit {produit.name} est un service — non concerné par l'inventaire.")

    target_lot = None

    # Si le produit gère par lot, un lot doit obligatoirement être spécifié
    # (par ID ou par numéro) — sinon on risque de fusionner des lots différents
    if produit.use_lot_management and not data.get('stock_lot') and not data.get('lot_numero'):
        raise ValueError(f"Le produit {produit.name} gère par lot — veuillez spécifier un lot.")

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

    # Garde-fou : un produit géré par lot dont le lot n'a pas pu être résolu
    # (ID invalide/inexistant) ne doit pas créer de ligne sans lot.
    if produit.use_lot_management and target_lot is None:
        raise ValueError(f"Lot introuvable pour le produit {produit.name}.")

    # Déterminer le stock théorique
    if target_lot:
        if inventaire.inventory_type == Inventaire.TypeStock.RESERVE:
            stock_theorique = target_lot.quantity_reserved or 0
        elif inventaire.inventory_type == Inventaire.TypeStock.GLOBAL:
            stock_theorique = (target_lot.quantity_remaining or 0) + (target_lot.quantity_reserved or 0)
        else:
            stock_theorique = target_lot.quantity_remaining
    else:
        stock_theorique = produit.stock
    raw_qte = data.get('quantite_physique', data.get('quantite_comptee', stock_theorique))
    try:
        if isinstance(raw_qte, bool) or (isinstance(raw_qte, float) and not raw_qte.is_integer()):
            raise ValueError
        qte_saisie = int(raw_qte)
    except (TypeError, ValueError, OverflowError):
        raise ValueError("La quantité physique doit être un nombre entier.")
    if qte_saisie < 0:
        raise ValueError("La quantité physique ne peut pas être négative.")
    replace_quantity = data.get('mode') == 'replace'

    # --- MERGE IN BULK ---
    lot_id = target_lot.id if target_lot else None
    merge_key = (p_id, lot_id)

    if merge_key in lignes_finales:
        if replace_quantity:
            lignes_finales[merge_key].quantite_physique = qte_saisie
        else:
            lignes_finales[merge_key].quantite_physique += qte_saisie
        # l'écart sera calculé lors du save() ou manuellement
        lignes_finales[merge_key].ecart = (
            lignes_finales[merge_key].quantite_physique - stock_theorique
        )
        return 1

    # Ligne déjà en base ? (pré-chargée — pas de requête ici)
    # On la regarde d'abord dans lignes_maj : un merge_key déjà traité dans
    # ce payload doit cumuler sur la même instance en mémoire.
    existing_in_db = lignes_maj.get(merge_key) or existing_lignes_map.get(merge_key)
    if existing_in_db is not None:
        if replace_quantity:
            existing_in_db.quantite_physique = qte_saisie
        else:
            existing_in_db.quantite_physique += qte_saisie
        existing_in_db.ecart = existing_in_db.quantite_physique - stock_theorique
        lignes_maj[merge_key] = existing_in_db
        return 1

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
