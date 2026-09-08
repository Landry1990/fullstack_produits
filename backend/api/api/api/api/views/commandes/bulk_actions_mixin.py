"""Mixin pour les actions en bulk sur les commandes.

Extrait de commandes.py: ajouter_produit_auto, ajouter_produits_bulk,
bulk_delete, merge.
"""
import logging

from django.db import transaction
from django.utils import timezone
from django.db.models import F
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...models import (
    AuditLog,
    Commande,
    CommandeProduit,
    FactureProduitAllocation,
    Produit,
    StockLot,
)

logger = logging.getLogger(__name__)


class CommandeBulkActionsMixin:
    """Mixin: actions en bulk sur les commandes."""

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def ajouter_produit_auto(self, request):
        """
        Ajoute un produit à une commande en préparation pour son fournisseur.
        Si aucune commande n'existe, en crée une nouvelle.
        """
        produit_id = request.data.get('produit_id')
        quantity = int(request.data.get('quantity', 1))
        
        if not produit_id:
            return Response({'error': 'produit_id requis'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            produit = Produit.objects.get(pk=produit_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)
            
        fournisseur = produit.fournisseur
        if not fournisseur:
            # Essayer de trouver le dernier fournisseur via les commandes
            latest_cp = CommandeProduit.objects.filter(produit=produit).order_by('-commande__date').first()
            if latest_cp and latest_cp.commande.fournisseur:
                fournisseur = latest_cp.commande.fournisseur
        
        if not fournisseur:
            return Response({'error': 'Aucun fournisseur associé à ce produit. Veuillez en définir un d\'abord.'}, status=status.HTTP_400_BAD_REQUEST)

        # get_or_create atomique : évite la race condition double-clic / requêtes simultanées
        commande, created = Commande.objects.get_or_create(
            fournisseur=fournisseur,
            status=Commande.Status.EN_PREPARATION,
            defaults={
                'numero_facture': f"REASSORT_AUTO_{fournisseur.id}_{timezone.now().strftime('%Y%m%d')}",
                'date': timezone.now(),
            }
        )

        # Mise à jour ou création de la ligne produit de façon atomique
        item, item_created = CommandeProduit.objects.get_or_create(
            commande=commande,
            produit=produit,
            defaults={
                'quantity': quantity,
                'price': produit.cost_price,
                'price_cost': produit.cost_price,
                'selling_price': produit.selling_price,
                'tva': produit.tva,
            }
        )
        if not item_created:
            # Ligne existante : incrémenter la quantité
            CommandeProduit.objects.filter(pk=item.pk).update(quantity=F('quantity') + quantity)
            item.refresh_from_db()
            msg = f"Quantité mise à jour dans la commande #{commande.id}"
        else:
            msg = f"Produit ajouté à la commande #{commande.id}"
            
        return Response({
            'status': 'success',
            'message': msg,
            'commande_id': commande.id,
            'created_new_order': created
        })


    @action(detail=False, methods=['post'])
    @transaction.atomic
    def ajouter_produits_bulk(self, request):
        """
        Ajoute plusieurs produits aux commandes en préparation de leurs fournisseurs respectifs.
        Regroupe automatiquement les produits par fournisseur.
        """
        produit_ids = request.data.get('produit_ids', [])
        quantity = int(request.data.get('quantity', 1))
        
        if not produit_ids or not isinstance(produit_ids, list):
            return Response({'error': 'Liste de produit_ids requise'}, status=status.HTTP_400_BAD_REQUEST)
            
        summary = {
            'added': 0,
            'updated': 0,
            'errors': [],
            'orders_involved': set()
        }
        
        # Récupérer tous les produits concernés
        produits = list(Produit.objects.filter(pk__in=produit_ids).select_related('fournisseur'))

        # P0: Batch lookup — find last supplier for all products without fournisseur in a single query
        produits_sans_fournisseur = [p for p in produits if not p.fournisseur]
        fallback_fournisseurs = {}
        if produits_sans_fournisseur:
            # Subquery: latest CommandeProduit per produit, then get fournisseur from commande
            from django.db.models import Max
            latest_cp_dates = (
                CommandeProduit.objects.filter(
                    produit__in=produits_sans_fournisseur
                ).values('produit').annotate(
                    max_date=Max('commande__date')
                ).values('produit', 'max_date')
            )
            # Fetch the actual CommandeProduit records with their commande__fournisseur
            for cp in CommandeProduit.objects.filter(
                produit__in=produits_sans_fournisseur
            ).select_related('commande__fournisseur').order_by('-commande__date'):
                if cp.produit_id not in fallback_fournisseurs and cp.commande.fournisseur:
                    fallback_fournisseurs[cp.produit_id] = cp.commande.fournisseur

        for produit in produits:
            fournisseur = produit.fournisseur
            if not fournisseur:
                fournisseur = fallback_fournisseurs.get(produit.id)
            
            if not fournisseur:
                summary['errors'].append(f"Produit {produit.name} n'a pas de fournisseur associé.")
                continue

            # get_or_create atomique : évite la race condition
            commande, _ = Commande.objects.get_or_create(
                fournisseur=fournisseur,
                status=Commande.Status.EN_PREPARATION,
                defaults={
                    'numero_facture': f"REASSORT_AUTO_{fournisseur.id}_{timezone.now().strftime('%Y%m%d')}",
                    'date': timezone.now(),
                }
            )

            summary['orders_involved'].add(commande.id)

            item, item_created = CommandeProduit.objects.get_or_create(
                commande=commande,
                produit=produit,
                defaults={
                    'quantity': quantity,
                    'price': produit.cost_price,
                    'price_cost': produit.cost_price,
                    'selling_price': produit.selling_price,
                    'tva': produit.tva,
                }
            )
            if not item_created:
                CommandeProduit.objects.filter(pk=item.pk).update(quantity=F('quantity') + quantity)
                summary['updated'] += 1
            else:
                summary['added'] += 1
        
        summary['orders_involved'] = list(summary['orders_involved'])
        
        message = f"Opération terminée : {summary['added']} produits ajoutés, {summary['updated']} mis à jour."
        if summary['errors']:
            message += f" ({len(summary['errors'])} erreurs)"
            
        return Response({
            'status': 'success',
            'message': message,
            'summary': summary
        })


    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_delete(self, request):
        """
        Supprime plusieurs commandes en une seule requête.
        Seules les commandes EN_PREPARATION ou EN_ATTENTE peuvent être supprimées.
        """
        import logging
        logger = logging.getLogger(__name__)

        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Bulk delete requested for IDs: {ids}")
        
        commandes = Commande.objects.filter(id__in=ids, is_active=True)
        total_found = commandes.count()
        deletable = commandes.exclude(status=Commande.Status.CLOTUREE)
        total_deletable = deletable.count()
        
        if total_found > 0 and total_deletable == 0:
            logger.warning(f"Bulk delete failed: {total_found} orders found but all are closed.")
            return Response({
                'detail': 'Les commandes sélectionnées sont déjà clôturées et ne peuvent pas être supprimées.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if total_deletable == 0:
             return Response({'detail': 'Aucune commande supprimable trouvée (elles sont peut-être introuvables ou déjà supprimées).'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_ids = []
        try:
            # P0: Batch check — single query for all lots already used in sales
            # instead of N per-commande queries
            all_lots = StockLot.objects.filter(commande_produit__commande__in=deletable)
            used_lot_ids = set(
                FactureProduitAllocation.objects.filter(
                    stock_lot__in=all_lots
                ).values_list('stock_lot_id', flat=True)
            )
            # Build set of commande IDs that have used lots
            protected_commande_ids = set(
                StockLot.objects.filter(
                    id__in=used_lot_ids
                ).values_list('commande_produit__commande_id', flat=True)
            ) if used_lot_ids else set()

            for cmd in deletable:
                # Vérification : y a-t-il des lots de cette commande déjà utilisés ?
                if cmd.id in protected_commande_ids:
                     logger.warning(f"Soft delete refused for order #{cmd.id}: lots already used.")
                     continue

                cmd.is_active = False
                cmd.save(update_fields=['is_active'])
                deleted_ids.append(cmd.id)

            if not deleted_ids and total_deletable > 0:
                 return Response({
                    'detail': "Les commandes sélectionnées ne peuvent pas être supprimées car elles contiennent des lots déjà utilisés."
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
             logger.exception(f"Unexpected error during bulk delete: {e!s}")
             transaction.set_rollback(True)
             return Response({'detail': f'Erreur lors de la suppression : {e!s}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        log_audit(
            user=request.user,
            action=AuditLog.Action.ORDER_CANCEL, # Or a new bulk cancel action
            model_name='Commande',
            object_id=str(deleted_ids),
            description=f"Suppression groupée de {len(deleted_ids)} commandes : {deleted_ids}",
            details={'ids': deleted_ids},
            request=request
        )

        return Response({
            'status': 'success',
            'message': f'{len(deleted_ids)} commandes supprimées avec succès.',
            'deleted_ids': deleted_ids,
            'skipped_count': total_found - total_deletable
        })


    @action(detail=True, methods=['post'])
    @transaction.atomic
    def merge(self, request, pk=None):
        """
        Fusionne une autre commande (source) DANS cette commande (cible).
        - Les deux commandes doivent être EN_PREPARATION.
        - Les lignes de la source sont déplacées vers la cible.
        - Si un produit existe déjà dans la cible, les quantités sont additionnées.
        - La commande source est ensuite SUPPRIMÉE.
        """
        target_commande = self.get_object()
        source_id = request.data.get('source_commande_id')
        
        if not source_id:
            return Response({'error': 'ID de la commande source requis'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            source_commande = Commande.objects.get(pk=source_id)
        except Commande.DoesNotExist:
            return Response({'error': 'Commande source introuvable'}, status=status.HTTP_404_NOT_FOUND)

        # Vérifications
        if target_commande.id == source_commande.id:
            return Response({'error': 'Impossible de fusionner une commande avec elle-même'}, status=status.HTTP_400_BAD_REQUEST)
            
        if target_commande.status != Commande.Status.EN_PREPARATION:
            return Response({'error': 'La commande cible doit être EN_PREPARATION'}, status=status.HTTP_400_BAD_REQUEST)
            
        if source_commande.status != Commande.Status.EN_PREPARATION:
            return Response({'error': 'La commande source doit être EN_PREPARATION'}, status=status.HTTP_400_BAD_REQUEST)

        # Fusion des lignes
        source_lines = list(source_commande.produits.all())
        target_lines_map = {line.produit_id: line for line in target_commande.produits.all()}

        lines_moved = 0
        lines_merged = 0
        targets_to_update = []   # lignes cible dont les qtés ont été modifiées
        sources_to_move   = []   # lignes source à déplacer vers la cible

        for source_line in source_lines:
            if source_line.produit_id in target_lines_map:
                # Le produit existe déjà dans la cible : on additionne les quantités
                target_line = target_lines_map[source_line.produit_id]
                target_line.quantity += source_line.quantity
                target_line.unites_gratuites += source_line.unites_gratuites
                targets_to_update.append(target_line)
                lines_merged += 1
            else:
                # Le produit n'existe pas : on déplace la ligne
                source_line.commande = target_commande
                sources_to_move.append(source_line)
                lines_moved += 1

        from ...models import CommandeProduit
        # ── Bulk writes (2 requêtes max au lieu de N) ──────────────────────
        if targets_to_update:
            CommandeProduit.objects.bulk_update(
                targets_to_update, ['quantity', 'unites_gratuites'], batch_size=100
            )
        if sources_to_move:
            CommandeProduit.objects.bulk_update(
                sources_to_move, ['commande'], batch_size=100
            )

        # Supprimer les lignes fusionnées restées dans la source, puis la commande
        source_commande.produits.all().delete()
        source_commande.delete()
        
        return Response({
            'status': 'success',
            'message': f'Fusion réussie : {lines_moved} lignes déplacées, {lines_merged} lignes fusionnées.',
            'lines_moved': lines_moved,
            'lines_merged': lines_merged
        })

