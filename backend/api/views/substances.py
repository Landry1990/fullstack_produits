from rest_framework import viewsets, filters
from django.db.models import Count
from ..models import Substance
from ..serializers import SubstanceSerializer

class SubstanceViewSet(viewsets.ModelViewSet):
    queryset = Substance.objects.all().annotate(produits_count=Count('produits')).order_by('nom')
    serializer_class = SubstanceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom']
    ordering_fields = ['nom']
