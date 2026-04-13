from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.db.models import ProtectedError

from ...models import Produit, AuditLog
from ...audit_helpers import log_audit
from ...cache_utils import SearchCache

class ProduitBulkMixin:
    """Mixin pour les opérations en masse sur les produits."""

    @action(detail=False, methods=['post'])
    def bulk_refresh(self, request):
        product_ids = request.data.get('ids', [])
        if not product_ids:
            return Response({'detail': 'Liste d\'IDs requise'}, status=status.HTTP_400_BAD_REQUEST)
        
        produits = Produit.objects.filter(id__in=product_ids).only(
            'id', 'name', 'stock', 'selling_price', 'cip1', 'is_active'
        )
        
        data = []
        for p in produits:
            data.append({
                'id': p.id,
                'name': p.name,
                'stock': p.stock,
                'selling_price': str(p.selling_price),
                'cip1': p.cip1,
                'is_active': p.is_active
            })
            
        return Response(data)

    @action(detail=False, methods=['post'])
    def bulk_toggle_public(self, request):
        ids = request.data.get('ids', [])
        target_status = request.data.get('target_status')
        
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Liste d\'IDs invalide ou vide.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if target_status is None:
             return Response({'detail': 'target_status est requis (true/false).'}, status=status.HTTP_400_BAD_REQUEST)
             
        is_public = bool(target_status)
        
        updated_count = Produit.objects.filter(id__in=ids).update(is_public=is_public)
        SearchCache.invalidate_all_products()
        
        return Response({
            'status': 'success',
            'updated_count': updated_count,
            'message': f"{updated_count} produits mis à jour."
        })

    @action(detail=False, methods=['post'], url_path='bulk-categorize')
    def bulk_categorize(self, request):
        ids = request.data.get('ids', [])
        cat_type = request.data.get('category_type')
        cat_id = request.data.get('category_id')

        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Liste d\'IDs invalide ou vide.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = {
            'rayon': 'rayon_id',
            'forme': 'forme_id',
            'groupe': 'groupe_id'
        }

        if cat_type not in valid_types:
            return Response({'detail': f'Type de catégorie invalide. Valeurs possibles: {", ".join(valid_types.keys())}'}, status=status.HTTP_400_BAD_REQUEST)

        field_name = valid_types[cat_type]
        
        try:
            with transaction.atomic():
                updated_count = Produit.objects.filter(id__in=ids).update(**{field_name: cat_id})
                SearchCache.invalidate_all_products()
                
                log_audit(
                    user=request.user,
                    action=AuditLog.Action.UPDATE,
                    model_name='Produit',
                    object_id=0,
                    description=f"Mise à jour massive ({cat_type}) pour {updated_count} produits.",
                    details={'ids': ids, 'category_type': cat_type, 'category_id': cat_id},
                    request=request
                )

                return Response({
                    'status': 'success',
                    'updated_count': updated_count,
                    'message': f'{updated_count} produits mis à jour avec succès.'
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=400)
            
        try:
            produits = list(Produit.objects.filter(id__in=ids))
            count = len(produits)
            deleted_ids = []
            soft_deleted_ids = []

            for p in produits:
                p_id = p.id
                try:
                    with transaction.atomic():
                        p.delete()
                    deleted_ids.append(p_id)
                except ProtectedError:
                    p = Produit.objects.get(id=p_id)
                    p.is_active = False
                    suffix = " (Produit Supprimé)"
                    if suffix not in p.name:
                        p.name = f"{p.name}{suffix}"
                    p.save(update_fields=['is_active', 'name'])
                    soft_deleted_ids.append(p_id)

            log_audit(
                user=request.user,
                action=AuditLog.Action.DELETE,
                model_name='Produit',
                object_id='BULK',
                description=f"Suppression groupée de {count} produits ({len(deleted_ids)} physiques, {len(soft_deleted_ids)} logiques)",
                details={'deleted_ids': deleted_ids, 'soft_deleted_ids': soft_deleted_ids},
                request=request
            )
            
            SearchCache.invalidate_all_products()
            
            return Response({
                'status': 'success',
                'deleted_count': len(deleted_ids),
                'soft_deleted_count': len(soft_deleted_ids),
                'deleted_ids': deleted_ids,
                'soft_deleted_ids': soft_deleted_ids,
                'message': f'{len(deleted_ids)} supprimés, {len(soft_deleted_ids)} masqués avec succès.'
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)
