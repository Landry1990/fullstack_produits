import logging

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.models import (
    AuditLog,
    Facture,
    FactureProduit,
)
from api.services import SalesService
from api.sudo_utils import validate_sudo_mode

logger = logging.getLogger(__name__)


class FactureBulkMixin:
    """Actions en lot : bulk_delete, supprimer_brouillons, bulk_cancel."""

    MAX_BULK_DELETE = 1000
    MAX_BULK_CANCEL = 1000

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_delete(self, request):
        """
        Supprime plusieurs factures (brouillons ou annulées) via leur ID.
        Payload: { "ids": [1, 2, 3] }
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(ids) > self.MAX_BULK_DELETE:
            return Response(
                {'detail': f'Trop de factures à supprimer en une fois (max {self.MAX_BULK_DELETE}). Veuillez réduire la sélection.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Filtrer les factures supprimables (Brouillon ou Annulée)
        factures_to_delete = Facture.objects.filter(
            id__in=ids,
            status__in=[Facture.Status.BROUILLON, Facture.Status.ANNULEE]
        )

        count = factures_to_delete.count()
        deleted_ids = list(factures_to_delete.values_list('id', flat=True))

        if count == 0:
             return Response({'detail': 'Aucune facture supprimable trouvée (doit être BROUILLON ou ANNULEE).'}, status=status.HTTP_400_BAD_REQUEST)

        # Audit Log
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVOICE_DELETE,
            model_name='Facture',
            object_id='BULK',
            description=f"Mise en corbeille de {count} facture(s)",
            details={'ids': deleted_ids},
            request=request
        )

        factures_to_delete.update(is_active=False)

        return Response({
            'status': 'success',
            'detail': f'{count} facture(s) mise(s) en corbeille.',
            'deleted_ids': deleted_ids
        })

    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def supprimer_brouillons(self, request):
        """
        Supprime toutes les factures en statut brouillon.
        """
        brouillons = Facture.objects.filter(status=Facture.Status.BROUILLON)
        count = brouillons.count()
        ids = list(brouillons.values_list('id', flat=True))

        if count > 0:
            # Audit Log
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_DELETE,
                model_name='Facture',
                object_id='BROUILLONS_PURGE',
                description=f"Suppression massive de {count} facture(s) en brouillon",
                details={'ids': ids},
                request=request
            )

            brouillons.update(is_active=False)

        return Response({
            'status': 'success',
            'detail': f'{count} facture(s) brouillon mise(s) en corbeille avec succès.',
            'count': count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_cancel(self, request):
        """
        Annule plusieurs factures en lot avec réintégration automatique du stock.
        Body:
          - {"facture_ids": [1, 2, 3]} pour annuler une sélection
          - {"all_pending": true, "batch_size": 50} pour annuler par lots
        Réservé aux administrateurs (sudo requis).
        """
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cancel_invoice')
        if error_res:
            return error_res

        motif = request.data.get('motif', 'Vidange caisse centrale')
        batch_size = request.data.get('batch_size')
        if batch_size is not None:
            try:
                batch_size = int(batch_size)
                if batch_size < 1:
                    batch_size = None
            except (ValueError, TypeError):
                batch_size = None

        if request.data.get('all_pending'):
            all_pending_qs = Facture.objects.filter(
                is_active=True,
                status__in=[Facture.Status.BROUILLON, Facture.Status.PROFORMA, Facture.Status.VALIDEE]
            ).order_by('id')
            total_remaining = all_pending_qs.count()
            if total_remaining > self.MAX_BULK_CANCEL and not batch_size:
                return Response(
                    {'detail': f'{total_remaining} factures en attente. Trop pour une seule opération (max {self.MAX_BULK_CANCEL}). Utilisez batch_size pour traiter par lots.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if batch_size:
                factures = all_pending_qs[:batch_size]
            else:
                factures = all_pending_qs
        else:
            ids = request.data.get('facture_ids', [])
            if not ids:
                return Response({'detail': 'Aucune facture sélectionnée.'}, status=status.HTTP_400_BAD_REQUEST)
            if len(ids) > self.MAX_BULK_CANCEL:
                return Response(
                    {'detail': f'Trop de factures à annuler en une fois (max {self.MAX_BULK_CANCEL}). Veuillez réduire la sélection.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            total_remaining = len(ids)
            if batch_size:
                ids = ids[:batch_size]
            factures = Facture.objects.filter(id__in=ids, is_active=True).order_by('id')

        if not factures.exists():
            return Response({'detail': 'Aucune facture à annuler.'}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        success_count = 0
        error_count = 0
        total_reintegrated = 0

        for facture in factures:
            if facture.status == Facture.Status.ANNULEE:
                results.append({'id': facture.id, 'numero': facture.numero_facture, 'status': 'deja_annulee'})
                error_count += 1
                continue
            try:
                was_validated = facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]
                success, message = SalesService.cancel_invoice(facture, validation_user, motif)
                if success:
                    items_count = FactureProduit.objects.filter(facture=facture).count()
                    total_reintegrated += items_count if was_validated else 0
                    results.append({
                        'id': facture.id,
                        'numero': facture.numero_facture,
                        'status': 'annulee',
                        'stock_reintegrated': was_validated
                    })
                    success_count += 1
                    log_audit(
                        user=request.user,
                        action=AuditLog.Action.INVOICE_CANCEL,
                        model_name='Facture',
                        object_id=facture.id,
                        description=f"Annulation en lot - Facture {facture.numero_facture or facture.id}",
                        details={
                            'facture_id': facture.id,
                            'numero_facture': facture.numero_facture,
                            'montant': float(facture.total_ttc),
                            'motif': motif,
                            'bulk_cancel': True,
                            'cancelled_by': validation_user.username
                        },
                        request=request
                    )
                else:
                    results.append({'id': facture.id, 'numero': facture.numero_facture, 'status': 'erreur', 'detail': message})
                    error_count += 1
            except Exception as e:
                logger.error(f"[BULK_CANCEL] Erreur sur facture {facture.id}: {e!s}")
                results.append({'id': facture.id, 'numero': facture.numero_facture, 'status': 'erreur', 'detail': str(e)})
                error_count += 1

        processed = success_count + error_count
        remaining = max(0, total_remaining - processed)
        return Response({
            'detail': f'{success_count} facture(s) annulée(s), {error_count} erreur(s).',
            'success_count': success_count,
            'error_count': error_count,
            'total_stock_reintegrated': total_reintegrated,
            'processed': processed,
            'remaining': remaining,
            'total': total_remaining,
            'batch_size': batch_size,
            'results': results
        })
