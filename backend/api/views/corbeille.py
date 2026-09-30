"""
Corbeille (Trash / Recycle Bin) - API Views.

Centralises all soft-deleted (is_active=False) items from:
  - Produit
  - Client
  - Fournisseur

Provides list, restore, and permanent delete actions.
"""
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, ProtectedError, Sum
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from ..audit_helpers import log_audit
from ..cache_utils import SearchCache
from ..models import (
    AuditLog,
    Avoir,
    AyantDroit,
    Client,
    Commande,
    CommandeProduit,
    DepotClient,
    Facture,
    FactureProduit,
    Fournisseur,
    Inventaire,
    LigneAvoirClient,
    OrderSchedule,
    PaiementFournisseur,
    Produit,
    Promis,
    RelevePaiement,
    StockLot,
)


def _count_map(model, fk_field, ids):
    """Retourne {fk_id: count} pour les IDs donnés (une seule requête GROUP BY)."""
    if not ids:
        return {}
    return {
        row[fk_field]: row['c']
        for row in model.objects.filter(**{f'{fk_field}__in': ids})
        .values(fk_field).annotate(c=Count('id'))
    }

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
    permission_classes = [IsAuthenticated, IsAdminUser]

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

        # Produits inactifs — avec compteurs de liens transactionnels
        produits_qs = list(
            Produit.objects.filter(is_active=False)
            .select_related('deleted_by').order_by('-deleted_at')[:200]
        )
        produit_ids = [p.id for p in produits_qs]
        ventes_map = _count_map(FactureProduit, 'produit_id', produit_ids)
        lignes_cmd_map = _count_map(CommandeProduit, 'produit_id', produit_ids)
        avoir_client_map = _count_map(LigneAvoirClient, 'produit_id', produit_ids)
        stock_lots_map = (
            {
                row['produit_id']: row['s'] or 0
                for row in StockLot.objects.filter(produit_id__in=produit_ids)
                .values('produit_id').annotate(s=Sum('quantity_remaining'))
            }
            if produit_ids else {}
        )
        for p in produits_qs:
            links = {}
            if ventes_map.get(p.id):
                links['sales'] = ventes_map[p.id]
            if lignes_cmd_map.get(p.id):
                links['order_lines'] = lignes_cmd_map[p.id]
            if avoir_client_map.get(p.id):
                links['client_credits'] = avoir_client_map[p.id]
            if stock_lots_map.get(p.id):
                links['stock'] = stock_lots_map[p.id]
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
                'deleted_at': p.deleted_at.isoformat() if p.deleted_at else (p.updated_at.isoformat() if p.updated_at else None),
                'deleted_by': p.deleted_by.get_username() if p.deleted_by else None,
                'links': links,
                'has_history': bool(links),
                # LigneAvoirClient.produit = PROTECT → la purge échouera
                'purge_blocked': bool(avoir_client_map.get(p.id)),
                'cascade_data': False,
            })

        # Clients inactifs — avec compteurs de liens transactionnels
        clients_qs = list(
            Client.objects.filter(is_active=False)
            .select_related('deleted_by').order_by('-deleted_at')[:200]
        )
        client_ids = [c.id for c in clients_qs]
        factures_map = _count_map(Facture, 'client_id', client_ids)
        releves_map = _count_map(RelevePaiement, 'client_id', client_ids)
        depots_map = _count_map(DepotClient, 'client_id', client_ids)
        ayants_map = _count_map(AyantDroit, 'client_id', client_ids)
        for c in clients_qs:
            links = {}
            if factures_map.get(c.id):
                links['invoices'] = factures_map[c.id]
            if releves_map.get(c.id):
                links['statements'] = releves_map[c.id]
            if depots_map.get(c.id):
                links['deposits'] = depots_map[c.id]
            if ayants_map.get(c.id):
                links['beneficiaries'] = ayants_map[c.id]
            items['clients'].append({
                'id': c.id,
                'name': c.name,
                'type': 'client',
                'details': {
                    'phone': c.phone,
                    'email': c.email,
                    'client_type': c.client_type,
                },
                'deleted_at': c.deleted_at.isoformat() if c.deleted_at else (c.created_at.isoformat() if c.created_at else None),
                'deleted_by': c.deleted_by.get_username() if c.deleted_by else None,
                'links': links,
                'has_history': bool(links),
                # Facture.client et RelevePaiement.client = PROTECT → purge bloquée
                'purge_blocked': bool(factures_map.get(c.id) or releves_map.get(c.id)),
                # DepotClient et AyantDroit = CASCADE → seront perdus à la purge
                'cascade_data': bool(depots_map.get(c.id) or ayants_map.get(c.id)),
            })

        # Fournisseurs inactifs — avec compteurs de liens transactionnels
        fournisseurs_qs = list(
            Fournisseur.objects.filter(is_active=False)
            .select_related('deleted_by').order_by('-deleted_at')[:200]
        )
        fournisseur_ids = [f.id for f in fournisseurs_qs]
        commandes_map = _count_map(Commande, 'fournisseur_id', fournisseur_ids)
        paiements_map = _count_map(PaiementFournisseur, 'fournisseur_id', fournisseur_ids)
        schedules_map = _count_map(OrderSchedule, 'fournisseur_id', fournisseur_ids)
        for f in fournisseurs_qs:
            links = {}
            if commandes_map.get(f.id):
                links['orders'] = commandes_map[f.id]
            if paiements_map.get(f.id):
                links['payments'] = paiements_map[f.id]
            if schedules_map.get(f.id):
                links['schedules'] = schedules_map[f.id]
            items['fournisseurs'].append({
                'id': f.id,
                'name': f.name,
                'type': 'fournisseur',
                'details': {
                    'phone': f.phone,
                    'email': f.email,
                },
                'deleted_at': f.deleted_at.isoformat() if f.deleted_at else None,
                'deleted_by': f.deleted_by.get_username() if f.deleted_by else None,
                'links': links,
                'has_history': bool(links),
                'purge_blocked': False,
                # PaiementFournisseur et OrderSchedule = CASCADE → historique
                # des paiements et planifications perdu à la purge
                'cascade_data': bool(paiements_map.get(f.id) or schedules_map.get(f.id)),
            })

        # Commandes inactives
        for c in Commande.objects.filter(is_active=False).select_related('fournisseur', 'deleted_by').order_by('-deleted_at')[:100]:
            items['commandes'].append({
                'id': c.id,
                'name': f"Commande {c.id} ({c.numero_facture or 'Sans N°'})",
                'type': 'commande',
                'details': {
                    'fournisseur': c.fournisseur.name if c.fournisseur else c.fournisseur_nom,
                    'status': c.get_status_display(),  # type: ignore[attr-defined]
                },
                'deleted_at': c.deleted_at.isoformat() if c.deleted_at else (c.date.isoformat() if c.date else None),
                'deleted_by': c.deleted_by.get_username() if c.deleted_by else None,
            })

        # Avoirs inactifs
        for a in Avoir.objects.filter(is_active=False).select_related('fournisseur', 'deleted_by').order_by('-deleted_at')[:100]:
            items['avoirs'].append({
                'id': a.id,
                'name': f"Avoir {a.numero}",
                'type': 'avoir',
                'details': {
                    'fournisseur': a.fournisseur.name if a.fournisseur else a.fournisseur_nom,
                    'status': a.get_status_display(),  # type: ignore[attr-defined]
                },
                'deleted_at': a.deleted_at.isoformat() if a.deleted_at else (a.updated_at.isoformat() if a.updated_at else None),
                'deleted_by': a.deleted_by.get_username() if a.deleted_by else None,
            })

        # Promis inactifs
        for p in Promis.objects.filter(is_active=False).select_related('client', 'produit', 'deleted_by').order_by('-deleted_at')[:100]:
            items['promis'].append({
                'id': p.id,
                'name': f"Promis {p.produit.name if p.produit else p.produit_nom}",
                'type': 'promis',
                'details': {
                    'client': p.client_display,
                    'status': p.get_status_display(),  # type: ignore[attr-defined]
                    'quantite': p.quantite,
                },
                'deleted_at': p.deleted_at.isoformat() if p.deleted_at else (p.date_promis.isoformat() if p.date_promis else None),
                'deleted_by': p.deleted_by.get_username() if p.deleted_by else None,
            })

        # Inventaires inactifs
        for i in Inventaire.objects.filter(is_active=False).select_related('deleted_by').order_by('-deleted_at')[:100]:
            items['inventaires'].append({
                'id': i.id,  # type: ignore[attr-defined]
                'name': f"Inventaire {i.reference or i.id}",  # type: ignore[attr-defined]
                'type': 'inventaire',
                'details': {
                    'status': i.get_status_display(),  # type: ignore[attr-defined]
                    'type': i.get_inventory_type_display(),  # type: ignore[attr-defined]
                },
                'deleted_at': i.deleted_at.isoformat() if i.deleted_at else (i.date.isoformat() if i.date else None),
                'deleted_by': i.deleted_by.get_username() if i.deleted_by else None,
            })

        # Factures inactives
        for f in Facture.objects.filter(is_active=False).select_related('client', 'deleted_by').order_by('-deleted_at')[:100]:
            items['factures'].append({
                'id': f.id,
                'name': f"Facture {f.numero_facture or f.id}",
                'type': 'facture',
                'details': {
                    'client': f.client.name if f.client else f.client_name_override,
                    'status': f.get_status_display(),  # type: ignore[attr-defined]
                    'total': float(f.total_ttc),
                },
                'deleted_at': f.deleted_at.isoformat() if f.deleted_at else (f.date.isoformat() if f.date else None),
                'deleted_by': f.deleted_by.get_username() if f.deleted_by else None,
            })

        # Utilisateurs inactifs
        for u in User.objects.filter(is_active=False, is_superuser=False).order_by('-date_joined')[:100]:
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
                'deleted_by': None,
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
                    qs = qs.filter(is_superuser=False)
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
                    description=f"Suppression définitive (corbeille): {count} {model_key}(s) - {', '.join(str(n) for n in names[:5] if n is not None)}",
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
                if model_key == 'user':
                    qs = qs.filter(is_superuser=False)
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
