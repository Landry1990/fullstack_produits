import logging
from decimal import Decimal, InvalidOperation

from django.db.models import Count, DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.cache_mixins import SimpleListCacheMixin
from api.centralized_configs import BaseViewSetConfig, CommonFilterFields
from api.models import (
    AuditLog,
    Caisse,
    Facture,
)
from api.serializer_mixins import OptimizedSerializerMixin
from api.serializers import FactureSerializer
from api.serializers_optimized import (
    FactureDetailSerializer,
    FactureListSerializer,
    FactureOmnisearchSerializer,
)
from api.services import SalesService

from .facture_mixins import (
    FactureBulkMixin,
    FacturePrintMixin,
    FactureSalesMixin,
    FactureStatsMixin,
)

logger = logging.getLogger(__name__)


class FactureSearchFilter(filters.SearchFilter):
    def filter_queryset(self, request, queryset, view):
        search_terms = self.get_search_terms(request)
        if not search_terms:
            return queryset

        for term in search_terms:
            criteria = (
                Q(numero_facture__icontains=term)
                | Q(client__name__icontains=term)
                | Q(produits__produit__name__icontains=term)
            )
            normalized_amount = term.replace(' ', '').replace('\u00a0', '').replace('F', '').replace('f', '').replace(',', '.')
            try:
                criteria |= Q(total_ttc=Decimal(normalized_amount))
            except InvalidOperation:
                pass

            queryset = queryset.filter(criteria)

        return queryset.distinct()


