import csv
import io
from datetime import timedelta

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..audit_helpers import log_audit
from ..filters import AuditLogFilter
from ..models import AuditLog
from ..pagination import StandardResultsSetPagination
from ..serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet pour consulter les logs d'audit.
    Lecture seule, accès authentifié.
    """
    queryset = AuditLog.objects.select_related('user').all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    search_fields = ['description', 'object_id', 'details', 'user__username']
    ordering_fields = ['timestamp', 'action']
    ordering = ['-timestamp']

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def _filtered_queryset(self):
        """Applique le filterset aux paramètres GET et retourne le queryset filtré."""
        qs = self.get_queryset()
        filterset = AuditLogFilter(self.request.GET, queryset=qs)
        if filterset.is_valid():
            return filterset.qs
        return qs

    def get_queryset(self):
        user = self.request.user
        base_qs = super().get_queryset()

        # Superutilisateur : tout voir
        if user.is_superuser:
            return base_qs

        # Rôles avec accès complet au journal
        if hasattr(user, 'profile') and user.profile.role in ('manager', 'PHARMACIEN', 'COMPTABLE'):
            return base_qs

        # Autres rôles : seulement ses propres actions
        return base_qs.filter(user=user)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Retourne des agrégats sur les logs filtrés."""
        qs = self._filtered_queryset()

        now = timezone.now()
        recent_activity = {
            'last_24h': qs.filter(timestamp__gte=now - timedelta(hours=24)).count(),
            'last_7d': qs.filter(timestamp__gte=now - timedelta(days=7)).count(),
            'last_30d': qs.filter(timestamp__gte=now - timedelta(days=30)).count(),
        }

        by_action = list(
            qs.values('action')
            .annotate(count=Count('id'))
            .order_by('-count', 'action')
        )

        top_users = list(
            qs.values('user__id', 'user__username')
            .annotate(count=Count('id'))
            .order_by('-count', 'user__username')[:10]
        )
        top_users = [
            {'user_id': item['user__id'], 'username': item['user__username'], 'count': item['count']}
            for item in top_users
        ]

        return Response({
            'total_logs': qs.count(),
            'recent_activity': recent_activity,
            'by_action': by_action,
            'top_users': top_users,
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Exporte les logs filtrés au format CSV (max 10 000 lignes)."""
        qs = self._filtered_queryset()[:10000]

        output = io.StringIO()
        writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        writer.writerow(['Date/Heure', 'Utilisateur', 'Action', 'Modèle', 'Objet', 'Description', 'IP'])

        for log in qs.iterator(chunk_size=1000):
            writer.writerow([
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S') if log.timestamp else '',
                log.user.username if log.user else 'Système',
                log.get_action_display(),
                log.model_name,
                log.object_id or '',
                (log.description or '').replace('\n', ' ').replace('\r', ' '),
                log.ip_address or '',
            ])

        # Logger l'action d'export
        log_audit(
            user=request.user,
            action=AuditLog.Action.EXPORT,
            model_name='AuditLog',
            object_id=0,
            description="Export CSV du journal d'audit",
            details={'filtres': request.GET.dict()},
            request=request,
        )

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
        response.write('\ufeff')
        response.write(output.getvalue())
        return response
