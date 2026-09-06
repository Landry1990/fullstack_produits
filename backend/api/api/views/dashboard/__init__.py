from rest_framework.permissions import IsAuthenticated

from .challenges import DashboardChallengesMixin
from .clients import DashboardClientsMixin
from .core import DashboardCoreMixin
from .fournisseurs import DashboardFournisseursMixin
from .statistiques import StatistiquesViewSet


class DashboardViewSet(
    DashboardCoreMixin,
    DashboardClientsMixin,
    DashboardFournisseursMixin,
    DashboardChallengesMixin,
):
    """
    ViewSet for Dashboard statistics and charts.
    """
    permission_classes = [IsAuthenticated]


__all__ = [
    'DashboardViewSet',
    'StatistiquesViewSet',
]
