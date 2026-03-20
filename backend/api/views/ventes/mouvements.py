from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
import logging

from django.utils import timezone
from datetime import datetime

from ...models import MouvementCaisse, AuditLog
from ...serializers import MouvementCaisseSerializer
from ...audit_helpers import log_audit
from ...pagination import StandardResultsSetPagination

logger = logging.getLogger(__name__)


class MouvementCaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for managing cash register movements (entries and exits)."""
    queryset = MouvementCaisse.objects.select_related('user').all().order_by('-date')
    serializer_class = MouvementCaisseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'user']
    search_fields = ['motif', 'description']
    ordering_fields = ['date', 'montant']
    ordering = ['-date']

    def get_queryset(self):
        queryset = super().get_queryset()
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        if date_debut:
            try:
                clean = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M')
                if timezone.is_naive(dt): dt = timezone.make_aware(dt)
                queryset = queryset.filter(date__gte=dt)
            except ValueError: pass
            
        if date_fin:
            try:
                clean = date_fin.replace('T', ' ').replace('Z', '')
                try:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M')
                if timezone.is_naive(dt): dt = timezone.make_aware(dt)
                queryset = queryset.filter(date__lte=dt)
            except ValueError: pass
            
        return queryset
    
    def perform_create(self, serializer):
        """Automatically set the user to the currently authenticated user and audit."""
        mouvement = serializer.save(user=self.request.user)
        
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.OTHER,
            model_name='MouvementCaisse',
            object_id=mouvement.id,
            description=f"Mouvement caisse ({mouvement.type}): {mouvement.montant:.0f}F - {mouvement.motif}",
            details={
                'type': mouvement.type,
                'montant': float(mouvement.montant),
                'motif': mouvement.motif,
                'description': mouvement.description
            },
            request=self.request
        )

    def perform_update(self, serializer):
        mouvement = serializer.instance
        old_montant = mouvement.montant
        serializer.save()
        
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='MouvementCaisse',
            object_id=mouvement.id,
            description=f"Modification mouvement caisse #{mouvement.id}",
            details={
                'old_montant': float(old_montant),
                'new_montant': float(mouvement.montant),
                'motif': mouvement.motif
            },
            request=self.request
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        mvmt_id = instance.id
        mvmt_info = f"{instance.type} {instance.montant}F ({instance.motif})"
        
        response = super().destroy(request, *args, **kwargs)
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='MouvementCaisse',
            object_id=mvmt_id,
            description=f"Suppression mouvement caisse: {mvmt_info}",
            details={'info': mvmt_info},
            request=request
        )
        return response
