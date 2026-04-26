from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, OuterRef, Subquery, IntegerField, CharField, Q, F
from django.db.models.functions import Coalesce
from ..models import Produit, Promis, CommandeProduit
from ..serializers import ProduitSerializer
from ..serializers_optimized import ProduitListSerializer, ProduitDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..cache_mixins import CachedSearchMixin
from ..search_mixins import MultiTermSearchMixin
from ..pagination import StandardResultsSetPagination
from ..cache_utils import SearchCache

# Imports des mixins modulaires
from .produit_actions import (
    ProduitStatsMixin,
    ProduitStockMixin,
    ProduitExportMixin,
    ProduitBulkMixin,
    ProduitStatusMixin
)

class ProduitViewSet(
    CachedSearchMixin, 
    MultiTermSearchMixin, 
    OptimizedSerializerMixin, 
    ProduitStatsMixin,
    ProduitStockMixin,
    ProduitExportMixin,
    ProduitBulkMixin,
    ProduitStatusMixin,
    viewsets.ModelViewSet
):
    """
    API endpoint for products with optimizations:
    - Automatic caching for search queries (TTL: 5 minutes)
    - Optimized serializers for list vs detail views
    - Multi-term AND search (e.g., "doli 500" finds products with both terms)
    """
    queryset = Produit.objects.select_related('rayon', 'fournisseur', 'forme').order_by('name')
    serializer_class = ProduitSerializer
    list_serializer_class = ProduitListSerializer
    detail_serializer_class = ProduitDetailSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'stock', 'selling_price', 'updated_at']
    search_fields = ['^name', '^cip1', '^cip2', '^cip3']

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Annotation pour le nombre de promis actifs
        promis_subquery = Promis.objects.filter(
            produit=OuterRef('pk'),
            status='ATT'
        ).values('produit').annotate(count=Count('id')).values('count')
        
        queryset = queryset.annotate(
            active_promis_count=Coalesce(Subquery(promis_subquery), 0, output_field=IntegerField())
        )
        
        # Par défaut, ne montrer que les produits actifs (sauf si include_inactive=true)
        if not self.request.query_params.get('include_inactive'):
            queryset = queryset.filter(is_active=True)
            
        # Filtrage manuel (ex: rapports, alertes)
        has_reserve = self.request.query_params.get('has_reserve_storage')
        if has_reserve is not None:
            queryset = queryset.filter(has_reserve_storage=(has_reserve.lower() == 'true'))

        needs_reappro = self.request.query_params.get('needs_reappro')
        if needs_reappro is not None and needs_reappro.lower() == 'true':
            queryset = queryset.filter(
                has_reserve_storage=True,
                stock__lte=F('min_rayon'),
                stock_reserve__gt=0
            )

        stock_lt = self.request.query_params.get('stock_lt')
        if stock_lt is not None:
            try: queryset = queryset.filter(stock__lt=float(stock_lt))
            except ValueError: pass

        stock_lte = self.request.query_params.get('stock__lte')
        if stock_lte is not None:
            try: queryset = queryset.filter(stock__lte=float(stock_lte))
            except ValueError: pass

        rotation_gte = self.request.query_params.get('rotation_moyenne__gte')
        if rotation_gte is not None:
            try: queryset = queryset.filter(rotation_moyenne__gte=float(rotation_gte))
            except ValueError: pass

        rotation_gt = self.request.query_params.get('rotation_moyenne__gt')
        if rotation_gt is not None:
            try: queryset = queryset.filter(rotation_moyenne__gt=float(rotation_gt))
            except ValueError: pass
            
        rayon_id = self.request.query_params.get('rayon')
        if rayon_id is not None:
             queryset = queryset.filter(rayon_id=rayon_id)

        fournisseur_id = self.request.query_params.get('fournisseur')
        if fournisseur_id is not None:
             queryset = queryset.filter(fournisseur_id=fournisseur_id)

        groupe_id = self.request.query_params.get('groupe')
        if groupe_id is not None:
             queryset = queryset.filter(groupe_id=groupe_id)
             
        for_inventory = self.request.query_params.get('for_inventory', 'false').lower() == 'true'
        if for_inventory:
             queryset = queryset.filter(is_active=True).exclude(name__icontains="X -")

        if self.request.query_params.get('latest_supplier') == 'true':
            # Subquery to get the supplier name from the latest order containing this product
            latest_cp_subquery = CommandeProduit.objects.filter(
                produit=OuterRef('pk'),
                commande__fournisseur__isnull=False
            ).order_by('-commande__date', '-id').values('commande__fournisseur__name')[:1]
            
            queryset = queryset.annotate(
                latest_fournisseur_name=Subquery(latest_cp_subquery, output_field=CharField())
            )
             
        return queryset

    def perform_update(self, serializer):
        super().perform_update(serializer)
        SearchCache.invalidate_all_products()

    def perform_destroy(self, instance):
        instance.is_active = False
        suffix = " (Produit Supprimé)"
        if suffix not in instance.name:
            instance.name = f"{instance.name}{suffix}"
        instance.save(update_fields=['is_active', 'name'])
        SearchCache.invalidate_all_products()
