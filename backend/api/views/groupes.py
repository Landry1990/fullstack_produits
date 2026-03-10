from rest_framework import viewsets, permissions, filters
from ..models import Groupe
from ..serializers import GroupeSerializer
from ..pagination import StandardResultsSetPagination

class GroupeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing Groupes.
    Allows standard CRUD operations.
    """
    queryset = Groupe.objects.all().order_by('nom')
    serializer_class = GroupeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'description']
    pagination_class = StandardResultsSetPagination
