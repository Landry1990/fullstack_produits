"""
Fonctions de fusion (merge) pour les inventaires.
"""
from rest_framework import status
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.models import AuditLog, Inventaire, LigneInventaire


def merge_inventaires(
    target_inventaire: Inventaire,
    source_id: int,
    user,
    request
) -> Response:
    """
    Fusionne un autre inventaire (source) dans l'inventaire actuel (cible).
    L'inventaire source est ensuite supprimé.

    Args:
        target_inventaire: Inventaire cible
        source_id: ID de l'inventaire source à fusionner
        user: Utilisateur effectuant l'action
        request: Requête HTTP

    Returns:
        Response DRF avec le résultat de la fusion
    """
    if not source_id:
        return Response(
            {'error': 'source_inventaire_id requis'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if str(source_id) == str(target_inventaire.id):
        return Response(
            {'error': 'Impossible de fusionner un inventaire avec lui-même'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        source_inventaire = Inventaire.objects.get(id=source_id)
    except Inventaire.DoesNotExist:
        return Response(
            {'error': 'Inventaire source introuvable'},
            status=status.HTTP_404_NOT_FOUND
        )

    if target_inventaire.status != source_inventaire.status:
        return Response(
            {'error': 'Les deux inventaires doivent avoir le même état (Clôturé ou En préparation)'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Logique de fusion — version optimisée en opérations en masse
    # (évite le N+1 : 1 requête par ligne source → ~15k requêtes sur gros inventaires)

    # 1. Charger les lignes cibles en un dict {(produit_id, stock_lot_id): ligne}
    #    setdefault garde la première occurrence (même sémantique que filter().first())
    target_lines = {}
    for l in LigneInventaire.objects.filter(inventaire=target_inventaire):
        target_lines.setdefault((l.produit_id, l.stock_lot_id), l)

    # 2. Charger toutes les lignes source en une requête (IDs seulement, pas de lazy-load FK)
    source_lignes = list(
        source_inventaire.lignes.values('id', 'produit_id', 'stock_lot_id',
                                        'quantite_physique', 'stock_theorique')
    )

    # 3. Partitionner : lignes à fusionner dans la cible vs lignes à déplacer
    to_update = {}
    merged_source_ids = []

    for s in source_lignes:
        compatible_line = target_lines.get((s['produit_id'], s['stock_lot_id']))
        if compatible_line:
            if compatible_line.id not in to_update:
                to_update[compatible_line.id] = compatible_line
            compatible_line.quantite_physique += s['quantite_physique']
            compatible_line.stock_theorique += s['stock_theorique']
            compatible_line.ecart = compatible_line.quantite_physique - compatible_line.stock_theorique
            merged_source_ids.append(s['id'])

    merged_count = len(merged_source_ids)

    # 4. Supprimer d'abord les lignes source fusionnées (contrainte unique inventaire+lot)
    if merged_source_ids:
        LigneInventaire.objects.filter(id__in=merged_source_ids).delete()

    # 5. Déplacer les lignes restantes de la source vers la cible (1 requête)
    #    .update() ne réécrit pas ecart, mais quantite_physique/stock_theorique
    #    sont inchangés → l'écart reste correct.
    moved_count = LigneInventaire.objects.filter(
        inventaire=source_inventaire
    ).update(inventaire=target_inventaire)

    # 6. Persister les lignes cibles fusionnées (1 requête par batch)
    if to_update:
        LigneInventaire.objects.bulk_update(
            list(to_update.values()),
            ['quantite_physique', 'stock_theorique', 'ecart']
        )

    # Rattacher les mouvements de stock de la source vers la cible avant suppression
    source_inventaire.mouvements_stock.update(inventaire=target_inventaire)

    # Supprimer l'inventaire source vide
    source_inventaire.delete()

    log_audit(
        user=user,
        action=AuditLog.Action.UPDATE,
        model_name='Inventaire',
        object_id=target_inventaire.id,
        description=f"Fusion inventaire #{source_id} -> #{target_inventaire.id}",
        details={
            'source_id': source_id,
            'merged_lines': merged_count,
            'moved_lines': moved_count
        },
        request=request
    )

    return Response({
        'status': 'Fusion réussie',
        'merged_lines': merged_count,
        'moved_lines': moved_count,
        'source_deleted': True
    })


def merge_duplicate_lines(inventaire: Inventaire) -> Response:
    """
    Fusionne les lignes en doublon au sein du même inventaire.
    Doublon défini par : même produit et même lot (ou pas de lot).

    Args:
        inventaire: Instance de l'inventaire à traiter

    Returns:
        Response DRF avec le résultat de la fusion
    """
    if inventaire.status != Inventaire.Status.EN_COURS:
        return Response(
            {'error': 'L\'inventaire doit être EN_COURS'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Identifier les groupes de doublons
    from django.db.models import Count as DjCount

    # On groupe par produit et stock_lot
    duplicates = inventaire.lignes.values('produit', 'stock_lot').annotate(
        count=DjCount('id')
    ).filter(count__gt=1)

    total_merged = 0
    groups_processed = 0

    for group in duplicates:
        produit_id = group['produit']
        stock_lot_id = group['stock_lot']

        # Récupérer les lignes concernées
        lines = inventaire.lignes.filter(
            produit_id=produit_id,
            stock_lot_id=stock_lot_id
        ).order_by('id')

        if lines.exists():
            primary_line = lines.first()
            other_lines = lines.exclude(id=primary_line.id)

            # Somme des quantités physiques
            total_qty = primary_line.quantite_physique + sum(
                l.quantite_physique for l in other_lines
            )

            # Mise à jour de la ligne principale
            primary_line.quantite_physique = total_qty
            primary_line.save()

            # Suppression des doublons
            deleted_count = other_lines.count()
            other_lines.delete()

            total_merged += deleted_count
            groups_processed += 1

    return Response({
        'status': 'Fusion des doublons terminée',
        'groups_processed': groups_processed,
        'lines_merged': total_merged
    })
