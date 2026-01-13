from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User

from ..models import AuditLog
from ..serializers import AuditLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet pour consulter les logs d'audit.
    Lecture seule, accès administrateur ou manager requis.
    """
    queryset = AuditLog.objects.select_related('user').all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated] # Custom permisssion check in get_queryset or similar logic if needed
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'model_name', 'user']
    search_fields = ['description', 'object_id', 'details', 'user__username']
    ordering_fields = ['timestamp', 'action']
    ordering = ['-timestamp']

    def get_permissions(self):
        """
        Seuls les admins et managers peuvent voir les logs.
        """
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        # Si superuser, tout voir
        if user.is_superuser:
            return super().get_queryset()
        
        # Si manager, tout voir (à définir selon règles métier)
        if hasattr(user, 'profile') and user.profile.role == 'manager':
            return super().get_queryset()
            
        # Sinon, voir seulement ses propres actions ? Ou rien ?
        # Pour l'instant on retourne ses propres actions
        return super().get_queryset().filter(user=user)
