from rest_framework import permissions, viewsets

from ...models.stock import ReapproSession
from ...serializers import ReapproSessionSerializer


class ReapproSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """API de consultation de l'historique des réapprovisionnements réserve → rayon."""

    queryset = ReapproSession.objects.all().order_by('-created_at')
    serializer_class = ReapproSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
