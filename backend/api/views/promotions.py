from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count
from ..models import Promotion
from ..serializers import PromotionSerializer
from ..pagination import StandardResultsSetPagination

class PromotionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for promotions with optimizations:
    - SQL annotations for product/rayon counts (avoids N+1 queries)
    """
    # OPTIMISATION: Annotate with counts to avoid N+1 in serializer
    queryset = Promotion.objects.annotate(
        products_count=Count('products', distinct=True),
        rayons_count=Count('rayons', distinct=True)
    ).order_by('-priority', '-created_at')
    serializer_class = PromotionSerializer
    permission_classes = [permissions.IsAuthenticated] # Or IsAdminUser if restricted
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['active', 'discount_type']
    search_fields = ['name']
