from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from api.pagination import StandardResultsSetPagination

from .base import RapportBaseMixin
from .inventory import RapportInventoryMixin
from .sales import RapportSalesMixin
from .finance import RapportFinanceMixin

class RapportViewSet(
    viewsets.ViewSet,
    RapportBaseMixin,
    RapportInventoryMixin,
    RapportSalesMixin,
    RapportFinanceMixin
):
    """
    ViewSet modulaire pour les rapports ZENITH.
    Regroupe les calculs de base, les inventaires, les ventes et la finance.
    """
    permission_classes = [IsAuthenticated]
    
    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            self._paginator = StandardResultsSetPagination()
        return self._paginator
