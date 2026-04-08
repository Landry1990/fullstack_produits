from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db import transaction
from django.db.models import Sum, Q, Value, DecimalField, Count, Subquery, OuterRef
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import HttpResponse
from datetime import datetime
from decimal import Decimal, InvalidOperation
import io
import logging

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

from api.models import (
    Facture, FactureProduit, InvoiceSettings, AuditLog
)
from api.services import SalesService
from api.serializers import FactureSerializer, FacturePrintSerializer
from api.serializers_optimized import FactureListSerializer, FactureDetailSerializer
from api.serializer_mixins import OptimizedSerializerMixin
from api.audit_helpers import log_audit
from api.sudo_utils import validate_sudo_mode
from api.whatsapp_service import WhatsAppService
from api.pagination import StandardResultsSetPagination

logger = logging.getLogger(__name__)


def header_footer_facture(canvas, doc, company_info, facture_info, facture):
    canvas.saveState()
    styles = getSampleStyleSheet()
    
    page_width, page_height = letter
    margin = doc.leftMargin
    content_width = doc.width

    # Header
    header_data = [
        [
            Paragraph(f"<b>{company_info['name']}</b><br/>{company_info['address']}<br/>Tel: {company_info['tel']}", styles['Normal']),
            Paragraph("<b>FACTURE</b>", styles['h1'])
        ]
    ]
    header_table = Table(header_data, colWidths=[content_width / 2, content_width / 2])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    w_header, h_header = header_table.wrapOn(canvas, content_width, doc.topMargin)
    header_table.drawOn(canvas, margin, page_height - doc.topMargin - h_header)

    # Separator line after header
    canvas.line(margin, page_height - doc.topMargin - h_header - 0.1*inch, margin + content_width, page_height - doc.topMargin - h_header - 0.1*inch)

    # Info box
    info_data = [
        [
            Paragraph(f"<b>Client:</b><br/>{facture_info['client_name']}<br/>{facture_info['client_address']}<br/>Tel: {facture_info['client_phone']}", styles['Normal']),
            Paragraph(f"<b>Facture N°:</b> {facture_info['facture_id']}<br/><b>Date:</b> {facture_info['date_facture']}<br/><b>Statut:</b> {facture.get_status_display()}", styles['Normal'])
        ]
    ]
    info_table = Table(info_data, colWidths=[content_width / 2, content_width / 2])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('TOPPADDING', (0,0), (-1,-1), 12)
    ]))
    w_info, h_info = info_table.wrapOn(canvas, content_width, doc.topMargin)
    info_table.drawOn(canvas, margin, page_height - doc.topMargin - h_header - 0.1*inch - h_info - 0.1*inch)

    # Footer
    footer_texts = [
        f"Page {doc.page}",
        f"Total TTC: {facture.total_ttc} F"
    ]
    canvas.drawString(margin, 0.75 * inch, footer_texts[0])
    canvas.drawRightString(margin + content_width, 0.75 * inch, footer_texts[1])
    
    canvas.restoreState()


class FactureViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for factures with optimized serializers.
    - List view: Lightweight serializer (7 fields) - excludes products and payments
    - Detail view: Complete serializer with all products and payments
    """
    
    def get_queryset(self):
        # Base optimization for all views: select related foreign keys
        queryset = Facture.objects.select_related('client', 'ayant_droit', 'created_by', 'validated_by').order_by('-date').distinct()
        
        # FIX BUG: Utilisation de Subquery pour éviter le produit cartésien (multiplication des montants par le nombre d'articles)
        from api.models import Caisse
        base_caisse = Caisse.objects.filter(facture=OuterRef('pk'), statut='completee').values('facture').annotate(
            total=Sum('montant')
        ).values('total')

        queryset = queryset.annotate(
            montant_regle=Coalesce(
                Subquery(
                    base_caisse.exclude(mode_paiement='en_compte')[:1],
                    output_field=DecimalField()
                ),
                Value(0, output_field=DecimalField())
            ),
            montant_en_compte=Coalesce(
                Subquery(
                    base_caisse.filter(mode_paiement='en_compte')[:1],
                    output_field=DecimalField()
                ),
                Value(0, output_field=DecimalField())
            )
        )
        
        # Masquer les factures 'envoyées à la caisse' (VAL sans paiement) de la liste par défaut
        # sauf si on demande explicitement les brouillons ou les attentes.
        if self.action == 'list':
            include_pending = self.request.query_params.get('include_pending', 'false').lower() == 'true'
            if not include_pending:
                queryset = queryset.annotate(num_p=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_p=0)

        # Add prefetch only for detail view where products/payments are shown
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('produits', 'paiements')
            
        return queryset
    serializer_class = FactureSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact', 'in'],
        'client': ['exact'],
        'date': ['gte', 'lte', 'date'],
        'numero_facture': ['exact', 'icontains'],
        'created_by': ['exact'],
        'produits__produit__name': ['icontains'],
    }
    search_fields = ['numero_facture', 'client__name', 'produits__produit__name']
    
    # Serializers optimisés
    list_serializer_class = FactureListSerializer
    detail_serializer_class = FactureDetailSerializer

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

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
                'id': u.id,
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

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def finaliser(self, request):
        """
        Action ATOMIQUE pour finaliser une vente complète via SalesService.
        """
        data = request.data
        user = request.user
        centralized = data.get('centralized_cash_register', True)
        
        # Enforce Sudo for non-positive amounts
        # Ensure we handle various formats of decimals in data
        try:
            total_ttc = Decimal(str(data.get('totals', {}).get('totalTtc', 0)))
        except (ValueError, InvalidOperation):
            total_ttc = Decimal('0')

        if total_ttc <= 0:
            validation_user, error_res = validate_sudo_mode(request)
            if error_res:
                return error_res
            if validation_user == user and not user.is_superuser:
                return Response({
                    'detail': "Une vente à montant nul ou négatif nécessite la validation d'un tiers-validateur (Sudo)."
                }, status=status.HTTP_403_FORBIDDEN)

        try:
            facture = SalesService.finalize_sale(user, data, centralized=centralized)
            
            # Log d'audit
            log_audit(
                user=request.user,
                action=AuditLog.Action.CREATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Création et finalisation Facture {facture.numero_facture} (Montant: {facture.total_ttc:,.0f} F)",
                details={
                    'numero_facture': facture.numero_facture,
                    'total_ttc': float(facture.total_ttc),
                    'client': str(facture.client) if facture.client else facture.client_name_override,
                },
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur critique finalisation: {str(e)}", exc_info=True)
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

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def valider(self, request, pk=None, facture=None):
        """
        Valide une facture via SalesService.
        """
        if not facture:
            facture = self.get_object()
        
        # Mode Sudo logic kept in ViewSet as it's request-related
        validation_user, error_res = validate_sudo_mode(request)
        if error_res:
            return error_res
        
        # Enforce Sudo for non-positive amounts on validation
        if facture.total_ttc <= 0 and validation_user == request.user and not request.user.is_superuser:
            return Response({
                'detail': "Cette facture à montant nul ou négatif nécessite la validation d'un tiers (Sudo) pour être validée."
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            SalesService.validate_invoice(facture, validation_user, request.data)
            
            # Log d'audit
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_VALIDATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Validation Facture {facture.numero_facture} (Montant: {facture.total_ttc:,.0f} F)",
                details={
                    'numero_facture': facture.numero_facture,
                    'total_ttc': float(facture.total_ttc),
                    'client': str(facture.client) if facture.client else facture.client_name_override,
                    'validated_by': validation_user.username,
                    'sudo_mode': validation_user != request.user
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
            logger.error(f"[VENTE] Erreur lors de la validation: {str(e)}", exc_info=True)
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
            logger.error(f"[VENTE] Erreur lors de l'annulation: {str(e)}", exc_info=True)
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
            facture, old_total, difference = SalesService.modify_sale(facture, validation_user, request.data)
            
            # Audit log
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
                    'difference': float(difference)
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
            logger.error(f"[VENTE] Erreur lors de la modification: {str(e)}", exc_info=True)
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
        for item in facture.produits.all():
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
            description=f"Suppression de {count} facture(s)",
            details={'ids': deleted_ids},
            request=request
        )

        factures_to_delete.delete()
        
        return Response({
            'detail': f'{count} facture(s) supprimée(s).',
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
            
            brouillons.delete()
        
        return Response({
            'detail': f'{count} facture(s) brouillon supprimée(s) avec succès.',
            'count': count
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'])
    def stats_jour(self, request):
        """
        Retourne les statistiques de vente. Par défaut du jour, ou selon les dates filtrées.
        """
        # Read date limits
        date_gte = request.query_params.get('date__gte')
        date_lte = request.query_params.get('date__lte')

        # Fallback to today if no dates provided
        today = timezone.now().date()
        
        # Build base queryset for filtering
        # On exclut les factures VALIDEE qui n'ont AUCUN paiement (ce sont celles juste 'envoyées à la caisse')
        base_qs = self.get_queryset().filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
        base_qs = base_qs.annotate(num_paiements=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_paiements=0)
        
        if date_gte:
            base_qs = base_qs.filter(date__gte=date_gte)
        elif not date_lte:
            base_qs = base_qs.filter(date__date=today)
            
        if date_lte:
            base_qs = base_qs.filter(date__lte=date_lte)

        # Base filters for related models
        vendeur_qs = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]).annotate(num_paiements=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_paiements=0)
        produit_qs = FactureProduit.objects.filter(facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]).annotate(num_paiements=Count('facture__paiements')).exclude(facture__status=Facture.Status.VALIDEE, num_paiements=0)

        if date_gte:
            vendeur_qs = vendeur_qs.filter(date__gte=date_gte)
            produit_qs = produit_qs.filter(facture__date__gte=date_gte)
        elif not date_lte:
            vendeur_qs = vendeur_qs.filter(date__date=today)
            produit_qs = produit_qs.filter(facture__date__date=today)
            
        if date_lte:
            vendeur_qs = vendeur_qs.filter(date__lte=date_lte)
            produit_qs = produit_qs.filter(facture__date__lte=date_lte)

        # 1. Top Vendeur (Chiffre d'Affaires)
        top_vendeur = vendeur_qs.values('created_by__username', 'created_by__first_name', 'created_by__last_name').annotate(
            total_vente=Sum('total_ttc'),
            count=Count('id')
        ).order_by('-total_vente').first()
        
        vendeur_data = None
        if top_vendeur:
            name = f"{top_vendeur['created_by__first_name']} {top_vendeur['created_by__last_name']}".strip()
            if not name:
                name = top_vendeur['created_by__username']
            vendeur_data = {
                'name': name,
                'amount': top_vendeur['total_vente'],
                'count': top_vendeur['count']
            }

        # 2. Top Produit (Quantité vendue)
        top_produit = produit_qs.values('produit__name').annotate(
            total_qty=Sum('quantity')
        ).order_by('-total_qty').first()
        
        produit_data = None
        if top_produit:
            produit_data = {
                'name': top_produit['produit__name'],
                'quantity': top_produit['total_qty']
            }

        # 3. Totaux globaux
        totaux = base_qs.aggregate(
            total_ttc=Sum('total_ttc'),
            total_regle=Sum('montant_regle'),
            total_en_compte=Sum('montant_en_compte')
        )

        result = {
            'top_vendeur': vendeur_data,
            'top_produit': produit_data,
            'total_ttc': str((totaux['total_ttc'] or 0)),
            'total_regle': str((totaux['total_regle'] or 0)),
            'total_en_compte': str((totaux['total_en_compte'] or 0)),
        }

        return Response(result)

    def _generate_pdf(self, facture, settings, is_proforma=False):
        """Helper to generate PDF buffer for a invoice."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        styles = getSampleStyleSheet()
        
        style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=16, spaceAfter=6, textColor=HexColor(settings.primary_color))
        style_normal = styles['Normal']
        style_title = ParagraphStyle('Title', parent=styles['Heading3'], fontSize=12, alignment=1)
        style_right = ParagraphStyle('Right', parent=styles['Normal'], alignment=2)
        style_center = ParagraphStyle('Center', parent=styles['Normal'], alignment=1)
        style_left = ParagraphStyle('Left', parent=styles['Normal'], alignment=0)

        company_address_fmt = settings.company_address.replace('\n', '<br/>')
        
        company_block = [
            Paragraph(f"<b>{settings.company_name}</b>", style_company),
            Paragraph(company_address_fmt, style_normal)
        ]
        
        invoice_date = (facture.date_document or facture.date).strftime('%d/%m/%Y à %H:%M')
        client_name = facture.client_name_override or (facture.client.name if facture.client else "Client de passage")
        
        invoice_details_text = f"""
        <b>N° Facture: {facture.numero_facture or facture.id}</b><br/>
        Date: {invoice_date}<br/>
        Client: {client_name}
        """
        if facture.client and facture.client.phone:
            invoice_details_text += f"<br/>Tel: {facture.client.phone}"
            
        doc_title = "FACTURE"
        if is_proforma:
            doc_title = "PROFORMA"
            if not facture.numero_facture:
                facture.numero_facture = f"PROFORMA-{facture.id}"

        layout = settings.header_layout
        
        style_doc_title = ParagraphStyle(
            'DocTitle', 
            parent=styles['Heading1'], 
            fontSize=24, 
            alignment=2 if layout in ['split', 'right'] else (0 if layout == 'left' else 1),
            textColor=HexColor(settings.primary_color),
            spaceAfter=12
        )
        
        doc_title_flowable = Paragraph(f"<b>{doc_title}</b>", style_doc_title)
        
        if layout == 'split':
            invoice_block = [
                doc_title_flowable,
                Paragraph(invoice_details_text, style_right)
            ]
            header_data = [[company_block, invoice_block]]
            header_table = Table(header_data, colWidths=[9*cm, 8*cm])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(header_table)
            
        elif layout == 'left':
            story.extend(company_block)
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_left))
            
        elif layout == 'center':
            style_company_center = ParagraphStyle('CompanyCenter', parent=style_company, alignment=1)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_center))
            story.append(Paragraph(company_address_fmt, style_center))
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_center))
            
        elif layout == 'right':
            style_company_right = ParagraphStyle('CompanyRight', parent=style_company, alignment=2)
            style_normal_right = ParagraphStyle('NormalRight', parent=style_normal, alignment=2)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_right))
            story.append(Paragraph(company_address_fmt, style_normal_right))
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_right))

        story.append(Spacer(1, 1.0*cm))
        
        table_header = [
            Paragraph('<b>Désignation</b>', style_normal),
            Paragraph('<b>Qté</b>', style_center),
            Paragraph('<b>P.U</b>', style_right),
            Paragraph('<b>Total</b>', style_right)
        ]
        data = [table_header]
        
        for item in facture.produits.all():
            total_line = item.quantity * item.selling_price
            row = [
                Paragraph(item.produit.name, style_normal),
                Paragraph(str(item.quantity), style_center),
                Paragraph(f"{item.selling_price:,.0f}", style_right),
                Paragraph(f"{total_line:,.0f}", style_right)
            ]
            data.append(row)
            
        table = Table(data, colWidths=[9*cm, 2.5*cm, 2.5*cm, 3*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor(settings.primary_color)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(table)
        story.append(Spacer(1, 1*cm))
        
        totals_data = [
            ['Sous-total :', f"{facture.total_ht:,.0f} F"],
            ['TVA :', f"{facture.total_tva:,.0f} F"],
            ['Remise :', f"{facture.remise:,.0f} F"],
            ['TOTAL À PAYER :', f"{facture.total_ttc:,.0f} F"]
        ]
        
        totals_table = Table(totals_data, colWidths=[4*cm, 4*cm])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('LINEABOVE', (0,-1), (-1,-1), 1, colors.black),
        ]))
        story.append(totals_table)
        
        doc.build(story, onFirstPage=lambda c, d: header_footer_facture(c, d, {
            'name': settings.company_name,
            'address': company_address_fmt.replace('<br/>', '\n'),
            'tel': 'N/A'
        }, {
            'facture_id': facture.numero_facture or f"#{facture.id}",
            'date_facture': invoice_date,
            'client_name': client_name,
            'client_address': facture.client.address if facture.client and facture.client.address else "",
            'client_phone': facture.client.phone if facture.client and facture.client.phone else ""
        }, facture))
        
        buffer.seek(0)
        return buffer

    @action(detail=True, methods=['get'])
    def imprimer_facture(self, request, pk=None):
        """
        Génère un PDF pour la facture.
        """
        facture = self.get_object()
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        is_proforma = request.query_params.get('type') == 'proforma' or facture.status == Facture.Status.PROFORMA
        
        buffer = self._generate_pdf(facture, settings, is_proforma)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"facture_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
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
            buffer = self._generate_pdf(facture, settings)
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
            logger.error(f"Erreur envoi WhatsApp: {str(e)}")
            return Response({'detail': f"Erreur lors de l'envoi : {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                        return Response({'detail': f'Format invalide pour date_debut'}, status=status.HTTP_400_BAD_REQUEST)
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
                        return Response({'detail': f'Format invalide pour date_fin'}, status=status.HTTP_400_BAD_REQUEST)
                end_datetime = timezone.make_aware(end_datetime)
            else:
                return Response({'detail': 'date_fin requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if start_datetime >= end_datetime:
                return Response({'detail': "La date de début doit être antérieure à la date de fin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'detail': f'Erreur date: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
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
