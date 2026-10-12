from django.db.models import Count
from rest_framework import filters, permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Groupe
from ..pagination import StandardResultsSetPagination
from ..serializers import GroupeSerializer
from .category_merge import merge_category


class GroupeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing Groupes.
    Allows standard CRUD operations.
    """
    queryset = Groupe.objects.annotate(produits_count=Count('produits')).order_by('nom')
    serializer_class = GroupeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'description']
    pagination_class = StandardResultsSetPagination

    @action(detail=True, methods=['post'])
    def merge(self, request, pk=None):
        """Fusionne ce groupe dans un groupe cible ({target_id}) puis le supprime."""
        source = self.get_object()
        try:
            target = Groupe.objects.get(pk=request.data.get('target_id'))
        except (Groupe.DoesNotExist, TypeError, ValueError):
            return Response({'detail': 'Groupe cible introuvable.'}, status=status.HTTP_400_BAD_REQUEST)
        return merge_category(request, source, target, 'groupe')
