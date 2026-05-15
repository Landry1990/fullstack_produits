from rest_framework import viewsets, filters
from ..models import MedicamentReference
from ..serializers import MedicamentReferenceSerializer
from ..centralized_configs import StandardResultsSetPagination

class MedicamentReferenceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet pour consulter la table de référence unifiée des médicaments.
    """
    queryset = MedicamentReference.objects.all()
    serializer_class = MedicamentReferenceSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom', 'cis', 'substances']
    ordering_fields = ['nom']
