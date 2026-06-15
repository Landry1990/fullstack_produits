"""
Corbeille (Trash / Recycle Bin) - API Views.

Centralises all soft-deleted (is_active=False) items from:
  - Produit
  - Client
  - Fournisseur

Provides list, restore, and permanent delete actions.
"""
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework import status
from django.db import transaction
from django.db.models import ProtectedError

from django.contrib.auth.models import User
from ..models import Produit, Client, Fournisseur, Commande, Avoir, Promis, Inventaire, Facture
from ..cache_utils import SearchCache
from ..audit_helpers import log_audit
from ..models import AuditLog


MODEL_MAP = {
    'produit': Produit,
    'client': Client,
    'fournisseur': Fournisseur,
    'commande': Commande,
    'avoir': Avoir,
    'promis': Promis,
    'inventaire': Inventaire,
    'facture': Facture,
    'user': User,
}


class CorbeilleViewSet(ViewSet):
    """
    Corbeille: manage soft-deleted items.
    
    GET  /api/corbeille/           → list all trashed items
    POST /api/corbeille/restore/   → restore item(s)  {model, ids}
    POST /api/corbeille/purge/     → permanently delete {model, ids}
    POST /api/corbeille/empty/     → permanently delete ALL trashed items
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Return all soft-deleted items grouped by model."""
        items = {
            'produits': [],
            'clients': [],
            'fournisseurs': [],
            'commandes': [],
            'avoirs': [],
            'promis': [],
            'inventaires': [],
            'factures': [],
            'users': [],
        }

        # Produits inactifs
        for p in Produit.objects.filter(is_active=False).order_by('-updated_at')[:200]:
            items['produits'].append({
                'id': p.id,
                'name': p.name,
                'type': 'produit',
                'details': {
                    'stock': p.stock,
                    'cost_price': float(p.cost_price or 0),
                    'selling_price': float(p.selling_price or 0),
                    'cip1': p.cip1,
                },
                'deleted_at': p.updated_at.isoformat() if p.updated_at else None,
            })

        # Clients inactifs
        for c in Client.objects.filter(is_active=False).order_by('-created_at')[:200]:
            items['clients'].append({
                'id': c.id,
                'name': c.name,
                'type': 'client',
                'details': {
                    'phone': c.phone,
                    'email': c.email,
                    'client_type': c.client_type,
                },
                'deleted_at': c.created_at.isoformat() if c.created_at else None,
            })

        # Fournisseurs inactifs
        for f in Fournisseur.objects.filter(is_active=False):
            items['fournisseurs'].append({
                'id': f.id,
                'name': f.name,
                'type': 'fournisseur',
                'details': {
                    'phone': f.phone,
                    'email': f.email,
                },
                'deleted_at': None,
            })

        # Commandes inactives
        for c in Commande.objects.filter(is_active=False).select_related('fournisseur').order_by('-date')[:100]:
            items['commandes'].append({
                'id': c.id,
                'name': f"Commande {c.id} ({c.numero_facture or 'Sans N°'})",
                'type': 'commande',
                'details': {
                    'fournisseur': c.fournisseur.name if c.fournisseur else c.fournisseur_nom,
                    'status': c.get_status_display(),  # type: ignore[attr-defined]
                },
                'deleted_at': c.date.isoformat() if c.date else None,
            })

        # Avoirs inactifs
        for a in Avoir.objects.filter(is_active=False).select_related('fournisseur').order_by('-created_at')[:100]:
            items['avoirs'].append({
                'id': a.id,
                'name': f"Avoir {a.numero}",
                'type': 'avoir',
                'details': {
                    'fournisseur': a.fournisseur.name if a.fournisseur else a.fournisseur_nom,
                    'status': a.get_status_display(),  # type: ignore[attr-defined]
                },
                'deleted_at': a.updated_at.isoformat() if a.updated_at else None,
            })

        # Promis inactifs
        for p in Promis.objects.filter(is_active=False).select_related('client', 'produit').order_by('-date_promis')[:100]:
            items['promis'].append({
                'id': p.id,
                'name': f"Promis {p.produit.name if p.produit else p.produit_nom}",
                'type': 'promis',
                'details': {
                    'client': p.client_display,
                    'status': p.get_status_display(),  # type: ignore[attr-defined]
                    'quantite': p.quantite,
                },
                'deleted_at': p.date_promis.isoformat() if p.date_promis else None,
            })

        # Inventaires inactifs
        for i in Inventaire.objects.filter(is_active=False).order_by('-date')[:100]:
            items['inventaires'].append({
                'id': i.id,  # type: ignore[attr-defined]
                'name': f"Inventaire {i.reference or i.id}",  # type: ignore[attr-defined]
                'type': 'inventaire',
                'details': {
                    'status': i.get_status_display(),  # type: ignore[attr-defined]
                    'type': i.get_inventory_type_display(),  # type: ignore[attr-defined]
                },
                'deleted_at': i.date.isoformat() if i.date else None,
            })

        # Factures inactives
        for f in Facture.objects.filter(is_active=False).select_related('client').order_by('-date')[:100]:
            items['factures'].append({
                'id': f.id,
                'name': f"Facture {f.numero_facture or f.id}",
                'type': 'facture',
                'details': {
                    'client': f.client.name if f.client else f.client_name_override,
                    'status': f.get_status_display(),  # type: ignore[attr-defined]
                    'total': float(f.total_ttc),
                },
                'deleted_at': f.date.isoformat() if f.date else None,
            })

        # Utilisateurs inactifs
        for u in User.objects.filter(is_active=False).order_by('-date_joined')[:100]:
            items['users'].append({
                'id': u.id,
                'name': u.username,
                'type': 'user',
                'details': {
                    'email': u.email,
                    'first_name': u.first_name,
                    'last_name': u.last_name,
                },
                'deleted_at': u.date_joined.isoformat() if u.date_joined else None,
            })

        total = sum(len(v) for v in items.values())
        return Response({
            'total': total,
            'items': items,
        })

    @action(detail=False, methods=['post'])
    def restore(self, request):
        """Restore soft-deleted item(s). Body: {model: 'produit', ids: [1,2]}"""
        model_key = request.data.get('model', '').lower()
        ids = request.data.get('ids', [])

        if model_key not in MODEL_MAP:
            return Response({'error': f'Modèle invalide: {model_key}'}, status=400)
        if not ids:
            return Response({'error': 'Aucun ID fourni'}, status=400)

        Model = MODEL_MAP[model_key]
        count = 0

        with transaction.atomic():
            qs = Model.objects.filter(id__in=ids, is_active=False)
            for obj in qs:
                obj.is_active = True
                # Clean up the "(Produit Supprimé)" or "(Produit inactif)" suffix
                if model_key == 'produit':
                    obj.name = (obj.name
                        .replace(' (Produit Supprimé)', '')
                        .replace(' (Produit inactif)', ''))
                obj.save()
                count += 1

            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name=Model.__name__,
                object_id=0,
                description=f"Restauration depuis la corbeille: {count} {model_key}(s)",
                details={'ids': ids},
                request=request
            )

        if model_key == 'produit':
            SearchCache.invalidate_all_products()

        return Response({
            'status': 'success',
            'restored': count,
            'message': f'{count} élément(s) restauré(s) avec succès.'
        })

    @action(detail=False, methods=['post'])
    def purge(self, request):
        """Permanently delete item(s). Body: {model: 'produit', ids: [1,2]}"""
        model_key = request.data.get('model', '').lower()
        ids = request.data.get('ids', [])

        if model_key not in MODEL_MAP:
            return Response({'error': f'Modèle invalide: {model_key}'}, status=400)
        if not ids:
            return Response({'error': 'Aucun ID fourni'}, status=400)

        Model = MODEL_MAP[model_key]

        try:
            with transaction.atomic():
                qs = Model.objects.filter(id__in=ids, is_active=False)
                if model_key == 'user':
                    names = list(qs.values_list('username', flat=True))
                elif model_key == 'facture':
                    names = list(qs.values_list('numero_facture', flat=True))
                elif model_key == 'inventaire':
                    names = list(qs.values_list('reference', flat=True))
                elif model_key == 'commande':
                    names = list(qs.values_list('numero_facture', flat=True))
                elif model_key == 'avoir':
                    names = list(qs.values_list('numero', flat=True))
                elif model_key == 'promis':
                    names = list(qs.values_list('id', flat=True)) # Promis has no direct simple name
                else:
                    names = list(qs.values_list('name', flat=True)) if hasattr(Model, 'name') else [str(i) for i in ids]
                
                count = qs.count()
                qs.delete()

                log_audit(
                    user=request.user,
                    action=AuditLog.Action.DELETE,
                    model_name=Model.__name__,
                    object_id=0,
                    description=f"Suppression définitive (corbeille): {count} {model_key}(s) - {', '.join(names[:5])}",
                    details={'ids': ids, 'names': names},
                    request=request
                )
        except ProtectedError:
            return Response({
                'error': 'Impossible de supprimer définitivement',
                'detail': "Certains éléments sont liés à d'autres enregistrements."
            }, status=400)

        if model_key == 'produit':
            SearchCache.invalidate_all_products()

        return Response({
            'status': 'success',
            'deleted': count,
            'message': f'{count} élément(s) supprimé(s) définitivement.'
        })

    @action(detail=False, methods=['post'])
    def empty(self, request):
        """Empty the entire trash bin (permanent delete all inactive items)."""
        total_deleted = 0
        errors = []

        for model_key, Model in MODEL_MAP.items():
            try:
                qs = Model.objects.filter(is_active=False)
                count = qs.count()
                if count > 0:
                    qs.delete()
                    total_deleted += count
            except ProtectedError:
                errors.append(f"Certains {model_key}s n'ont pas pu être supprimés (références existantes)")

        SearchCache.invalidate_all_products()

        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='Corbeille',
            object_id=0,
            description=f"Vidage complet de la corbeille: {total_deleted} éléments supprimés",
            details={'total_deleted': total_deleted, 'errors': errors},
            request=request
        )

        return Response({
            'status': 'success',
            'deleted': total_deleted,
            'errors': errors,
            'message': f'{total_deleted} élément(s) supprimé(s) définitivement.'
        })
