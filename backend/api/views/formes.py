from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from ..models import Forme
from ..serializers_forme import FormeSerializer

class FormeViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les formes pharmaceutiques.
    """
    queryset = Forme.objects.all().order_by('nom')
    serializer_class = FormeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'description']
    pagination_class = None
