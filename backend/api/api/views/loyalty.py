from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import LoyaltyHistory
from ..serializers.loyalty import LoyaltyHistorySerializer


class LoyaltyHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Historique des transactions de points de fidélité (lecture seule)."""
    serializer_class = LoyaltyHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['client', 'type_transaction', 'facture']
    ordering_fields = ['created_at', 'points']
    ordering = ['-created_at']

    def get_queryset(self):
        return LoyaltyHistory.objects.select_related('client', 'facture', 'created_by').all()
