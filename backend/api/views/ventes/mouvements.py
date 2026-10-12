import logging

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from ...audit_helpers import log_audit
from ...models import AuditLog, MouvementCaisse
from ...pagination import StandardResultsSetPagination
from ...serializers import MouvementCaisseSerializer
from ...sudo_utils import validate_sudo_mode
from ..rapports.tz_utils import parse_api_datetime

logger = logging.getLogger(__name__)


class MouvementCaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for managing cash register movements (entries and exits)."""
    queryset = MouvementCaisse.objects.select_related('user').all().order_by('-date')
    serializer_class = MouvementCaisseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    http_method_names = ['get', 'post', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'user']
    search_fields = ['motif', 'description']
    ordering_fields = ['date', 'montant']
    ordering = ['-date']

    def get_queryset(self):
        queryset = super().get_queryset()
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        # Paramètre fourni mais invalide → 400 : ignorer le filtre renverrait
        # des résultats non filtrés, trompeurs pour l'utilisateur.
        if date_debut:
            dt = parse_api_datetime(date_debut)
            if dt is None:
                raise ValidationError({'detail': f"Le paramètre 'date_debut' est invalide : '{date_debut}'. Format attendu : AAAA-MM-JJ."})
            queryset = queryset.filter(date__gte=dt)

        if date_fin:
            dt = parse_api_datetime(date_fin, end_of_day=True)
            if dt is None:
                raise ValidationError({'detail': f"Le paramètre 'date_fin' est invalide : '{date_fin}'. Format attendu : AAAA-MM-JJ."})
            queryset = queryset.filter(date__lte=dt)
            
        return queryset

    def create(self, request, *args, **kwargs):
        """Écritures (entrées/sorties manuelles de caisse) : même permission
        que l'encaissement (CaisseViewSet.create) — `can_cash_out` sur le
        profil, ou validation sudo par un utilisateur autorisé."""
        _validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cash_out')
        if error_res:
            return error_res
        return super().create(request, *args, **kwargs)

    @transaction.atomic
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
