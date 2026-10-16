from rest_framework import permissions, viewsets

from ...models.stock import ReapproSession
from ...serializers import ReapproSessionSerializer


class ReapproSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """API de consultation de l'historique des réapprovisionnements réserve → rayon."""

    # Pas de pagination (pagination_class=None) : les FK/reverse lus par le
    # serializer (user, adjustments→produit/stock_lot) sont jointes/prechargées
    # pour éviter un N+1 sur l'historique complet.
    queryset = ReapproSession.objects.select_related('user').prefetch_related(
        'adjustments__produit', 'adjustments__stock_lot'
    ).order_by('-created_at')
    serializer_class = ReapproSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
