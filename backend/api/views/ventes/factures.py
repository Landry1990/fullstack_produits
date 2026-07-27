import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import DatabaseError, transaction
from django.db.models import Count, DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.cache_mixins import SimpleListCacheMixin
from api.centralized_configs import BaseViewSetConfig, CommonFilterFields
from api.idempotency import idempotent_action
from api.models import (
    AuditLog,
    Caisse,
    Facture,
    FactureProduit,
    InvoiceSettings,
    Produit,
)
from api.security_utils import build_safe_content_disposition
from api.serializer_mixins import OptimizedSerializerMixin
from api.serializers import FacturePrintSerializer, FactureSerializer
from api.serializers_optimized import (
    FactureDetailSerializer,
    FactureListSerializer,
    FactureOmnisearchSerializer,
)
from api.services import SalesService
from api.services.invoice_pdf import generate_invoice_pdf
from api.services.sales_statistics import build_sales_statistics
from api.sudo_utils import validate_sudo_mode
from api.whatsapp_service import WhatsAppService

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


class FactureViewSet(BaseViewSetConfig, SimpleListCacheMixin, OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for factures with optimized serializers.
    - List view: Lightweight serializer (7 fields) - excludes products and payments
    - Detail view: Complete serializer with all products and payments
    - List cached for 60s to reduce DB load on heavy join queries
    """
    cache_prefix = 'factures'
    cache_ttl = 60  # 60 secondes
    
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

    @action(detail=False, methods=['post'])
    @transaction.atomic
    @idempotent_action
    def finaliser(self, request):
        """
        Action ATOMIQUE pour finaliser une vente complète via SalesService.
        """
        import json

        # Determine if data came in as JSON or FormData
        if 'multipart/form-data' in request.content_type:
            # Reconstruct data from 'json_data' field if present, otherwise use request.data
            json_str = request.data.get('json_data')
            if json_str:
                data = json.loads(json_str)
            else:
                # Fallback: maybe they just sent a flat multipart
                data = request.data
        else:
            data = request.data

        user = request.user
        centralized = data.get('centralized_cash_register', True)

        image_file = request.FILES.get('image_ordonnance')

        # --- Early data validation (before Sudo check) ---
        produits_data = data.get('produits')
        if not isinstance(produits_data, list) or not produits_data:
            return Response({'detail': "La liste des produits ne peut pas être vide."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate selling_price format and compute quick sum
        try:
            temp_sum = Decimal(0)
            for p in produits_data:
                q = Decimal(str(p.get('quantity', 0)))
                pr = Decimal(str(p.get('selling_price', 0)))
                rem = Decimal(str(p.get('discount', 0)))
                temp_sum += (q * pr) - rem
        except (InvalidOperation, ValueError, TypeError):
            return Response({'detail': "Données de produit invalides (prix ou quantité non numérique)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            remise_globale = Decimal(str(data.get('remise', 0) or 0))
        except (InvalidOperation, ValueError):
            remise_globale = Decimal(0)

        if remise_globale > temp_sum:
            return Response({'detail': f"La remise globale ({remise_globale} F) ne peut pas être supérieure au total des produits ({temp_sum} F)."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce Sudo for non-positive amounts
        # Robust total TTC extraction
        totals_obj = data.get('totals') if isinstance(data.get('totals'), dict) else {}
        try:
            total_ttc = Decimal(str(totals_obj.get('totalTtc', 0)))
        except (ValueError, InvalidOperation):
            total_ttc = Decimal(0)

        # If total is 0 but we have products, use the quick sum already computed
        if total_ttc <= 0 and produits_data:
            total_ttc = temp_sum - remise_globale

        validation_user = user
        is_avoir_client = data.get('is_avoir_client', False)
        poste_vente_id = data.get('poste_vente_id')

        # En mode caisse centrale, une caisse physique doit être ouverte avant toute vente
        if centralized:
            from ...models import PosteVente
            if not PosteVente.objects.filter(est_actif=True, caisse__isnull=False).exists():
                return Response(
                    {'detail': "Aucun point de caisse n'est ouvert. Veuillez ouvrir un point de caisse avant de réaliser une vente."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Every privileged override is authorized by the sudo validator's profile.
        product_prices = {
            product.id: product.selling_price
            for product in Produit.objects.filter(id__in=[p.get('produit') for p in produits_data])
        }
        requested_quantities = {}
        requires_price_override = remise_globale > 0
        for product_data in produits_data:
            product_id = product_data.get('produit')
            quantity = int(product_data.get('quantity', 0))
            requested_quantities[product_id] = requested_quantities.get(product_id, 0) + quantity
            line_price = Decimal(str(product_data.get('selling_price', 0)))
            line_discount = Decimal(str(product_data.get('discount', 0) or 0))
            if line_price != product_prices.get(product_id) or line_discount > 0:
                requires_price_override = True

        products = {product.id: product for product in Produit.objects.filter(id__in=requested_quantities)}
        requires_negative_stock_sale = any(
            quantity > 0 and products.get(product_id) is not None and quantity > products[product_id].stock
            for product_id, quantity in requested_quantities.items()
        )
        required_permissions = []
        if centralized or poste_vente_id:
            required_permissions.append('can_cash_out')
        if total_ttc <= 0 and not is_avoir_client:
            required_permissions.append('can_validate_zero_amount')
        if requires_price_override:
            required_permissions.append('can_modify_price')
        if requires_negative_stock_sale:
            required_permissions.append('can_sell_negative_stock')

        if required_permissions:
            try:
                validation_user, error_res = validate_sudo_mode(
                    request,
                    permission_attr=required_permissions,
                    data_source=data
                )
                if error_res:
                    return error_res
            except (DatabaseError, InvalidOperation, TypeError, ValueError) as e:
                # Si une erreur DB survient pendant la validation Sudo, on rollback et retourne une erreur propre
                transaction.set_rollback(True)
                logger.error(f"[VENTE] Erreur DB lors de la validation Sudo: {e!s}", exc_info=True)
                return Response({'detail': "Erreur de base de données lors de la validation. Veuillez réessayer."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Transfer validation user to data for SalesService
            if validation_user and 'validation_user' not in data:
                 data['validation_user'] = validation_user

            facture = SalesService.finalize_sale(user, data, centralized=centralized, image_file=image_file)

            # Log d'audit - Safe formatting for Decimal
            total_display = float(facture.total_ttc)
            log_audit(
                user=request.user,
                action=AuditLog.Action.CREATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Création et finalisation Facture {facture.numero_facture} (Montant: {total_display:,.0f} F)",
                details={
                    'numero_facture': facture.numero_facture,
                    'total_ttc': total_display,
                    'client': str(facture.client) if facture.client else facture.client_name_override,
                },
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except DatabaseError as e:
            # Gestion explicite des erreurs de base de données
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur DB lors de la finalisation: {e!s}", exc_info=True)
            return Response({'detail': "Erreur de base de données. La transaction a été annulée."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur critique finalisation: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur interne est survenue lors de la finalisation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def valider(self, request, pk=None, facture=None):
        """
        Valide une facture via SalesService.
        """
        if not facture:
            facture = self.get_object()
        
        required_permission = 'can_validate_zero_amount' if facture.total_ttc <= 0 else None
        validation_user, error_res = validate_sudo_mode(request, permission_attr=required_permission)
        if error_res:
            return error_res

        try:
            SalesService.validate_invoice(facture, validation_user, request.data)

            # Enregistrer le paiement si un mode est fourni
            mode_paiement = request.data.get('mode_paiement')
            if mode_paiement and facture.total_ttc > 0:
                Caisse.objects.create(
                    facture=facture,
                    mode_paiement=mode_paiement,
                    montant=facture.total_ttc,
                    statut='completee',
                    user=validation_user
                )

            # Log d'audit — une seule ligne claire
            vendeur_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            caissier_name = f"{validation_user.first_name} {validation_user.last_name}".strip() or validation_user.username
            client_label = str(facture.client) if facture.client else (facture.client_name_override or 'Passager')
            sudo_suffix = f" · Sudo: {caissier_name}" if validation_user != request.user else ''
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_VALIDATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Facture {facture.numero_facture} validée — {client_label} — {facture.total_ttc:,.0f} F · Vendeur: {vendeur_name}{sudo_suffix}",
                details={
                    'numero_facture': facture.numero_facture,
                    'total_ttc': float(facture.total_ttc),
                    'client': client_label,
                    'vendeur': vendeur_name,
                    'caissier': caissier_name,
                    'sudo_mode': validation_user != request.user,
                },
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response(serializer.data)
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur lors de la validation: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur est survenue lors de la validation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler(self, request, pk=None):
        """
        Annule une facture via SalesService.
        """
        facture = self.get_object()

        # Sudo logic in ViewSet
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cancel_invoice')
        if error_res:
            return error_res

        motif = request.data.get('motif', '')
        try:
            success, message = SalesService.cancel_invoice(facture, validation_user, motif)
            
            if success:
                log_audit(
                    user=request.user,
                    action=AuditLog.Action.INVOICE_CANCEL,
                    model_name='Facture',
                    object_id=facture.id,
                    description=f"Facture {facture.numero_facture or facture.id} annulée{' - Motif: ' + motif if motif else ''}",
                    details={
                        'facture_id': facture.id,
                        'numero_facture': facture.numero_facture,
                        'montant': float(facture.total_ttc),
                        'motif': motif,
                        'cancelled_by': validation_user.username
                    },
                    request=request
                )
                return Response({'status': message})
            
            transaction.set_rollback(True)
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur lors de l'annulation: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur est survenue lors de l'annulation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def modifier(self, request, pk=None):
        """
        Modifie une facture via SalesService.
        Supports standard permissions or Sudo validation.
        """
        facture = self.get_object()
        
        # Permission check with Sudo support
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_modify_invoice')
        if error_res:
            return error_res

        try:
            facture, old_total, difference, old_quantities, new_quantities = SalesService.modify_sale(facture, validation_user, request.data)
            
            # Audit log - une seule ligne par modification de vente
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Facture {facture.numero_facture or facture.id} modifiée. Ancien total: {old_total:.0f}F, Nouveau total: {facture.total_ttc:.0f}F, Différence: {difference:+.0f}F",
                details={
                    'facture_id': facture.id,
                    'numero_facture': facture.numero_facture,
                    'old_total': float(old_total),
                    'new_total': float(facture.total_ttc),
                    'difference': float(difference),
                    'old_quantities': old_quantities,
                    'new_quantities': new_quantities,
                },
                request=request
            )
            
            serializer = self.get_serializer(facture)
            return Response({
                'facture': serializer.data,
                'old_total': float(old_total),
                'new_total': float(facture.total_ttc),
                'difference': float(difference)
            })
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur lors de la modification: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur est survenue lors de la modification."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def generer_avoir(self, request, pk=None):
        """
        Retourne le contenu de la facture validée/payée, mais avec des quantités négatives
        pour faciliter la création d'un avoir (retour client) via le frontend.
        """
        facture = self.get_object()
        
        if facture.status not in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
            return Response(
                {'detail': "Seules les factures validées ou payées peuvent faire l'objet d'un avoir."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client_data = None
        if facture.client:
            from ...serializers import ClientSerializer
            client_data = ClientSerializer(facture.client).data
        
        produits_data = []
        for item in facture.produits.select_related('produit').all():
            produit_info = {
                'id': item.produit.id,
                'name': item.produit.name,
                'tva': float(item.produit.tva),
                'cip1': item.produit.cip1,
                'use_lot_management': item.produit.use_lot_management,
                'stock': item.produit.stock, 
            }
            produits_data.append({
                'id': item.id,
                'produit': item.produit_id,
                'produit_details': produit_info,
                'quantity': -abs(item.quantity), # Quantity in negative
                'selling_price': float(item.selling_price),
                'discount': float(item.discount),
                'tva': float(item.tva),
                'stock_lot': item.stock_lot_id,
                'lot': item.lot,
            })

        return Response({
            'original_facture_id': facture.id,
            'original_numero_facture': facture.numero_facture,
            'date': facture.date,
            'client': client_data,
            'client_name_override': facture.client_name_override,
            'ayant_droit': facture.ayant_droit_id,
            'remise': float(facture.remise),
            'produits': produits_data,
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_delete(self, request):
        """
        Supprime plusieurs factures (brouillons ou annulées) via leur ID.
        Payload: { "ids": [1, 2, 3] }
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Filtrer les factures supprimables (Brouillon ou Annulée)
        factures_to_delete = Facture.objects.filter(
            id__in=ids, 
            status__in=[Facture.Status.BROUILLON, Facture.Status.ANNULEE]
        )
        
        count = factures_to_delete.count()
        deleted_ids = list(factures_to_delete.values_list('id', flat=True))
        
        if count == 0:
             return Response({'detail': 'Aucune facture supprimable trouvée (doit être BROUILLON ou ANNULEE).'}, status=status.HTTP_400_BAD_REQUEST)

        # Audit Log
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVOICE_DELETE,
            model_name='Facture',
            object_id='BULK',
            description=f"Mise en corbeille de {count} facture(s)",
            details={'ids': deleted_ids},
            request=request
        )

        factures_to_delete.update(is_active=False)
        
        return Response({
            'status': 'success',
            'detail': f'{count} facture(s) mise(s) en corbeille.',
            'deleted_ids': deleted_ids
        })

    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def supprimer_brouillons(self, request):
        """
        Supprime toutes les factures en statut brouillon.
        """
        brouillons = Facture.objects.filter(status=Facture.Status.BROUILLON)
        count = brouillons.count()
        ids = list(brouillons.values_list('id', flat=True))
        
        if count > 0:
            # Audit Log
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_DELETE,
                model_name='Facture',
                object_id='BROUILLONS_PURGE',
                description=f"Suppression massive de {count} facture(s) en brouillon",
                details={'ids': ids},
                request=request
            )
            
            brouillons.update(is_active=False)
        
        return Response({
            'status': 'success',
            'detail': f'{count} facture(s) brouillon mise(s) en corbeille avec succès.',
            'count': count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mobile')
    @transaction.atomic
    def sync_mobile(self, request):
        """
        Endpoint dédié à l'application mobile LAN (Store-and-Forward).
        Reçoit une facture créée hors-ligne et la finalise sur le serveur.
        """
        data = request.data
        uuid_mobile = data.get('uuid')
        client_name = data.get('client')
        items = data.get('items', [])
        total = data.get('total', 0)

        if not items:
            return Response({'detail': "La facture mobile ne contient aucun article."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Transformation du payload mobile vers le format attendu par SalesService
            produits_data = []
            for item in items:
                produits_data.append({
                    'product_id': item.get('product_id'),
                    'quantity': item.get('quantity', 1),
                    'selling_price': item.get('unit_price', 0),
                    'discount': 0
                })
                
            payload_vente = {
                'client_name_override': client_name,
                'produits': produits_data,
                'totals': {'totalTtc': total},
                'remise': 0,
                'centralized_cash_register': True,
                'is_mobile_sync': True, # Optionnel : flag pour statistiques futures
                'mobile_uuid': uuid_mobile
            }
            
            # Finalisation standard (qui gère le stock, caisse, etc.)
            facture = SalesService.finalize_sale(request.user, payload_vente, centralized=True)
            
            # Audit spécifique Mobile
            log_audit(
                user=request.user,
                action=AuditLog.Action.CREATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Sync Facture Mobile LAN {facture.numero_facture} (Montant: {total:,.0f} F)",
                details={'uuid_mobile': uuid_mobile},
                request=request
            )
            
            return Response({
                'uuid': uuid_mobile,
                'server_number': facture.numero_facture,
                'id': facture.id,
                'status': 'synced'
            }, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[MOBILE SYNC] Erreur critique lors de la synchronisation: {e!s}", exc_info=True)
            return Response({'detail': "Erreur lors de la synchronisation de la facture."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=False, methods=['get'])
    def stats_jour(self, request):
        result = build_sales_statistics(
            self.get_queryset(),
            request.query_params.get('date__gte'),
            request.query_params.get('date__lte'),
        )
        return Response(result)

    @action(detail=True, methods=['get'])
    def imprimer_facture(self, request, pk=None):
        """
        Génère un PDF pour la facture.
        """
        facture = self.get_object()
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        is_proforma = request.query_params.get('type') == 'proforma' or facture.status == Facture.Status.PROFORMA
        
        buffer = generate_invoice_pdf(facture, settings, is_proforma)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"facture_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = build_safe_content_disposition(filename)
        response.write(buffer.getvalue())
        return response

    @action(detail=True, methods=['post'])
    def send_whatsapp(self, request, pk=None):
        """
        Envoie la facture par WhatsApp.
        """
        facture = self.get_object()
        client = facture.client
        
        recipient_number = request.data.get('phone') or (client.phone if client else None)
        
        if not recipient_number:
            return Response({'detail': 'Aucun numéro de téléphone destinataire fourni.'}, status=status.HTTP_400_BAD_REQUEST)
            
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        
        # Check if enabled
        from ...models import PharmacySettings
        pharmacy_settings = PharmacySettings.objects.first()
        if not pharmacy_settings or not pharmacy_settings.whatsapp_enabled:
            return Response({'detail': 'L\'intégration WhatsApp n\'est pas activée dans les paramètres.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            buffer = generate_invoice_pdf(facture, settings)
            success, message = WhatsAppService.send_invoice_pdf(
                facture, recipient_number, buffer, client.name if client else "Client"
            )
            
            log_audit(
                request.user, 
                AuditLog.Action.AUTRE, 
                'Facture', 
                facture.id, 
                f"Envoi facture {facture.numero_facture} via WhatsApp à {recipient_number}",
                request=request
            )
            
            if success:
                return Response({'detail': message})
            return Response({'detail': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            logger.error(f"Erreur envoi WhatsApp: {e!s}")
            return Response({'detail': f"Erreur lors de l'envoi : {e!s}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def print_data(self, request, pk=None):
        """
        Retourne les données complètes pour l'impression frontend.
        """
        facture = self.get_object()
        serializer = FacturePrintSerializer(facture)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def caisse_par_tranche_horaire(self, request):
        """
        Calcule la caisse pour une tranche horaire spécifique.
        """
        date_debut_str = request.query_params.get('date_debut', None)
        date_fin_str = request.query_params.get('date_fin', None)
        
        try:
            if date_debut_str:
                try:
                    start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': 'Format invalide pour date_debut'}, status=status.HTTP_400_BAD_REQUEST)
                start_datetime = timezone.make_aware(start_datetime)
            else:
                return Response({'detail': 'date_debut requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if date_fin_str:
                try:
                    end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': 'Format invalide pour date_fin'}, status=status.HTTP_400_BAD_REQUEST)
                end_datetime = timezone.make_aware(end_datetime)
            else:
                return Response({'detail': 'date_fin requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if start_datetime >= end_datetime:
                return Response({'detail': "La date de début doit être antérieure à la date de fin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'detail': f'Erreur date: {e!s}'}, status=status.HTTP_400_BAD_REQUEST)
        
        factures = self.get_queryset().filter(
            date__gte=start_datetime,
            date__lte=end_datetime,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
        total_ttc = Decimal('0.00')
        total_ht = Decimal('0.00')
        total_ht_apres_remise = Decimal('0.00')
        total_tva = Decimal('0.00')
        total_remise = Decimal('0.00')
        total_regle = Decimal('0.00')
        total_en_compte = Decimal('0.00')
        nombre_factures = factures.count()
        
        for facture in factures:
            try:
                facture_sous_total_ht = Decimal(str(facture.total_ht))
                facture_remise = Decimal(str(facture.remise))
                facture_total_tva = Decimal(str(facture.total_tva))
                facture_total_ttc = Decimal(str(facture.total_ttc))
                facture_regle = Decimal(str(getattr(facture, 'montant_regle', 0)))
                facture_en_compte = Decimal(str(getattr(facture, 'montant_en_compte', 0)))
                
                logger.debug(f"Tranche Stats: Facture #{facture.id} - TTC: {facture_total_ttc}, Regle: {facture_regle}, EnCompte: {facture_en_compte}, Status: {facture.status}")
                
                facture_total_ht_apres_remise = facture_sous_total_ht - facture_remise
                
                total_ht += facture_sous_total_ht
                total_remise += facture_remise
                total_ht_apres_remise += facture_total_ht_apres_remise
                total_tva += facture_total_tva
                total_ttc += facture_total_ttc
                total_regle += facture_regle
                total_en_compte += facture_en_compte
                
            except (ValueError, TypeError, AttributeError):
                pass
        
        total_ht_final = total_ht_apres_remise
        
        response_data = {
            'date_debut': start_datetime.strftime('%Y-%m-%d %H:%M'),
            'date_fin': end_datetime.strftime('%Y-%m-%d %H:%M'),
            'tranche': f"{start_datetime.strftime('%d-%m-%Y %Hh%M')} - {end_datetime.strftime('%d-%m-%Y %Hh%M')}",
            'nombre_factures': nombre_factures,
            'total_ht': str(total_ht_final.quantize(Decimal('0.01'))),
            'total_tva': str(total_tva.quantize(Decimal('0.01'))),
            'total_ttc': str(total_ttc.quantize(Decimal('0.01'))),
            'total_regle': str(total_regle.quantize(Decimal('0.01'))),
            'total_en_compte': str(total_en_compte.quantize(Decimal('0.01'))),
            'sous_total_ht': str(total_ht.quantize(Decimal('0.01'))),
            'total_remise': str(total_remise.quantize(Decimal('0.01')))
        }
        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def marquer_payee(self, request, pk=None):
        """
        Marque une facture comme payée.
        """
        facture = self.get_object()
        if facture.status != Facture.Status.VALIDEE:
            return Response({'detail': 'Seules les factures validées peuvent être marquées comme payées.'}, status=status.HTTP_400_BAD_REQUEST)

        facture.status = Facture.Status.PAYEE
        facture.save(update_fields=['status'])

        return Response({'status': 'Facture marquée comme payée.'})

    @action(detail=False, methods=['post'])
    def bulk_cancel(self, request):
        """
        Annule plusieurs factures en lot avec réintégration automatique du stock.
        Body:
          - {"facture_ids": [1, 2, 3]} pour annuler une sélection
          - {"all_pending": true, "batch_size": 50} pour annuler par lots
        Réservé aux administrateurs (sudo requis).
        """
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cancel_invoice')
        if error_res:
            return error_res

        motif = request.data.get('motif', 'Vidange caisse centrale')
        batch_size = request.data.get('batch_size')
        if batch_size is not None:
            try:
                batch_size = int(batch_size)
                if batch_size < 1:
                    batch_size = None
            except (ValueError, TypeError):
                batch_size = None

        if request.data.get('all_pending'):
            all_pending_qs = Facture.objects.filter(
                is_active=True,
                status__in=[Facture.Status.BROUILLON, Facture.Status.PROFORMA, Facture.Status.VALIDEE]
            ).order_by('id')
            total_remaining = all_pending_qs.count()
            if batch_size:
                factures = all_pending_qs[:batch_size]
            else:
                factures = all_pending_qs
        else:
            ids = request.data.get('facture_ids', [])
            if not ids:
                return Response({'detail': 'Aucune facture sélectionnée.'}, status=status.HTTP_400_BAD_REQUEST)
            total_remaining = len(ids)
            if batch_size:
                ids = ids[:batch_size]
            factures = Facture.objects.filter(id__in=ids, is_active=True).order_by('id')

        if not factures.exists():
            return Response({'detail': 'Aucune facture à annuler.'}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        success_count = 0
        error_count = 0
        total_reintegrated = 0

        for facture in factures:
            if facture.status == Facture.Status.ANNULEE:
                results.append({'id': facture.id, 'numero': facture.numero_facture, 'status': 'deja_annulee'})
                error_count += 1
                continue
            try:
                was_validated = facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]
                success, message = SalesService.cancel_invoice(facture, validation_user, motif)
                if success:
                    items_count = FactureProduit.objects.filter(facture=facture).count()
                    total_reintegrated += items_count if was_validated else 0
                    results.append({
                        'id': facture.id,
                        'numero': facture.numero_facture,
                        'status': 'annulee',
                        'stock_reintegrated': was_validated
                    })
                    success_count += 1
                    log_audit(
                        user=request.user,
                        action=AuditLog.Action.INVOICE_CANCEL,
                        model_name='Facture',
                        object_id=facture.id,
                        description=f"Annulation en lot - Facture {facture.numero_facture or facture.id}",
                        details={
                            'facture_id': facture.id,
                            'numero_facture': facture.numero_facture,
                            'montant': float(facture.total_ttc),
                            'motif': motif,
                            'bulk_cancel': True,
                            'cancelled_by': validation_user.username
                        },
                        request=request
                    )
                else:
                    results.append({'id': facture.id, 'numero': facture.numero_facture, 'status': 'erreur', 'detail': message})
                    error_count += 1
            except Exception as e:
                logger.error(f"[BULK_CANCEL] Erreur sur facture {facture.id}: {e!s}")
                results.append({'id': facture.id, 'numero': facture.numero_facture, 'status': 'erreur', 'detail': str(e)})
                error_count += 1

        processed = success_count + error_count
        remaining = max(0, total_remaining - processed)
        return Response({
            'detail': f'{success_count} facture(s) annulée(s), {error_count} erreur(s).',
            'success_count': success_count,
            'error_count': error_count,
            'total_stock_reintegrated': total_reintegrated,
            'processed': processed,
            'remaining': remaining,
            'total': total_remaining,
            'batch_size': batch_size,
            'results': results
        })
