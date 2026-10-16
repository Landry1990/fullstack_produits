import logging
from decimal import Decimal, InvalidOperation

from django.db.models import Count, DecimalField, OuterRef, Prefetch, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django_filters import rest_framework as django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.cache_mixins import SimpleListCacheMixin
from api.centralized_configs import BaseViewSetConfig
from api.models import (
    AuditLog,
    AvoirClient,
    Caisse,
    Facture,
)
from api.serializer_mixins import OptimizedSerializerMixin
from api.serializers import FactureSerializer, FactureUpdateSerializer
from api.serializers_optimized import (
    FactureDetailSerializer,
    FactureListSerializer,
    FactureOmnisearchSerializer,
)
from api.services import SalesService
from api.utils.dates import day_bounds

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


class FactureFilter(django_filters.FilterSet):
    """FilterSet des factures.

    Le param ``date__date`` (jour exact) applique des bornes datetime
    ``[jour 00:00, lendemain 00:00)`` au lieu du cast ``::date`` SQL
    qui neutralise l'index btree sur la colonne ``date``.
    """

    date__date = django_filters.DateFilter(field_name='date', method='filter_date_day')

    def filter_date_day(self, queryset, name, value):
        lo, hi = day_bounds(value)
        return queryset.filter(date__gte=lo, date__lt=hi)

    class Meta:
        model = Facture
        fields = {
            'status': ['exact', 'in'],
            'client': ['exact'],
            'date': ['gte', 'lte'],
            'numero_facture': ['exact', 'icontains'],
            'created_by': ['exact'],
            'poste_caisse': ['exact'],
            'produits__produit__name': ['icontains'],
        }


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
        # Base optimization for all views: select related foreign keys.
        # remise_validated_by / prix_validated_by : lus par FactureListSerializer
        # (get_remise_validated_by_name / get_prix_validated_by_name) — sans
        # select_related c'est 2 requêtes par ligne (N+1).
        # avoirs_clients : le serializer fait .filter(statut='VALIDEE') qui
        # ignorerait un prefetch simple → Prefetch filtré + to_attr.
        queryset = (
            Facture.objects
            .select_related(
                'client', 'ayant_droit', 'created_by', 'validated_by',
                'remise_validated_by', 'prix_validated_by',
            )
            .prefetch_related(
                Prefetch(
                    'avoirs_clients',
                    queryset=AvoirClient.objects.filter(statut=AvoirClient.Statut.VALIDEE),
                    to_attr='avoirs_clients_valides',
                )
            )
            .filter(is_active=True)
            .order_by('-date')
            .distinct()
        )
        
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
    filterset_class = FactureFilter
    search_fields = ['numero_facture', 'client__name', 'produits__produit__name']
    
    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return FactureUpdateSerializer
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

    @action(detail=False, methods=['get'])
    def by_number(self, request):
        """Récupère une facture modifiable par son numéro pour la recharger en facturation."""
        numero = request.query_params.get('numero', '').strip().upper()
        if not numero:
            return Response(
                {'detail': 'Numéro de facture requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Normaliser les préfixes courants : FAC-123, F123, #123, 123
        numero_clean = numero
        for prefix in ('FAC-', 'F', '#'):
            if numero_clean.startswith(prefix):
                numero_clean = numero_clean[len(prefix):]

        # Recherche exacte d'abord
        q_exact = (
            Q(numero_facture__iexact=numero)
            | Q(numero_facture__iexact=f'FAC-{numero_clean}')
            | Q(numero_facture__iexact=numero_clean)
        )
        candidates = list(
            Facture.objects.filter(q_exact, is_active=True).order_by('-date')[:10]
        )

        # Sinon, recherche contient les derniers caractères (zéros initiaux, formats variables)
        # ou si les candidats exacts sont tous finalisés (payés/annulés) — un
        # homonyme modifiable peut exister sous un autre préfixe (DEV-, PV-…).
        if numero_clean and (
            not candidates
            or all(f.status in (Facture.Status.PAYEE, Facture.Status.ANNULEE)
                   for f in candidates)
        ):
            q_contains = Q(numero_facture__icontains=numero_clean) | Q(numero_facture__icontains=numero)
            seen_ids = {f.id for f in candidates}
            candidates += [
                f for f in Facture.objects.filter(q_contains, is_active=True)
                .order_by('-date')[:10]
                if f.id not in seen_ids
            ]

        # Si toujours rien, chercher par ID numérique
        if not candidates and numero_clean.isdigit():
            candidates = list(
                Facture.objects.filter(id=int(numero_clean), is_active=True)
            )

        # Le rappel vise une facture à modifier : plusieurs documents peuvent
        # partager le même numéro/suffixe (ex: DEV-025489 proforma modifiable
        # + FAC-025489 payée, ou ancienne facture annulée). Préférer le
        # candidat MODIFIABLE (ni payé ni annulé) ; sinon garder le plus
        # récent pour le message d'erreur « déjà payée ou annulée ».
        modifiable = [
            f for f in candidates
            if f.status not in (Facture.Status.PAYEE, Facture.Status.ANNULEE)
        ]
        facture = modifiable[0] if modifiable else (candidates[0] if candidates else None)

        if not facture:
            logger.warning('Facture introuvable pour rappel : numero=%s numero_clean=%s', numero, numero_clean)
            return Response(
                {'detail': f'Facture {numero} introuvable.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if facture.status in (Facture.Status.PAYEE, Facture.Status.ANNULEE):
            return Response(
                {'detail': 'Cette facture est déjà payée ou annulée et ne peut pas être modifiée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(facture)
        return Response(serializer.data)

    def perform_create(self, serializer):
        facture = serializer.save(created_by=self.request.user)
        self._invalidate_cache()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='Facture',
            object_id=facture.id,
            description=f"Création facture brouillon {facture.numero_facture or facture.id}",
            details={'numero_facture': facture.numero_facture, 'status': facture.status},
            request=self.request
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        new_status = serializer.validated_data.get('status')
        if new_status and new_status != instance.status:
            if new_status != Facture.Status.PAYEE:
                raise ValidationError({
                    'status': "Seule la transition vers le statut « Payée » est autorisée via cette route."
                })
            montant_paye = instance.paiements.filter(
                statut='completee'
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
            if montant_paye < instance.total_ttc - Decimal('0.1'):
                raise ValidationError({
                    'status': "Impossible de marquer cette facture comme payée : le montant encaissé ne couvre pas le total TTC."
                })
        fields = sorted(serializer.validated_data.keys())
        facture = serializer.save()
        self._invalidate_cache()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='Facture',
            object_id=facture.id,
            description=f"Modification facture {facture.numero_facture or facture.id}",
            details={'fields': fields, 'status': facture.status},
            request=self.request
        )

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
            if status_initial in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
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
                    'reintegrated_stock': status_initial in [Facture.Status.VALIDEE, Facture.Status.PAYEE, 'EN_COMPTE']
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
