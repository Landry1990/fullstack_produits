from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Promotion
from ..serializers import PromotionSerializer
from ..pagination import StandardResultsSetPagination

class PromotionViewSet(viewsets.ModelViewSet):
    queryset = Promotion.objects.all().order_by('-priority', '-created_at')
    serializer_class = PromotionSerializer
    permission_classes = [permissions.IsAuthenticated] # Or IsAdminUser if restricted
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['active', 'discount_type']
    search_fields = ['name']
