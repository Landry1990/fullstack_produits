from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db import transaction
from django.db.models import F, Sum, Q, Value, DecimalField, Avg, Count, ProtectedError
from django.db.models.functions import Coalesce, TruncMonth, TruncDay, Abs
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import HttpResponse
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation
import io
import logging
from django.core.cache import cache

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Frame, PageTemplate, BaseDocTemplate

from django.contrib.auth.models import User
from ..models import (
    Facture, FactureProduit, FactureProduitAllocation, Caisse, ClotureCaisse, 
    MouvementCaisse, Produit, StockLot, LoyaltySetting, InvoiceSettings, AuditLog,
    RelevePaiement, MouvementStock, Promis, Ordonnancier, LigneOrdonnancier,
    get_next_ticket_session
)
from ..services import PromotionService, SalesService
from ..serializers import (
    FactureSerializer, FactureProduitSerializer, CaisseSerializer, ClotureCaisseSerializer,
    CreanceSerializer, MouvementCaisseSerializer, FacturePrintSerializer
)
from ..serializers_optimized import FactureListSerializer, FactureDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..audit_helpers import log_audit
from ..sudo_utils import validate_sudo_mode
from ..whatsapp_service import WhatsAppService
from ..pagination import StandardResultsSetPagination

logger = logging.getLogger(__name__)
business_logger = logging.getLogger('api.business')

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
    # queryset = Facture.objects.select_related('client', 'ayant_droit').prefetch_related('produits', 'paiements').all().order_by('-date')
    
    def get_queryset(self):
        # Base optimization for all views: select related foreign keys
        queryset = Facture.objects.select_related('client', 'ayant_droit', 'created_by', 'validated_by').order_by('-date').distinct()
        
        # Add annotations for payments for the list view
        queryset = queryset.annotate(
            montant_regle=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0),
                output_field=DecimalField()
            ),
            montant_en_compte=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & Q(paiements__mode_paiement='en_compte')),
                Value(0),
                output_field=DecimalField()
            )
        )

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
        instance = self.get_object()
        
        facture_id = instance.id
        numero = instance.numero_facture
        montant = instance.total_ttc
        client_nom = instance.client.name if instance.client else 'Passager'
        status_initial = instance.status

        try:
            # 1. Si la facture est VALIDEE, PAYEE ou EN_COMPTE, on doit réintégrer le stock
            # avant de supprimer physiquement l'objet de la base.
            if status_initial in [Facture.Status.VALIDEE, Facture.Status.PAYEE, 'PAY', 'VAL', 'EN_COMPTE']:
                # On utilise SalesService pour remettre les produits en stock
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
        """
        facture = self.get_object()
        try:
            facture, old_total, difference = SalesService.modify_sale(facture, request.user, request.data)
            
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
            from ..serializers import ClientSerializer
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
        base_qs = self.get_queryset().filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
        
        if date_gte:
            base_qs = base_qs.filter(date__gte=date_gte)
        elif not date_lte:
            base_qs = base_qs.filter(date__date=today)
            
        if date_lte:
            base_qs = base_qs.filter(date__lte=date_lte)

        # Base filters for related models
        vendeur_qs = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
        produit_qs = FactureProduit.objects.filter(facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])

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

class FactureProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for facture produits."""
    queryset = FactureProduit.objects.select_related('produit', 'facture', 'stock_lot').order_by('-created_at')
    serializer_class = FactureProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit', 'facture']
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def envoi_rappel_renouvellement(self, request, pk=None):
        """
        Déclenche l'envoi d'un rappel de renouvellement WhatsApp.
        """
        line = self.get_object()
        if not line.produit or not line.produit.is_chronic:
            return Response({'detail': 'Ce produit n\'est pas marqué comme traitement chronique.'}, status=status.HTTP_400_BAD_REQUEST)
        
        success, message = WhatsAppService.send_renewal_reminder(line)
        if success:
            log_audit(
                user=request.user,
                action=AuditLog.Action.OTHER,
                model_name='FactureProduit',
                object_id=line.id,
                description=f"Rappel renouvellement envoyé pour {line.produit.name}",
                details={'facture': line.facture.id, 'client': line.facture.client_id},
                request=request
            )
            return Response({'detail': message})
        return Response({'detail': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for caisse (paiements)."""
    queryset = Caisse.objects.select_related(
        'facture', 'facture__client', 'user', 
        'facture__created_by', 'facture__validated_by'
    ).order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut', 'user']
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def perform_create(self, serializer):
        validation_user, error_res = validate_sudo_mode(self.request)
        # On ne bloque pas si erreur ici car perform_create est déjà appelé
        user = validation_user if not error_res else self.request.user
        
        # SÉCURITÉ : Plafonner le montant au reste à payer réel (part patient)
        facture = serializer.validated_data.get('facture')
        mode = serializer.validated_data.get('mode_paiement')
        
        if facture and mode != 'en_compte' and mode != 'recouvrement':
            montant_saisi = serializer.validated_data.get('montant')
            # Déjà payé physiquement
            deja_paye = Caisse.objects.filter(
                facture=facture, 
                statut='completee'
            ).exclude(
                mode_paiement__in=['en_compte', 'recouvrement']
            ).aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            
            # Montant dû (part client si tiers payant, sinon total TTC)
            montant_du = facture.part_client if (facture.part_client is not None and facture.part_client >= 0) else facture.total_ttc
            
            if montant_du >= 0:
                reste = max(Decimal('0'), montant_du - deja_paye)
                if montant_saisi > reste:
                    serializer.validated_data['montant'] = reste
            else:
                reste = min(Decimal('0'), montant_du - deja_paye)
                if montant_saisi < reste:
                    serializer.validated_data['montant'] = reste

        serializer.save(user=user)
        
        # Mise à jour du statut de la facture si tout est payé
        instance = serializer.instance
        if instance.facture:
            facture = instance.facture
            total_paye = Caisse.objects.filter(facture=facture, statut='completee').aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            
            # Utiliser une petite marge pour les arrondis
            if total_paye >= (facture.total_ttc - Decimal('0.1')):
                 if facture.status != Facture.Status.PAYEE:
                     facture.status = Facture.Status.PAYEE
                     facture.save()

    @action(detail=False, methods=['get'], url_path='get_totals')
    def get_totals(self, request):
        """
        Retourne les totaux.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        user_id = request.query_params.get('user_id')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                # Support both ISO format with T and simple date space time
                clean_date = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                
                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except ValueError as e:
                logger.error(f"Error parsing date_debut {date_debut}: {e}")
                pass
                
        if date_fin:
            try:
                clean_date = date_fin.replace('T', ' ').replace('Z', '')
                try: 
                    # Try full timestamp first
                    end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        # Try without seconds
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                    except ValueError:
                         # Try date only -> end of day
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d')
                        end_date = end_date.replace(hour=23, minute=59, second=59)

                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except ValueError as e:
                logger.error(f"Error parsing date_fin {date_fin}: {e}")
                pass

        if not start_date:
            from ..models import ClotureCaisse # Lazy import to avoid circular dependency if any
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        # Initialiser le queryset des transactions de caisse
        transactions = Caisse.objects.filter(statut='completee')
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
        if user_id:
            transactions = transactions.filter(user_id=user_id)

        # SEPARATION: Ventes vs Recouvrement
        # Désormais basé sur le mode_paiement spécial
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(reference__icontains='[RECOUV]')
        
        paiements_recouvrement = transactions.filter(recouvrement_q)
        paiements_sales = transactions.exclude(recouvrement_q).exclude(mode_paiement='en_compte')

        # Calculer les montants séparés
        montant_recouvrement = paiements_recouvrement.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # IMPORTANT: Le total théorique de CAISSE PHYSIQUE ne concerne QUE les espèces opérationnelles
        total_ventes_especes = paiements_sales.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Pour les détails par mode, on ne garde QUE les ventes opérationnelles (exclut les recouvrements)
        modes = paiements_sales.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}

        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
            
        if user_id:
            mouvements = mouvements.filter(user_id=user_id)
            
        moves_aggregated = mouvements.aggregate(
            entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
            sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField()))
        )
        # On n'ajoute PLUS le recouvrement aux entrées opérationnelles
        total_entrees = moves_aggregated['entrees']
        total_sorties = moves_aggregated['sorties']
        
        # Le total théorique de CAISSE PHYSIQUE concerne les espèces opérationnelles
        total_coupons = transactions.filter(mode_paiement='coupon').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_theorique = total_ventes_especes + total_entrees - total_sorties
        
        # Auditing for preview
        mouvements_list = []
        for m in mouvements.select_related('user'):
            mouvements_list.append({
                'type': m.type,
                'montant': float(m.montant),
                'motif': m.motif,
                'user_nom': m.user.get_full_name() or m.user.username if m.user else "Inconnu",
                'date': m.date.isoformat()
            })
        
        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'total_theorique': total_theorique,
            'total_ventes': total_ventes,
            'total_entrees': total_entrees,
            'total_sorties': total_sorties,
            'total_coupons': total_coupons,
            'details': details,
            'mouvements_audit': mouvements_list
        })

    @action(detail=False, methods=['get'], url_path='page_init')
    def page_init(self, request):
        """
        Unified endpoint for Journal de Caisse initial load.
        Returns transactions (paginated), mouvements, totals, and operators in one request.
        """
        from django.contrib.auth.models import User as AuthUser

        # 1. Transactions (paginated) - reuse list logic
        transactions_response = self.list(request)

        # 2. Mouvements (filtered by user + dates)
        user_id = request.query_params.get('user')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        mouvements_qs = MouvementCaisse.objects.select_related('user').all().order_by('-date')
        if user_id:
            mouvements_qs = mouvements_qs.filter(user_id=user_id)
        if date_debut:
            try:
                clean = date_debut.replace('T', ' ').replace('Z', '')
                start_dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                mouvements_qs = mouvements_qs.filter(date__gte=start_dt)
            except ValueError:
                pass
        if date_fin:
            try:
                clean = date_fin.replace('T', ' ').replace('Z', '')
                end_dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                mouvements_qs = mouvements_qs.filter(date__lte=end_dt)
            except ValueError:
                pass
        mouvements_data = MouvementCaisseSerializer(mouvements_qs, many=True).data

        # 3. Totals - reuse get_totals logic
        totals_response = self.get_totals(request)

        # 4. Users (operators)
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
            'transactions': transactions_response.data,
            'mouvements': mouvements_data,
            'totals': totals_response.data,
            'users': users_data,
        })

    @action(detail=False, methods=['get'])
    def get_user_shift(self, request):
        """
        Detects the active shift period for a user.
        Returns first and last activity (transaction or movement).
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=400)
            
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 1. Last closure for this user
        last_cloture = ClotureCaisse.objects.filter(user_id=user_id).order_by('-date').first()
        search_from = last_cloture.date if last_cloture else today_start
        
        # Ensure search_from is at least today_start to avoid picking old shifts unless forced
        if search_from < today_start:
            search_from = today_start

        # 2. Find first and last activity
        txs = Caisse.objects.filter(user_id=user_id, date_paiement__gte=search_from).order_by('date_paiement')
        mvs = MouvementCaisse.objects.filter(user_id=user_id, date__gte=search_from).order_by('date')
        
        first_dates = []
        last_dates = []
        
        if txs.exists():
            first_dates.append(txs.first().date_paiement)
            last_dates.append(txs.last().date_paiement)
        if mvs.exists():
            first_dates.append(mvs.first().date)
            last_dates.append(mvs.last().date)
            
        if not first_dates:
            return Response({
                'user_id': user_id,
                'start_date': None,
                'end_date': None,
                'has_activity': False
            })
            
        start_date = min(first_dates)
        end_date = max(last_dates)
        
        # If the shift just started (only 1 activity), pad end_date by 5 mins or use now
        if start_date == end_date:
            end_date = now

        return Response({
            'user_id': user_id,
            'start_date': start_date,
            'end_date': end_date,
            'has_activity': True
        })

    @action(detail=False, methods=['post'], url_path='cloturer')
    @transaction.atomic
    def cloturer(self, request):
        """
        Effectue la clôture de caisse.
        """
        montant_reel = request.data.get('montant_reel')
        if montant_reel is None:
            return Response({'detail': 'Le montant réel est requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            montant_reel = Decimal(str(montant_reel))
        except (ValueError, TypeError, InvalidOperation):
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        user_id = request.data.get('user_id')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                clean_date = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')

                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except ValueError as e:
                 logger.error(f"Error parsing date_debut {date_debut}: {e}")
                 pass
                
        if date_fin:
            try:
                clean_date = date_fin.replace('T', ' ').replace('Z', '')
                try:
                    end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                    except ValueError:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d')
                        end_date = end_date.replace(hour=23, minute=59, second=59)

                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except ValueError as e:
                logger.error(f"Error parsing date_fin {date_fin}: {e}")
                pass

        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        if not user_id:
            return Response(
                {'detail': 'Veuillez sélectionner un caissier spécifique pour clôturer.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Caissier introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        transactions = transactions.filter(user_id=user_id)
            
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        # SEPARATION: Ventes vs Recouvrement (Hybride: nouveau mode + anciens marqueurs)
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(facture__client__client_type='PROFESSIONNEL') | Q(reference__icontains='[RECOUV]')
        
        paiements_recouvrement = transactions.filter(recouvrement_q)
        paiements_sales = transactions.exclude(recouvrement_q)

        # Calculer les montants séparés
        montant_recouvrement = paiements_recouvrement.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Détails par mode : UNIQUEMENT les ventes opérationnelles
        modes = paiements_sales.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        
        # Entrées : Uniquement les mouvements de flux (ENTREE), pas de recouvrement
        entrees_mouvements = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_entrees = entrees_mouvements
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # Espèces : Uniquement les ventes opérationnelles, exclut les recouvrements (user request)
        total_ventes_especes = paiements_sales.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0:
             return Response({
                 'detail': 'Impossible de clôturer : aucun mouvement (vente, entrée ou sortie) détecté depuis la dernière clôture.'
             }, status=status.HTTP_400_BAD_REQUEST)

        total_theorique = total_ventes_especes + total_entrees - total_sorties
        ecart = montant_reel - total_theorique
        
        details['__meta__'] = {
            'total_ventes': float(total_ventes),
            'total_ventes_especes': float(total_ventes_especes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties)
        }
        
        # Auditing: Save movements list in details
        mouvements_list = []
        for m in mouvements.select_related('user'):
            mouvements_list.append({
                'type': m.type,
                'montant': float(m.montant),
                'motif': m.motif,
                'user_nom': m.user.get_full_name() or m.user.username if m.user else "Inconnu",
                'date': m.date.isoformat()
            })
        details['mouvements_audit'] = mouvements_list
        
        cloture = ClotureCaisse.objects.create(
            montant_reel=montant_reel,
            montant_theorique=total_theorique,
            ecart_caisse=ecart,
            total_ventes=total_ventes,
            total_entrees=total_entrees,
            total_sorties=total_sorties,
            details_paiement=details,
            date_debut=start_date,
            date_fin=end_date,
            user=target_user,
            cloture_par=request.user if request.user.is_authenticated else None
        )
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.CLOTURE_CAISSE,
            model_name='ClotureCaisse',
            object_id=cloture.id,
            description=f"Clôture de caisse: Théorique={total_theorique:.0f}F, Réel={montant_reel:.0f}F, Écart={ecart:+.0f}F",
            details={
                'theorique': float(total_theorique),
                'reel': float(montant_reel),
                'ecart': float(ecart),
                'ventes': float(total_ventes),
                'entrees': float(total_entrees),
                'sorties': float(total_sorties)
            },
            request=request
        )
        
        return Response({
            'status': 'success',
            'cloture_id': cloture.id,
            'montant_reel': float(montant_reel),
            'montant_theorique': float(total_theorique),
            'ecart': float(ecart),
            'total_ventes': float(total_ventes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties),
            'details': details
        })


class ClotureCaisseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet en lecture seule pour consulter l'historique des clôtures de caisse.
    """
    serializer_class = ClotureCaisseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        queryset = ClotureCaisse.objects.select_related('user').order_by('-date')
        
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        if date_debut:
            queryset = queryset.filter(date__date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__date__lte=date_fin)
        
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Pagination parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 31))
        
        total_count = queryset.count()
        
        # Global totals for the period
        totals_agg = queryset.aggregate(
            total_theorique=Sum('montant_theorique'),
            total_reel=Sum('montant_reel'),
            total_ecart=Sum('ecart_caisse')
        )
        
        global_totals = {
            'montant_theorique': float(totals_agg['total_theorique'] or 0),
            'montant_reel': float(totals_agg['total_reel'] or 0),
            'ecart_caisse': float(totals_agg['total_ecart'] or 0)
        }
        
        # Slice for current page
        start = (page - 1) * page_size
        end = start + page_size
        paginated_queryset = queryset[start:end]
        
        serializer = self.get_serializer(paginated_queryset, many=True)
        
        return Response({
            'count': total_count,
            'results': serializer.data,
            'totals': global_totals
        })

    @action(detail=False, methods=['get'])
    def performances_caissiers(self, request):
        """
        Calcule les performances des caissiers sur une période donnée (mois/année).
        Basé sur l'historique des clôtures (ClotureCaisse).
        """
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        
        # Par défaut, mois et année actuels
        now = timezone.now()
        if not month:
            month = now.month
        if not year:
            year = now.year
            
        try:
            month = int(month)
            year = int(year)
        except (ValueError, TypeError):
            return Response({'detail': 'Paramètres mois ou année invalides.'}, status=status.HTTP_400_BAD_REQUEST)

        # On regroupe par utilisateur et on calcule la moyenne des écarts absolus pour une comparaison équitable
        performances = ClotureCaisse.objects.filter(
            date__month=month,
            date__year=year
        ).values(
            'user__id', 'user__username', 'user__first_name', 'user__last_name'
        ).annotate(
            total_ecart_absolu=Sum(Abs('ecart_caisse')),
            total_ecart_algebrique=Sum('ecart_caisse'),
            nombre_clotures=Count('id'),
            total_theorique=Sum('montant_theorique'),
            total_reel=Sum('montant_reel'),
            total_ventes=Sum('total_ventes')
        ).filter(user__isnull=False)
        
        results = []
        for p in performances:
            # Construction du nom complet
            first_name = p['user__first_name'] or ""
            last_name = p['user__last_name'] or ""
            full_name = f"{first_name} {last_name}".strip() or p['user__username']
            
            total_abs = float(p['total_ecart_absolu'] or 0)
            total_alg = float(p['total_ecart_algebrique'] or 0)
            nombre = p['nombre_clotures']
            
            moyenne_abs = total_abs / nombre if nombre > 0 else 0
            moyenne_alg = total_alg / nombre if nombre > 0 else 0
            
            results.append({
                'user_id': p['user__id'],
                'username': p['user__username'],
                'full_name': full_name,
                'moyenne_ecart_absolu': round(moyenne_abs, 2),
                'moyenne_ecart_algebrique': round(moyenne_alg, 2),
                'total_ecart_absolu': total_abs,
                'total_ecart_algebrique': total_alg,
                'nombre_clotures': nombre,
                'total_theorique': float(p['total_theorique'] or 0),
                'total_reel': float(p['total_reel'] or 0),
                'total_ventes': float(p['total_ventes'] or 0),
            })
            
        # Tri par moyenne d'écart absolue (la plus petite gagne)
        results.sort(key=lambda x: x['moyenne_ecart_absolu'])
            
        return Response(results)


class CreanceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour la gestion des créances (ventes en compte).
    """
    serializer_class = CreanceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        """
        Retourne les factures validées avec paiement 'en_compte'.
        Permet de filtrer par client et par période.
        """
        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce

        history = self.request.query_params.get('history', 'false').lower() == 'true'

        queryset = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            remainder=F('total_ttc') - F('paid_amount')
        )
        
        if history:
            # Mode Histoire : montre les dettes EPOREES (solde <= 0) 
            # MAIS on doit s'assurer que c'étaient bien des créances à l'origine
            # (existence d'au moins un paiement 'en_compte')
            queryset = queryset.filter(
                remainder__lte=0,
                paiements__mode_paiement='en_compte'
            )
        else:
            # Mode En cours : montre les dettes ACTIVES (solde > 0)
            queryset = queryset.filter(remainder__gt=0)

        queryset = queryset.distinct().select_related(
            'client', 'ayant_droit'
        ).prefetch_related('paiements').order_by('-date')
        
        # Filtrer par client si spécifié
        client_id = self.request.query_params.get('client_id', None)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        
        # Filtrer par période si spécifiée
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        
        if date_debut:
            try:
                start_date = datetime.strptime(date_debut, '%Y-%m-%d')
                start_date = timezone.make_aware(start_date)
                queryset = queryset.filter(date__gte=start_date)
            except ValueError:
                pass
        
        if date_fin:
            try:
                end_date = datetime.strptime(date_fin, '%Y-%m-%d') + timedelta(days=1)
                end_date = timezone.make_aware(end_date)
                queryset = queryset.filter(date__lt=end_date)
            except ValueError:
                pass
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def totals(self, request):
        """
        Returns aggregated totals for créances.
        This is the SINGLE SOURCE OF TRUTH for créances totals.
        Used by Dashboard and rapport_mensuel.
        """
        queryset = self.get_queryset()
        
        total_creances = Decimal('0')
        count = 0
        for f in queryset:
            # Calculate remainder using same logic as queryset annotation
            paye = f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            reste = f.total_ttc - paye
            if reste > 0:
                total_creances += reste
                count += 1
        
        return Response({
            'total': total_creances,
            'count': count
        })
    
    @action(detail=True, methods=['get'])
    def imprimer_recu(self, request, pk=None):
        """
        Génère un reçu de paiement pour une créance.
        """
        facture = self.get_object()
        paiement_id = request.query_params.get('paiement_id')
        
        paiement = None
        if paiement_id:
            try:
                paiement = Caisse.objects.get(id=paiement_id, facture=facture)
            except Caisse.DoesNotExist:
                return Response({'detail': 'Paiement non trouvé.'}, status=404)
        else:
            # Par défaut, on prend le dernier paiement complété qui n'est pas 'en_compte'
            paiement = facture.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').order_by('-date_paiement').first()

        if not paiement:
            return Response({'detail': 'Aucun paiement trouvé pour cette facture.'}, status=400)

        # Récupérer les paramètres de l'entreprise
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"recu_{paiement.id}_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        styles = getSampleStyleSheet()
        
        style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=14, spaceAfter=4, textColor=HexColor(settings.primary_color))
        style_normal = styles['Normal']
        style_title = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20, textColor=HexColor(settings.primary_color))
        style_label = ParagraphStyle('Label', parent=styles['Normal'], fontName='Helvetica-Bold')
        style_right = ParagraphStyle('Right', parent=styles['Normal'], alignment=2)
        
        # En-tête
        story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company))
        address = settings.company_address or ""
        story.append(Paragraph(address.replace('\n', '<br/>'), style_normal))
        story.append(Spacer(1, 1*cm))
        
        story.append(Paragraph("REÇU DE PAIEMENT", style_title))
        
        # Infos Client et Facture
        client_name = facture.client_name_override or (facture.client.name if facture.client else "Client")
        date_paiement = paiement.date_paiement.strftime('%d/%m/%Y à %H:%M')
        ayant_droit = facture.ayant_droit.nom if hasattr(facture, 'ayant_droit') and facture.ayant_droit else None
        
        info_data = [
            [Paragraph("<b>Client :</b>", style_normal), Paragraph(client_name, style_normal)],
        ]
        
        if ayant_droit:
            info_data.append([Paragraph("<b>Bénéficiaire :</b>", style_normal), Paragraph(ayant_droit, style_normal)])
            
        info_data.extend([
            [Paragraph("<b>Facture N° :</b>", style_normal), Paragraph(facture.numero_facture or str(facture.id), style_normal)],
            [Paragraph("<b>Date du paiement :</b>", style_normal), Paragraph(date_paiement, style_normal)],
            [Paragraph("<b>Mode de règlement :</b>", style_normal), Paragraph(paiement.get_mode_paiement_display(), style_normal)],
        ])
        
        info_table = Table(info_data, colWidths=[4*cm, 10*cm])
        info_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 1*cm))
        
        # Montants
        total_paye_avant = facture.paiements.filter(
            statut='completee',
            date_paiement__lt=paiement.date_paiement
        ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        reste_avant = facture.total_ttc - total_paye_avant
        reste_apres = reste_avant - paiement.montant
        
        amount_data = [
            [Paragraph("Dette avant paiement", style_normal), f"{reste_avant:,.0f} F"],
            [Paragraph("<b>MONTANT PAYÉ CE JOUR</b>", style_label), Paragraph(f"<b>{paiement.montant:,.0f} F</b>", style_label)],
            [Paragraph("RESTE À PAYER", style_label), f"{reste_apres:,.0f} F"],
        ]
        
        amount_table = Table(amount_data, colWidths=[10*cm, 4*cm])
        amount_table.setStyle(TableStyle([
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('LINEABOVE', (0,1), (-1,1), 1, colors.black),
            ('LINEBELOW', (0,1), (-1,1), 1, colors.black),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('BACKGROUND', (0,1), (-1,1), colors.whitesmoke),
        ]))
        story.append(amount_table)
        
        story.append(Spacer(1, 2*cm))
        story.append(Paragraph("Merci de votre confiance.", ParagraphStyle('Thanks', parent=style_normal, alignment=1, italic=True)))
        
        doc.build(story)
        
        buffer.seek(0)
        response.write(buffer.getvalue())
        return response

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def ajouter_paiement(self, request, pk=None):
        """
        Ajoute un paiement partiel à une créance.
        Body: {
            'mode_paiement': 'especes|om|momo|cheque|carte|virement',
            'montant': 10000,
            'reference': 'REF123' (optionnel)
        }
        """
        facture = self.get_object()
        
        # Vérifier que la facture est bien une créance
        if not facture.paiements.filter(mode_paiement='en_compte').exists():
            return Response(
                {'detail': 'Cette facture n\'est pas une créance (pas de paiement en compte).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation par mot de passe (Sudo) - Nécessite le droit d'encaisser (Superviseur/Caissier Senior)
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_cash_out')
        if error_response:
            return error_response

        # Récupérer les données du paiement
        mode_paiement = request.data.get('mode_paiement')
        montant = request.data.get('montant')
        reference_base = request.data.get('reference', '')
        
        # Désormais on forcer le mode 'recouvrement' pour isolation comptable
        # On garde le mode réel dans la référence pour information
        reference = f"{reference_base} [{mode_paiement.upper()}] [RECOUV]".strip()
        mode_paiement = 'recouvrement'
        
        # Validation
        if not mode_paiement or not montant:
            return Response(
                {'detail': 'Les champs mode_paiement et montant sont requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            montant = Decimal(str(montant))
        except (ValueError, TypeError):
            return Response(
                {'detail': 'Le montant doit être un nombre valide.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculer le reste à payer
        montant_paye = facture.paiements.filter(
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        reste_a_payer = facture.total_ttc - montant_paye
        
        # Vérifier que le montant ne dépasse pas le reste à payer
        if montant > reste_a_payer:
            return Response(
                {
                    'detail': f'Le montant du paiement ({montant}) dépasse le reste à payer ({reste_a_payer}).',
                    'reste_a_payer': str(reste_a_payer)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Créer le paiement
        paiement = Caisse.objects.create(
            facture=facture,
            mode_paiement=mode_paiement,
            montant=montant,
            reference=reference,
            statut='completee',
            user=validation_user
        )
        
        # Rafraîchir la facture pour obtenir les données à jour
        facture.refresh_from_db()
        
        # Sérialiser et retourner
        serializer = self.get_serializer(facture)
        return Response({
            'detail': 'Paiement enregistré avec succès.',
            'paiement_id': paiement.id,
            'creance': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def releve(self, request):
        """
        Génère un relevé de créances pour un client sur une période.
        """
        client_id = request.query_params.get('client_id')
        
        if not client_id:
            return Response(
                {'detail': 'Le paramètre client_id est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.db.models import OuterRef, Subquery, Sum, DecimalField, Value
        from django.db.models.functions import Coalesce
        from ..models import Caisse
        
        paid_subquery = Caisse.objects.filter(
            facture=OuterRef('pk'),
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture').annotate(
            total=Sum('montant')
        ).values('total')[:1]

        # Récupérer les créances du client
        queryset = self.get_queryset().filter(client_id=client_id).annotate(
            montant_paye_annotated=Coalesce(
                Subquery(paid_subquery),
                Value(0, output_field=DecimalField())
            )
        )
        
        # Calculer les totaux
        total_factures = Decimal('0.00')
        total_paye = Decimal('0.00')
        total_reste = Decimal('0.00')
        
        creances_data = []
        for facture in queryset:
            montant_paye = getattr(facture, 'montant_paye_annotated', Decimal('0.00'))
            reste = facture.total_ttc - montant_paye
            
            total_factures += facture.total_ttc
            total_paye += montant_paye
            total_reste += reste
            
            creances_data.append({
                'numero_facture': facture.numero_facture,
                'date': facture.date,
                'montant_total': facture.total_ttc,
                'montant_paye': montant_paye,
                'reste_a_payer': reste,
                'ayant_droit': facture.ayant_droit.nom if facture.ayant_droit else None
            })
        
        from ..models import Client
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
             return Response({'detail': 'Client non trouvé'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'client': {
                'id': client.id,
                'name': client.name,
                'address': client.address,
                'phone': client.phone,
                'email': client.email
            },
            'periode': {
                'date_debut': request.query_params.get('date_debut'),
                'date_fin': request.query_params.get('date_fin')
            },
            'creances': creances_data,
            'totaux': {
                'total_factures': str(total_factures),
                'total_paye': str(total_paye),
                'total_reste': str(total_reste)
            }
        })


    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_paiement(self, request):
        """
        Pay list of invoices in bulk.
        Body: {
            'facture_ids': [1, 2, 3],
            'mode_paiement': 'especes',
            'reference': 'REF123'
        }
        """
        # Validation par mot de passe (Sudo)
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_view_dashboard')
        if error_response:
            return error_response

        facture_ids = request.data.get('facture_ids', [])
        mode_paiement = request.data.get('mode_paiement')
        reference_base = request.data.get('reference', '')
        
        # Marquer comme recouvrement et forcer le mode technique
        reference = f"{reference_base} [{mode_paiement.upper()}] [RECOUV]".strip()
        mode_paiement = 'recouvrement'

        if not facture_ids or not isinstance(facture_ids, list):
             return Response(
                {'detail': 'facture_ids must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not mode_paiement:
            return Response(
                {'detail': 'mode_paiement is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from django.db.models import OuterRef, Subquery, Sum, DecimalField, Value
        from django.db.models.functions import Coalesce
        from ..models import Caisse
        
        paid_subquery = Caisse.objects.filter(
            facture=OuterRef('pk'),
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture').annotate(
            total=Sum('montant')
        ).values('total')[:1]

        factures = Facture.objects.filter(id__in=facture_ids).annotate(
            montant_paye_annotated=Coalesce(
                Subquery(paid_subquery),
                Value(0, output_field=DecimalField())
            )
        )
        
        if not factures.exists():
             return Response(
                {'detail': 'No invoices found.'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        client_ids = factures.values_list('client', flat=True).distinct()
        if len(client_ids) > 1:
             return Response(
                {'detail': 'All invoices must belong to the same client.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = factures.first().client
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        releve_ref = f"REL-{timestamp}-{client.id}"
        
        releve = RelevePaiement.objects.create(
            client=client,
            generated_by=request.user if request.user.is_authenticated else None,
            total_amount=Decimal('0.00'),
            reference=releve_ref
        )

        total_paid_bulk = Decimal('0.00')
        count_processed = 0

        for facture in factures:
            montant_paye = getattr(facture, 'montant_paye_annotated', Decimal('0.00'))
            reste = facture.total_ttc - montant_paye

            if reste <= 0:
                continue

            Caisse.objects.create(
                facture=facture,
                mode_paiement=mode_paiement,
                montant=reste,
                reference=reference,
                statut='completee',
                user=validation_user,
                releve=releve
            )
            total_paid_bulk += reste
            count_processed += 1
            
        releve.total_amount = total_paid_bulk
        releve.save()

        return Response({
            'detail': f'Règlement groupé effectué avec succès. {count_processed} factures traitées.',
            'releve_id': releve.id,
            'releve_reference': releve.reference,
            'total_amount': str(total_paid_bulk)
        })


    @action(detail=False, methods=['get'])
    def imprimer_releve_paiement(self, request):
        """
        Génère un PDF pour un relevé de paiement groupé (RelevePaiement).
        """
        releve_id = request.query_params.get('releve_id')
        if not releve_id:
            return Response({'detail': 'releve_id est requis.'}, status=400)
            
        try:
            releve = RelevePaiement.objects.select_related('client').get(id=releve_id)
        except RelevePaiement.DoesNotExist:
            return Response({'detail': 'Relevé non trouvé.'}, status=404)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération du relevé {releve_id}: {str(e)}")
            return Response({'detail': f'Erreur lors de la récupération du relevé: {str(e)}'}, status=500)
        
        try:
            # Récupérer les paramètres de l'entreprise
            settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
            
            response = HttpResponse(content_type='application/pdf')
            filename = f"recapitulatif_reglement_{releve.reference}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
            story = []
            styles = getSampleStyleSheet()
            
            # Gestion des couleurs par défaut si primary_color est invalide
            try:
                primary_color = HexColor(settings.primary_color) if settings.primary_color else colors.HexColor('#000000')
            except:
                primary_color = colors.HexColor('#000000')
            
            style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=14, spaceAfter=4, textColor=primary_color)
            style_normal = styles['Normal']
            style_title = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20, textColor=primary_color)
            style_label = ParagraphStyle('Label', parent=styles['Normal'], fontName='Helvetica-Bold')
            
            # En-tête
            company_name = settings.company_name or "Entreprise"
            story.append(Paragraph(f"<b>{company_name}</b>", style_company))
            address = settings.company_address or ""
            if address:
                story.append(Paragraph(address.replace('\n', '<br/>'), style_normal))
            story.append(Spacer(1, 1*cm))
            
            story.append(Paragraph("RÉCAPITULATIF DE RÈGLEMENT", style_title))
            
            # Infos Relevé
            date_releve = releve.created_at.strftime('%d/%m/%Y à %H:%M') if releve.created_at else datetime.now().strftime('%d/%m/%Y à %H:%M')
            client_name = releve.client.name if releve.client else "Client inconnu"
            releve_ref = releve.reference or f"REL-{releve.id}"
            
            info_data = [
                [Paragraph("<b>Client :</b>", style_normal), Paragraph(client_name, style_normal)],
                [Paragraph("<b>Référence Relevé :</b>", style_normal), Paragraph(releve_ref, style_normal)],
                [Paragraph("<b>Date :</b>", style_normal), Paragraph(date_releve, style_normal)],
            ]
            
            info_table = Table(info_data, colWidths=[5*cm, 9*cm])
            info_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(info_table)
            story.append(Spacer(1, 0.5*cm))
            
            # Tableau des factures réglées
            table_data = [['N° Facture', 'Date Facture', 'Bénéficiaire', 'Montant TTC', 'Réglé']]
            
            paiements = releve.paiements_caisse.all().select_related('facture', 'facture__ayant_droit')
            
            if not paiements.exists():
                story.append(Paragraph("<i>Aucun paiement trouvé pour ce relevé.</i>", style_normal))
            else:
                for p in paiements:
                    try:
                        f = p.facture
                        if not f:
                            continue
                            
                        # Gestion sécurisée de l'ayant droit
                        ayant_droit = "-"
                        if f.ayant_droit:
                            ayant_droit = f.ayant_droit.nom or "-"
                        
                        # Formatage sécurisé des montants
                        montant_ttc = float(f.total_ttc) if f.total_ttc else 0.0
                        montant_regle = float(p.montant) if p.montant else 0.0
                        
                        numero_facture = f.numero_facture or str(f.id)
                        date_facture = f.date.strftime('%d/%m/%Y') if f.date else "-"
                        
                        table_data.append([
                            numero_facture,
                            date_facture,
                            ayant_droit,
                            f"{montant_ttc:,.0f} F",
                            f"{montant_regle:,.0f} F"
                        ])
                    except Exception as e:
                        logger.error(f"Erreur lors du traitement du paiement {p.id}: {str(e)}")
                        continue
                
                if len(table_data) > 1:  # Si on a au moins une ligne de données (en plus de l'en-tête)
                    story.append(Spacer(1, 0.5*cm))
                    
                    t = Table(table_data, colWidths=[3.5*cm, 2.5*cm, 4*cm, 2*cm, 2*cm])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('ALIGN', (3, 1), (4, -1), 'RIGHT'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ]))
                    story.append(t)
            
            # Total global
            story.append(Spacer(1, 1*cm))
            total_amount = float(releve.total_amount) if releve.total_amount else 0.0
            total_data = [
                ["", "", Paragraph("<b>TOTAL RÈGLEMENT :</b>", style_label), Paragraph(f"<b>{total_amount:,.0f} F</b>", style_label)]
            ]
            total_table = Table(total_data, colWidths=[3.5*cm, 2.5*cm, 4*cm, 4*cm])
            total_table.setStyle(TableStyle([
                ('ALIGN', (3, 0), (3, 0), 'RIGHT'),
            ]))
            story.append(total_table)
            
            story.append(Spacer(1, 2*cm))
            story.append(Paragraph("Merci de votre confiance.", ParagraphStyle('Thanks', parent=style_normal, alignment=1, italic=True)))
            
            doc.build(story)
            
            buffer.seek(0)
            response.write(buffer.getvalue())
            return response
            
        except Exception as e:
            logger.error(f"Erreur lors de la génération du PDF du relevé {releve_id}: {str(e)}", exc_info=True)
            return Response({
                'detail': f'Erreur lors de la génération du PDF: {str(e)}'
            }, status=500)


    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    def vider(self, request):
        """
        Supprime tout le contenu de la facture.
        """
        facture_id = request.data.get('facture')
        if not facture_id:
             return Response({'detail': 'ID facture requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        FactureProduit.objects.filter(facture_id=facture_id).delete()
        
        # Mettre à jour les totaux de la facture
        try:
            facture = Facture.objects.get(id=facture_id)
            facture.calculate_totals()
            facture.save()
        except Facture.DoesNotExist:
            pass

        return Response({'detail': 'Contenu de la facture vidé.'})





class MouvementCaisseViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing cash register movements (entries and exits).
    """
    queryset = MouvementCaisse.objects.select_related('user').all().order_by('-date')
    serializer_class = MouvementCaisseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'user']
    search_fields = ['motif', 'description']
    ordering_fields = ['date', 'montant']
    ordering = ['-date']
    
    def perform_create(self, serializer):
        """Automatically set the user to the currently authenticated user and audit."""
        mouvement = serializer.save(user=self.request.user)
        
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.OTHER,
            model_name='MouvementCaisse',
            object_id=mouvement.id,
            description=f"Mouvement caisse ({mouvement.type}): {mouvement.montant:.0f}F - {mouvement.motif}",
            details={
                'type': mouvement.type,
                'montant': float(mouvement.montant),
                'motif': mouvement.motif,
                'description': mouvement.description
            },
            request=self.request
        )

    def perform_update(self, serializer):
        mouvement = serializer.instance
        old_montant = mouvement.montant
        serializer.save()
        
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='MouvementCaisse',
            object_id=mouvement.id,
            description=f"Modification mouvement caisse #{mouvement.id}",
            details={
                'old_montant': float(old_montant),
                'new_montant': float(mouvement.montant),
                'motif': mouvement.motif
            },
            request=self.request
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        mvmt_id = instance.id
        mvmt_info = f"{instance.type} {instance.montant}F ({instance.motif})"
        
        response = super().destroy(request, *args, **kwargs)
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='MouvementCaisse',
            object_id=mvmt_id,
            description=f"Suppression mouvement caisse: {mvmt_info}",
            details={'info': mvmt_info},
            request=request
        )
        return response


