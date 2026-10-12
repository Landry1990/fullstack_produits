"""Logique partagée de fusion de catégories (rayons, formes, groupes)."""
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from ..audit_helpers import log_audit
from ..cache_utils import SearchCache
from ..models import AuditLog, Produit, Rayon


def rayon_descendant_ids(rayon):
    """IDs de tous les descendants directs et indirects d'un rayon."""
    ids = set()
    frontier = [rayon.pk]
    while frontier:
        children = list(
            Rayon.objects.filter(parent_id__in=frontier).values_list('id', flat=True)
        )
        frontier = [c for c in children if c not in ids]
        ids.update(frontier)
    return ids


def merge_category(request, source, target, produit_fk):
    """
    Fusionne `source` dans `target` : réassigne les produits de la source,
    rattache les éventuels sous-rayons à la cible, puis supprime la source.
    Retourne une Response DRF.
    """
    if target.pk == source.pk:
        return Response(
            {'detail': 'La cible doit être différente de la source.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    children = None
    if isinstance(source, Rayon):
        if target.pk in rayon_descendant_ids(source):
            return Response(
                {'detail': 'Impossible de fusionner dans un sous-rayon de la source.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        children = source.sub_rayons.all()

    source_pk = source.pk
    source_label = str(source)

    with transaction.atomic():
        moved_products = Produit.objects.filter(
            **{produit_fk: source}
        ).update(**{produit_fk: target})
        moved_children = children.update(parent=target) if children is not None else 0
        source.delete()

    SearchCache.invalidate_all_products()
    log_audit(
        user=request.user,
        action=AuditLog.Action.DELETE,
        model_name=type(source).__name__,
        object_id=source_pk,
        description=f"Fusion de « {source_label} » dans « {target} »",
        details={
            'source_id': source_pk,
            'target_id': target.pk,
            'moved_products': moved_products,
            'moved_children': moved_children,
        },
        request=request,
    )

    return Response({
        'status': 'success',
        'moved_products': moved_products,
        'moved_children': moved_children,
        'deleted_id': source_pk,
    })