class FactureViewSet(
    FactureSalesMixin,
    FactureBulkMixin,
    FacturePrintMixin,
    FactureStatsMixin,
    BaseViewSetConfig,
    SimpleListCacheMixin,
    OptimizedSerializerMixin,
    viewsets.ModelViewSet,
):
    """
    API endpoint for factures with optimized serializers.
    - List view: Lightweight serializer (7 fields) - excludes products and payments
    - Detail view: Complete serializer with all products and payments
    - List cached for 60s to reduce DB load on heavy join queries
    """
    cache_prefix = 'factures'
    cache_ttl = 60  # 60 secondes

    def list(self, request, *args, **kwargs):
        # Désactiver le cache pour la caisse centralisée (include_pending=true)
        # La caisse a besoin de données fraîches en temps réel (POS → caisse)
        include_pending = request.query_params.get('include_pending', 'false').lower() == 'true'
        if include_pending:
            # Court-circuiter le cache : appel direct au parent (ModelViewSet.list)
            return super(SimpleListCacheMixin, self).list(request, *args, **kwargs)
        return super().list(request, *args, **kwargs)
    
    def get_queryset(self):
        # Base optimization for all views: select related foreign keys
        queryset = Facture.objects.select_related('client', 'ayant_droit', 'created_by', 'validated_by').filter(is_active=True).order_by('-date').distinct()
        
        # FIX BUG: Utilisation de Subquery pour éviter le produit cartésien (multiplication des montants par le nombre d'articles)
        from api.models import Caisse
        
        base_caisse_regle = Caisse.objects.filter(
            facture=OuterRef('pk'), 
            statut='completee'
        ).exclude(mode_paiement='en_compte').values('facture').annotate(
            total=Sum('montant')
        ).values('total')

        base_caisse_compte = Caisse.objects.filter(
            facture=OuterRef('pk'), 
            statut='completee',
            mode_paiement='en_compte'
        ).values('facture').annotate(
            total=Sum('montant')
        ).values('total')

        queryset = queryset.annotate(
            montant_regle=Coalesce(
                Subquery(base_caisse_regle[:1], output_field=DecimalField()),
                Value(Decimal(0), output_field=DecimalField())
            ),
            montant_en_compte=Coalesce(
                Subquery(base_caisse_compte[:1], output_field=DecimalField()),
                Value(Decimal(0), output_field=DecimalField())
            ),
        )
        
        # Masquer les factures 'envoyées à la caisse' (VAL sans paiement) de la liste par défaut
        # sauf si on demande explicitement les brouillons ou les attentes.
        if self.action == 'list':
            include_pending = self.request.query_params.get('include_pending', 'false').lower() == 'true'  # type: ignore[attr-defined]
            if not include_pending:
                queryset = queryset.annotate(num_p=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_p=0)

        # Add prefetch only for detail view where products/payments are shown, OR omnisearch, OR printing
        is_omnisearch = self.request.query_params.get('layout') == 'omnisearch'  # type: ignore[attr-defined]
        is_checkout = self.request.query_params.get('include_details') == 'true'  # type: ignore[attr-defined]
        is_printing = self.action in ['retrieve', 'imprimer', 'imprimer_proforma', 'generer_avoir']
        
        if is_printing or is_omnisearch or is_checkout:
            queryset = queryset.prefetch_related('produits__produit', 'paiements')
            
        return queryset
    serializer_class = FactureSerializer
    filter_backends = [DjangoFilterBackend, FactureSearchFilter, filters.OrderingFilter]
    filterset_fields = {
        **CommonFilterFields.status_filters(),
        'client': ['exact'],
        'date': ['gte', 'lte', 'date'],
        'numero_facture': ['exact', 'icontains'],
        'created_by': ['exact'],
        'poste_caisse': ['exact'],
        'produits__produit__name': ['icontains'],
    }
    search_fields = ['numero_facture', 'client__name', 'produits__produit__name']
    
    def get_serializer_class(self):
        if self.request.query_params.get('layout') == 'omnisearch':  # type: ignore[attr-defined]
            return FactureOmnisearchSerializer
        if self.request.query_params.get('include_details') == 'true':  # type: ignore[attr-defined]
            return self.detail_serializer_class
        return super().get_serializer_class()

    # Serializers optimisés
    list_serializer_class = FactureListSerializer
    detail_serializer_class = FactureDetailSerializer

    @action(detail=False, methods=['get'])
    def page_init(self, request):
        """
        Unified endpoint for the Ventes page initial load.
        Returns factures (paginated), stats_jour (cached), and users list in one request.
        Accepts the same query params as the list endpoint (date__gte, date__lte, status, etc.)
        """
        from django.contrib.auth.models import User as AuthUser

        # 1. Factures list (reuse existing list logic with pagination + filters)
        # Temporarily set action to 'list' so the serializer mixin picks FactureListSerializer
        original_action = self.action
        self.action = 'list'
        factures_response = super().list(request)
        self.action = original_action
        # 2. Stats jour (now supports date filters)
        stats = self.stats_jour(request).data

        # 3. Users (lightweight list for seller filter)
        users_qs = AuthUser.objects.filter(is_active=True).order_by('first_name', 'last_name')
        users_data = [
            {
                'id': u.id,  # type: ignore[attr-defined]
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
            }
            for u in users_qs
        ]

        return Response({
            'factures': factures_response.data,
            'stats': stats,
            'users': users_data,
        })

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        self._invalidate_cache()

    def destroy(self, request, *args, **kwargs):
        """
        Supprime une facture (si brouillon ou annulée).
        Si la facture est VALIDEE ou PAYEE, on réintègre d'abord le stock via cancel_invoice.
        """
        from django.db.models import ProtectedError
        
        instance = self.get_object()
        
        facture_id = instance.id
        numero = instance.numero_facture
        montant = instance.total_ttc
        client_nom = instance.client.name if instance.client else 'Passager'
        status_initial = instance.status

        try:
            # 1. Si la facture est VALIDEE ou PAYEE, INTERDICTION de suppression physique (Traçabilité comptable)
            if status_initial in [Facture.Status.VALIDEE, Facture.Status.PAYEE, 'PAY', 'VAL']:
                 return Response({
                     'detail': 'Une facture validée ou payée ne peut pas être supprimée physiquement pour garantir la traçabilité comptable. Veuillez l\'annuler si nécessaire.'
                 }, status=status.HTTP_400_BAD_REQUEST)
            
            # 2. Si la facture est EN_COMPTE, on doit réintégrer le stock via annulation (elle n'est pas encore finie mais a impacté le stock)
            if status_initial == 'EN_COMPTE':
                success, message = SalesService.cancel_invoice(instance, request.user, motif=f"Réintégration automatique avant suppression par {request.user.username}")
                if not success:
                    return Response({'detail': f"Erreur lors de la réintégration du stock : {message}"}, status=status.HTTP_400_BAD_REQUEST)
            
            # 2. Log d'audit avant suppression
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_DELETE,
                model_name='Facture',
                object_id=numero or str(facture_id),
                description=f"Suppression Facture {numero or '#' + str(facture_id)} (Statut initial: {status_initial})",
                details={
                    'id': facture_id,
                    'numero': numero,
                    'amount': float(montant),
                    'client': client_nom,
                    'reintegrated_stock': status_initial in [Facture.Status.VALIDEE, Facture.Status.PAYEE, 'PAY', 'VAL', 'EN_COMPTE']
                },
                request=request
            )
            
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except ProtectedError:
            return Response({'detail': 'Impossible de supprimer cette facture car elle est liée à d\'autres éléments.'}, status=status.HTTP_400_BAD_REQUEST)

    def perform_destroy(self, instance):
        from django.utils import timezone
        instance.is_active = False
        instance.deleted_by = self.request.user
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_active', 'deleted_by', 'deleted_at'])
        self._invalidate_cache()
