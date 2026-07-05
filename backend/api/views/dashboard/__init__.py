from rest_framework.permissions import IsAuthenticated

from .core import DashboardCoreMixin
from .clients import DashboardClientsMixin
from .fournisseurs import DashboardFournisseursMixin
from .statistiques import StatistiquesViewSet


class DashboardViewSet(
    DashboardCoreMixin,
    DashboardClientsMixin,
    DashboardFournisseursMixin,
):
    """
    ViewSet for Dashboard statistics and charts.
    """
    permission_classes = [IsAuthenticated]


__all__ = [
    'DashboardViewSet',
    'StatistiquesViewSet',
]
