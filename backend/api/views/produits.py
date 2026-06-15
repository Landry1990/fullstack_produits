from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, OuterRef, Subquery, IntegerField, CharField, Q, F, Sum, DecimalField, Min
from django.db.models.functions import Coalesce
from django.db.models import Prefetch
from ..models import Produit, Promis, CommandeProduit, StockLot
from ..serializers import ProduitSerializer
from ..serializers_optimized import ProduitListSerializer, ProduitDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..cache_mixins import CachedSearchMixin
from ..search_mixins import MultiTermSearchMixin
from ..cache_utils import SearchCache
from ..centralized_configs import (
    BaseViewSetConfig, 
    CommonSearchFields, 
    CommonOrderingFields,
    StandardResultsSetPagination
)

# Imports des mixins modulaires
from .produit_actions import (
    ProduitStatsMixin,
    ProduitStockMixin,
    ProduitExportMixin,
    ProduitBulkMixin,
    ProduitStatusMixin
)

class ProduitViewSet(
    BaseViewSetConfig,
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
    - SQL annotations for stock value and expiring dates (avoids N+1 queries)
    """
    
    # Explicitement autoriser toutes les méthodes CRUD
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    
    queryset = Produit.objects.select_related('rayon', 'fournisseur', 'forme').order_by('name')
    serializer_class = ProduitSerializer
    list_serializer_class = ProduitListSerializer
    detail_serializer_class = ProduitDetailSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = CommonOrderingFields.product_ordering()
    search_fields = CommonSearchFields.product_fields()

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # OPTIMISATION: Annotations SQL pour éviter les requêtes N+1
        # Calcul de la valeur du stock (somme des lots * prix ou stock * cost_price)
        valeur_stock_lots = StockLot.objects.filter(
            produit=OuterRef('pk'),
            quantity_remaining__gt=0
        ).values('produit').annotate(
            total=Sum(F('quantity_remaining') * F('price_cost'), output_field=DecimalField())
        ).values('total')
        
        # Date d'expiration la plus proche parmi les lots actifs
        next_expiring_lots = StockLot.objects.filter(
            produit=OuterRef('pk'),
            quantity_remaining__gt=0,
            date_expiration__isnull=False
        ).values('produit').annotate(
            min_date=Min('date_expiration')
        ).values('min_date')
        
        queryset = queryset.annotate(
            # Valeur stock calculée en SQL
            valeur_stock_calc=Coalesce(
                Subquery(valeur_stock_lots),
                F('stock') * F('cost_price'),
                output_field=DecimalField()
            ),
            # Date d'expiration la plus proche
            next_expiring_calc=Subquery(next_expiring_lots, output_field=CharField())
        )
        
        # OPTIMISATION: Prefetch des lots actifs pour éviter N+1 dans get_stock_lots
        # Seulement pour les actions qui ont besoin des lots (retrieve, pas list)
        if self.action in ['retrieve', 'update', 'partial_update']:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'stock_lots',
                    queryset=StockLot.objects.filter(quantity_remaining__gt=0).order_by('date_expiration'),
                    to_attr='active_lots'
                )
            )
        
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

        # Filtrage par DCI / Substance
        substance_id = self.request.query_params.get('substances')
        if substance_id:
            queryset = queryset.filter(Q(substances__id=substance_id) | Q(dci_reference_id=substance_id)).distinct()

        dci_id = self.request.query_params.get('dci_reference')
        if dci_id:
            queryset = queryset.filter(dci_reference_id=dci_id)

        fournisseur_id = self.request.query_params.get('fournisseur')
        if fournisseur_id is not None:
             queryset = queryset.filter(fournisseur_id=fournisseur_id)

        groupe_id = self.request.query_params.get('groupe')
        if groupe_id is not None:
             queryset = queryset.filter(groupe_id=groupe_id)
             
        for_inventory = self.request.query_params.get('for_inventory', 'false').lower() == 'true'
        if for_inventory:
             queryset = queryset.filter(is_active=True).exclude(name__icontains="X -")

        only_in_stock = self.request.query_params.get('only_in_stock', 'false').lower() == 'true'
        if only_in_stock:
             queryset = queryset.filter(stock__gt=0)

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

    @action(detail=True, methods=['get'])
    def substituts(self, request, pk=None):
        """
        Retourne les produits substituables : partage au moins une substance,
        stock > 0, actif. Utilise toutes les substances liées (M2M), pas seulement dci_reference.
        """
        from django.db.models import Q
        from ..serializers_optimized import ProduitListSerializer

        produit = self.get_object()
        substances = list(produit.substances.all())

        if not substances:
            dci = produit.dci_reference
            if not dci:
                return Response({'substituts': [], 'dci': None, 'message': 'Aucune DCI définie pour ce produit.'})
            substances = [dci]

        substance_ids = [s.id for s in substances]
        qs = Produit.objects.filter(
            Q(substances__id__in=substance_ids) | Q(dci_reference_id__in=substance_ids),
            is_active=True,
            stock__gt=0
        ).exclude(pk=produit.pk).select_related('rayon', 'fournisseur', 'forme').distinct().order_by('selling_price')

        serializer = ProduitListSerializer(qs, many=True, context={'request': request})

        # DCI affichée : la substance avec le plus de produits liés (plus pertinente cliniquement)
        # ou le dci_reference s'il existe
        primary_dci = produit.dci_reference
        if primary_dci and primary_dci.id in substance_ids:
            dci_name = primary_dci.nom
        else:
            dci_name = substances[0].nom if substances else None

        return Response({
            'substituts': serializer.data,
            'dci': dci_name,
            'dcis': [s.nom for s in substances],
            'count': qs.count()
        })

    @action(detail=False, methods=['get'])
    def sans_dci(self, request):
        """
        Retourne les produits actifs sans DCI de référence (pour maintenance).
        """
        from ..serializers_optimized import ProduitListSerializer
        qs = Produit.objects.filter(dci_reference__isnull=True, is_active=True).order_by('name')[:50]
        serializer = ProduitListSerializer(qs, many=True, context={'request': request})
        return Response({'produits': serializer.data, 'count': qs.count()})
