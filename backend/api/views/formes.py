from django.db.models import Count
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..audit_mixins import AuditedViewSetMixin
from ..models import Forme
from ..pagination import StandardResultsSetPagination
from ..serializers_forme import FormeSerializer
from .category_merge import merge_category


class FormeViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet pour gérer les formes pharmaceutiques.
    """
    queryset = Forme.objects.annotate(produits_count=Count('produits')).order_by('nom')
    serializer_class = FormeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'description']
    pagination_class = StandardResultsSetPagination

    @action(detail=True, methods=['post'])
    def merge(self, request, pk=None):
        """Fusionne cette forme dans une forme cible ({target_id}) puis la supprime."""
        source = self.get_object()
        try:
            target = Forme.objects.get(pk=request.data.get('target_id'))
        except (Forme.DoesNotExist, TypeError, ValueError):
            return Response({'detail': 'Forme cible introuvable.'}, status=status.HTTP_400_BAD_REQUEST)
        return merge_category(request, source, target, 'forme')
