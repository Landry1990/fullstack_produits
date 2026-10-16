from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from ..audit_mixins import AuditedViewSetMixin
from ..models import Promotion
from ..pagination import StandardResultsSetPagination
from ..serializers import PromotionSerializer
from .settings import IsAdminOrMenuAllowed


class PromotionViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    """
    API endpoint for promotions with optimizations:
    - SQL annotations for product/rayon counts (avoids N+1 queries)
    """
    # OPTIMISATION: Annotate with counts to avoid N+1 in serializer
    # prefetch products/rayons/pack_items__product : sérialisés par
    # PromotionSerializer (M2M en PK + nested pack_items avec product.name).
    queryset = Promotion.objects.annotate(
        products_count=Count('products', distinct=True),
        rayons_count=Count('rayons', distinct=True)
    ).prefetch_related(
        'products', 'rayons', 'pack_items__product'
    ).order_by('-priority', '-created_at')
    serializer_class = PromotionSerializer
    permission_classes = [IsAdminOrMenuAllowed] # Lecture pour tous (caisse), écriture admin ou menu autorisé
    write_menu_keys = ('ventes', 'ventes_promotions')
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['active', 'discount_type']
    search_fields = ['name']
