from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...models import AuditLog
from ...models.stock import SignalementBesoin
from ...serializers import SignalementBesoinSerializer


class SignalementBesoinViewSet(viewsets.ModelViewSet):
    """
    Besoins de commande signalés depuis le terrain (mobile comptoir).
    Un signalement = « ce produit manque / a été demandé » → à intégrer
    dans les suggestions de commande. Distinct de RuptureFournisseur
    (indisponibilité chez le grossiste).
    """
    queryset = SignalementBesoin.objects.select_related('produit', 'utilisateur').all()
    serializer_class = SignalementBesoinSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['produit', 'statut']
    search_fields = ['produit__name', 'note']

    def perform_create(self, serializer):
        signalement = serializer.save(utilisateur=self.request.user)
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='SignalementBesoin',
            object_id=signalement.id,
            description=f"Signalement besoin #{signalement.id} — {signalement.produit.name if signalement.produit else 'Produit'}",
            details={'produit_id': signalement.produit_id},
            request=self.request,
        )

    def perform_update(self, serializer):
        fields = sorted(serializer.validated_data.keys())
        signalement = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='SignalementBesoin',
            object_id=signalement.id,
            description=f"Modification signalement besoin #{signalement.id}",
            details={'fields': fields},
            request=self.request,
        )

    def perform_destroy(self, instance):
        # Tracé avant suppression (produit + statut du signalement détruit)
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='SignalementBesoin',
            object_id=instance.id,
            description=f"Suppression signalement besoin #{instance.id} — {instance.produit.name if instance.produit else 'Produit'}",
            details={
                'produit_id': instance.produit_id,
                'statut': instance.statut,
            },
            request=self.request,
        )
        super().perform_destroy(instance)

    def _set_statut(self, pk, statut, err_msg):
        signalement = self.get_object()
        if signalement.statut != SignalementBesoin.Statut.NOUVEAU:
            return Response({'error': err_msg}, status=status.HTTP_400_BAD_REQUEST)
        signalement.statut = statut
        signalement.save(update_fields=['statut'])
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='SignalementBesoin',
            object_id=signalement.id,
            description=f"Signalement besoin #{signalement.id} passé à « {signalement.get_statut_display()} » — {signalement.produit.name if signalement.produit else 'Produit'}",
            details={'statut': statut, 'produit_id': signalement.produit_id},
            request=self.request,
        )
        return Response(SignalementBesoinSerializer(signalement).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def integrer(self, request, pk=None):
        """Marque le signalement comme intégré à une commande."""
        return self._set_statut(
            pk, SignalementBesoin.Statut.INTEGRE,
            'Ce signalement a déjà été traité.'
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def ignorer(self, request, pk=None):
        """Marque le signalement comme ignoré (doublon, non pertinent…)."""
        return self._set_statut(
            pk, SignalementBesoin.Statut.IGNORE,
            'Ce signalement a déjà été traité.'
        )

    @action(detail=False, methods=['delete'], url_path='vider')
    def vider(self, request):
        """Purge les signalements déjà traités (INTÉGRÉ / IGNORÉ).
        Les NOUVEAU en attente sont conservés — la liste reste une
        liste de travail partagée."""
        deleted, _ = SignalementBesoin.objects.filter(
            statut__in=[
                SignalementBesoin.Statut.INTEGRE,
                SignalementBesoin.Statut.IGNORE,
            ]
        ).delete()
        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='SignalementBesoin',
            object_id='BULK',
            description=f"Purge de {deleted} signalement(s) de besoin traités",
            details={'deleted': deleted},
            request=request,
        )
        return Response({'deleted': deleted})
