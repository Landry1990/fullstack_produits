"""
Fonctions de fusion (merge) pour les inventaires.
"""
from typing import Dict, Any
from django.db import transaction
from rest_framework.response import Response
from rest_framework import status

from api.models import Inventaire, LigneInventaire, AuditLog
from api.audit_helpers import log_audit


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

    # Logique de fusion
    merged_count = 0
    moved_count = 0

    source_lignes = source_inventaire.lignes.all()

    for source_ligne in source_lignes:
        # Chercher une ligne compatible dans la cible (même produit ET même lot)
        compatible_line = LigneInventaire.objects.filter(
            inventaire=target_inventaire,
            produit=source_ligne.produit,
            stock_lot=source_ligne.stock_lot
        ).first()

        if compatible_line:
            # Fusionner : additionner la quantité saisie ET le théorique pour garder l'écart juste
            compatible_line.quantite_physique += source_ligne.quantite_physique
            compatible_line.stock_theorique += source_ligne.stock_theorique
            compatible_line.save()
            source_ligne.delete()
            merged_count += 1
        else:
            # Déplacer : changer l'inventaire parent
            source_ligne.inventaire = target_inventaire
            source_ligne.save()
            moved_count += 1

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
