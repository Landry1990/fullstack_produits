import logging

from django.core.cache import cache
from django.db.models import Count, DecimalField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...cache_mixins import SimpleListCacheMixin
from ...models import (
    Commande,
    CommandeProduit,
    FactureProduitAllocation,
    PaiementFournisseur,
    StockLot,
)
from ...pagination import StandardResultsSetPagination
from ...search_mixins import MultiTermSearchMixin
from ...serializer_mixins import OptimizedSerializerMixin
from ...serializers import CommandeSerializer
from ...serializers_optimized import (
    CommandeDetailSerializer,
    CommandeListSerializer,
    CommandeOmnisearchSerializer,
)
from .bulk_actions_mixin import CommandeBulkActionsMixin
from .cloture_mixin import CommandeClotureMixin
from .pdf_generation import generate_reception_pdf, generate_labels_pdf

logger = logging.getLogger(__name__)
business_logger = logging.getLogger('api.business')

class CommandeViewSet(
    CommandeClotureMixin,
    CommandeBulkActionsMixin,
    SimpleListCacheMixin,
    MultiTermSearchMixin,
    OptimizedSerializerMixin,
    viewsets.ModelViewSet,
):
    """
    API endpoint for commands with optimized serializers.
    - List view: Lightweight serializer (no products loaded)
    - Detail view: Complete serializer with all products
    - List cached for 120s — commands change less frequently than invoices
    """
    cache_prefix = 'commandes'
    cache_ttl = 120  # 2 minutes

    # Base queryset — each aggregate uses an isolated Subquery to avoid the
    # cartesian product that occurs when annotating across multiple FK relations
    # (produits × paiements) in a single .annotate() call.
    queryset = Commande.objects.select_related('fournisseur', 'closed_by') \
        .annotate(
            total_annotated=Coalesce(
                Subquery(
                    CommandeProduit.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(s=Sum(F('quantity') * F('price'), output_field=DecimalField()))
                    .values('s')[:1]
                ),
                Value(0, output_field=DecimalField())
            ),
            montant_paye_annotated=Coalesce(
                Subquery(
                    PaiementFournisseur.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(s=Sum('montant', output_field=DecimalField()))
                    .values('s')[:1]
                ),
                Value(0, output_field=DecimalField())
            ),
            items_count=Coalesce(
                Subquery(
                    CommandeProduit.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(c=Count('id'))
                    .values('c')[:1]
                ),
                Value(0)
            ),
            total_tva_annotated=Coalesce(
                Subquery(
                    CommandeProduit.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(s=Sum(F('quantity') * F('price') * F('tva') / 100, output_field=DecimalField()))
                    .values('s')[:1]
                ),
                Value(0, output_field=DecimalField())
            ),
        ).order_by('-date')
        
    serializer_class = CommandeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['type', 'status', 'fournisseur']
    search_fields = ['id', 'fournisseur__name', 'numero_facture', 'fournisseur_nom']
    ordering_fields = ['date', 'status']
    
    def get_serializer_class(self):
        if self.request.query_params.get('layout') == 'omnisearch':  # type: ignore
            return CommandeOmnisearchSerializer
        return super().get_serializer_class()

    # Serializers optimisés
    list_serializer_class = CommandeListSerializer
    detail_serializer_class = CommandeDetailSerializer

    def get_queryset(self):
        """
        Override to add prefetch_related only for detail views or omnisearch.
        List view doesn't need product data unless omnisearch is active.
        """
        qs = super().get_queryset().filter(is_active=True)
        
        # Le paramètre 'omnisearch' ou l'action détermine si on affiche la liste des produits
        is_omnisearch = self.request.query_params.get('layout') == 'omnisearch'  # type: ignore
        
        # Only prefetch products for detail views or omnisearch
        if self.action in ['retrieve', 'update', 'partial_update'] or is_omnisearch:
            qs = qs.prefetch_related(
                'produits__produit', 
                'produits__commande__fournisseur',
                'produits__stock_lot'  # Fix: Empêche N+1 sur instance.stock_lot.first()
            )
        
        return qs

    def list(self, request, *args, **kwargs):
        """
        Retourne la liste paginée avec des compteurs par statut indépendants de la pagination.
        Cache de 120s via SimpleListCacheMixin.
        """
        from django.core.cache import cache as django_cache

        cache_key = self._build_cache_key(request)
        cached = django_cache.get(cache_key)
        if cached is not None:
            response = Response(cached)
            response['X-Cache-Hit'] = 'true'
            return response

        queryset = self.filter_queryset(self.get_queryset())
        status_counts = dict(
            queryset.values('status').annotate(count=Count('id')).values_list('status', 'count')
        )
        for s in [Commande.Status.EN_PREPARATION, Commande.Status.EN_ATTENTE, Commande.Status.CLOTUREE]:
            if s not in status_counts:
                status_counts[s] = 0

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['status_counts'] = status_counts
        else:
            serializer = self.get_serializer(queryset, many=True)
            response = Response({
                'results': serializer.data,
                'status_counts': status_counts,
            })

        django_cache.set(cache_key, response.data, self.cache_ttl)
        response['X-Cache-Hit'] = 'false'
        return response




    def perform_destroy(self, instance):
        from django.utils import timezone
        # Vérification manuelle avant soft delete
        lots = StockLot.objects.filter(commande_produit__commande=instance)
        if FactureProduitAllocation.objects.filter(stock_lot__in=lots).exists():
             from rest_framework.exceptions import ValidationError
             raise ValidationError("Impossible de supprimer : Des lots de cette commande ont déjà été vendus ou utilisés.")
        
        instance.is_active = False
        instance.deleted_by = self.request.user
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_active', 'deleted_by', 'deleted_at'])
        self._invalidate_cache()




    @action(detail=True, methods=['get'])
    def imprimer_reception(self, request, pk=None):
        """Génère un PDF pour le bon de réception d'une commande."""
        commande = self.get_object()

        if commande.status != Commande.Status.CLOTUREE:
            return Response({'detail': 'Le bon de réception ne peut être généré que pour une commande clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        return generate_reception_pdf(commande)

    @action(detail=True, methods=['get'])
    def imprimer_etiquettes(self, request, pk=None):
        """Génère un PDF d'étiquettes pour les produits d'une commande."""
        commande = self.get_object()
        label_format = request.query_params.get('label_format', '40x20')
        return generate_labels_pdf(commande, label_format=label_format)

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """
        Acquiert le verrou pessimiste sur cette commande.
        Retourne 200 si acquis, 423 si déjà verrouillé par quelqu'un d'autre.
        """
        if not str(pk).isdigit() or int(pk) <= 0:
            return Response({'detail': 'PK invalide.'}, status=status.HTTP_404_NOT_FOUND)
        lock_key = f"doc_lock:commande:{pk}"
        username = request.user.username
        acquired = cache.add(lock_key, username, timeout=30)
        if acquired:
            return Response({'locked': True, 'holder': username})
        holder = cache.get(lock_key)
        if holder == username:
            cache.set(lock_key, username, timeout=30)
            return Response({'locked': True, 'holder': username})
        return Response(
            {'locked': False, 'holder': holder, 'detail': f'Commande verrouillée par {holder}.'},
            status=status.HTTP_423_LOCKED
        )

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        """
        Libère le verrou si l'utilisateur courant en est le détenteur.
        """
        if not str(pk).isdigit() or int(pk) <= 0:
            return Response({'detail': 'PK invalide.'}, status=status.HTTP_404_NOT_FOUND)
        lock_key = f"doc_lock:commande:{pk}"
        username = request.user.username
        holder = cache.get(lock_key)
        if holder == username:
            cache.delete(lock_key)
            return Response({'released': True})
        if holder is None:
            return Response({'released': True})
        return Response(
            {'released': False, 'detail': f'Vous ne détenez pas le verrou (détenteur: {holder}).'},
            status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=True, methods=['get'])
    def check_lock(self, request, pk=None):
        """
        Vérifie l'état du verrou sur cette commande.
        """
        if not str(pk).isdigit() or int(pk) <= 0:
            return Response({'detail': 'PK invalide.'}, status=status.HTTP_404_NOT_FOUND)
        lock_key = f"doc_lock:commande:{pk}"
        holder = cache.get(lock_key)
        return Response({
            'locked': holder is not None,
            'holder': holder,
            'is_mine': holder == request.user.username,
        })
