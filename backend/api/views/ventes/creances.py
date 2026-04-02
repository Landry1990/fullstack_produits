from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum, Count, F, Q, Value, DecimalField
from rest_framework.permissions import IsAdminUser
from django.utils import timezone
from django.http import HttpResponse
from datetime import datetime, timedelta
from decimal import Decimal
import io
import logging

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

from ...models import (
    Facture, FactureProduit, Caisse, InvoiceSettings, AuditLog,
    RelevePaiement
)
from ...serializers import CreanceSerializer
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode
from ...pagination import StandardResultsSetPagination

logger = logging.getLogger(__name__)


class CreanceViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint pour la gestion des créances (ventes en compte)."""
    serializer_class = CreanceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
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
            queryset = queryset.filter(remainder__lte=0, paiements__mode_paiement='en_compte')
        else:
            queryset = queryset.filter(remainder__gt=0)

        queryset = queryset.distinct().select_related('client', 'ayant_droit').prefetch_related('paiements').order_by('-date')
        
        client_id = self.request.query_params.get('client_id', None)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        
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
        queryset = self.get_queryset()
        
        # Optimization: Use aggregate to get the total in one SQL query
        # Since get_queryset already annotates 'remainder', we can just sum it up.
        result = queryset.aggregate(
            total_reste=Sum('remainder'),
            count=Count('id')
        )
        
        return Response({
            'total_reste': result['total_reste'] or Decimal('0'),
            'count': result['count'] or 0
        })
    
    @action(detail=False, methods=['get'])
    def synthese_clients(self, request):
        from django.db.models import Sum, F, Q, Value, DecimalField, Count, OuterRef, Subquery
        from django.db.models.functions import Coalesce

        # 1. Subquery to sum payments for an invoice without join duplication
        paid_subquery = Caisse.objects.filter(
            facture=OuterRef('pk'), 
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture').annotate(
            total=Sum('montant')
        ).values('total')[:1]

        # 2. Base Queryset for Invoices
        # Each invoice is annotated with its own remainder
        queryset = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            client__isnull=False
        ).annotate(
            paid_amount=Coalesce(Subquery(paid_subquery), Value(0, output_field=DecimalField())),
            remainder_val=F('total_ttc') - F('paid_amount')
        ).filter(remainder_val__gt=1)

        # 3. Date filtering
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        if date_debut:
            queryset = queryset.filter(date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__lt=date_fin)

        # 4. Final aggregation by Client
        # Since we aggregate an already annotated 'remainder_val', 
        # Django will correctly sum the individual remainders.
        summary = queryset.values('client__id', 'client__name').annotate(
            nb_factures=Count('id'),
            solde_du=Sum('remainder_val'),
            total_facture=Sum('total_ttc'),  # Summing pre-annotated rows is safe
            montant_paye=Sum('paid_amount')
        ).order_by('-solde_du')

        results = []
        for item in summary:
            if not item['client__id']: continue
            results.append({
                'id': item['client__id'],
                'client': item['client__name'],
                'nb_factures': item['nb_factures'],
                'total_facture': item['total_facture'],
                'montant_paye': item['montant_paye'],
                'solde_du': item['solde_du']
            })

        return Response(results)
    
    @action(detail=True, methods=['get'])
    def imprimer_recu(self, request, pk=None):
        facture = self.get_object()
        paiement_id = request.query_params.get('paiement_id')
        
        paiement = None
        if paiement_id:
            try:
                paiement = Caisse.objects.get(id=paiement_id, facture=facture)
            except Caisse.DoesNotExist:
                return Response({'detail': 'Paiement non trouvé.'}, status=404)
        else:
            paiement = facture.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').order_by('-date_paiement').first()

        if not paiement:
            return Response({'detail': 'Aucun paiement trouvé pour cette facture.'}, status=400)

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
        
        story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company))
        address = settings.company_address or ""
        story.append(Paragraph(address.replace('\n', '<br/>'), style_normal))
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph("REÇU DE PAIEMENT", style_title))
        
        client_name = facture.client_name_override or (facture.client.name if facture.client else "Client")
        date_paiement = paiement.date_paiement.strftime('%d/%m/%Y à %H:%M')
        ayant_droit = facture.ayant_droit.nom if hasattr(facture, 'ayant_droit') and facture.ayant_droit else None
        
        info_data = [[Paragraph("<b>Client :</b>", style_normal), Paragraph(client_name, style_normal)]]
        if ayant_droit:
            info_data.append([Paragraph("<b>Bénéficiaire :</b>", style_normal), Paragraph(ayant_droit, style_normal)])
        info_data.extend([
            [Paragraph("<b>Facture N° :</b>", style_normal), Paragraph(facture.numero_facture or str(facture.id), style_normal)],
            [Paragraph("<b>Date du paiement :</b>", style_normal), Paragraph(date_paiement, style_normal)],
            [Paragraph("<b>Mode de règlement :</b>", style_normal), Paragraph(paiement.get_mode_paiement_display(), style_normal)],
        ])
        
        info_table = Table(info_data, colWidths=[4*cm, 10*cm])
        info_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOTTOMPADDING', (0,0), (-1,-1), 4)]))
        story.append(info_table)
        story.append(Spacer(1, 1*cm))
        
        total_paye_avant = facture.paiements.filter(statut='completee', date_paiement__lt=paiement.date_paiement).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
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
        # 1. VERROUILLAGE: On récupère la facture avec select_for_update() 
        # pour empêcher les modifications concurrentes (double paiement)
        try:
            facture = Facture.objects.select_for_update().get(pk=pk)
        except Facture.DoesNotExist:
            return Response({'detail': 'Facture introuvable.'}, status=status.HTTP_404_NOT_FOUND)
            
        if not facture.paiements.filter(mode_paiement='en_compte').exists():
            return Response({'detail': 'Cette facture n\'est pas une créance.'}, status=status.HTTP_400_BAD_REQUEST)
        
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_cash_out')
        if error_response:
            return error_response

        mode_paiement = request.data.get('mode_paiement')
        montant = request.data.get('montant')
        reference_base = request.data.get('reference', '')
        
        reference = f"{reference_base} [{mode_paiement.upper()}] [RECOUV]".strip()
        mode_paiement = 'recouvrement'
        
        if not mode_paiement or not montant:
            return Response({'detail': 'Les champs mode_paiement et montant sont requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            montant = Decimal(str(montant))
        except (ValueError, TypeError):
            return Response({'detail': 'Le montant doit être un nombre valide.'}, status=status.HTTP_400_BAD_REQUEST)
        
        montant_paye = facture.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        reste_a_payer = facture.total_ttc - montant_paye
        
        if montant > reste_a_payer:
            return Response({'detail': f'Le montant ({montant}) dépasse le reste à payer ({reste_a_payer}).', 'reste_a_payer': str(reste_a_payer)}, status=status.HTTP_400_BAD_REQUEST)
        
        paiement = Caisse.objects.create(facture=facture, mode_paiement=mode_paiement, montant=montant, reference=reference, statut='completee', user=validation_user)
        
        from ...services.payment_service import PaymentService
        PaymentService.process_payment(paiement, is_created=True)
        
        facture.refresh_from_db()
        serializer = self.get_serializer(facture)
        return Response({'detail': 'Paiement enregistré avec succès.', 'paiement_id': paiement.id, 'creance': serializer.data})
    
    @action(detail=False, methods=['get'])
    def releve(self, request):
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response({'detail': 'Le paramètre client_id est requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.db.models import OuterRef, Subquery, Sum, DecimalField, Value
        from django.db.models.functions import Coalesce
        
        paid_subquery = Caisse.objects.filter(facture=OuterRef('pk'), statut='completee').exclude(mode_paiement='en_compte').values('facture').annotate(total=Sum('montant')).values('total')[:1]

        queryset = self.get_queryset().filter(client_id=client_id).annotate(
            montant_paye_annotated=Coalesce(Subquery(paid_subquery), Value(0, output_field=DecimalField()))
        )
        
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
                'numero_facture': facture.numero_facture, 'date': facture.date,
                'montant_total': facture.total_ttc, 'montant_paye': montant_paye,
                'reste_a_payer': reste, 'ayant_droit': facture.ayant_droit.nom if facture.ayant_droit else None
            })
        
        from ...models import Client
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
             return Response({'detail': 'Client non trouvé'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'client': {'id': client.id, 'name': client.name, 'address': client.address, 'phone': client.phone, 'email': client.email},
            'periode': {'date_debut': request.query_params.get('date_debut'), 'date_fin': request.query_params.get('date_fin')},
            'creances': creances_data,
            'totaux': {'total_factures': str(total_factures), 'total_paye': str(total_paye), 'total_reste': str(total_reste)}
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_paiement(self, request):
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_view_dashboard')
        if error_response:
            return error_response

        facture_ids = request.data.get('facture_ids', [])
        mode_paiement = request.data.get('mode_paiement')
        reference_base = request.data.get('reference', '')
        
        reference = f"{reference_base} [{mode_paiement.upper()}] [RECOUV]".strip()
        mode_paiement = 'recouvrement'

        if not facture_ids or not isinstance(facture_ids, list):
             return Response({'detail': 'facture_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)
        if not mode_paiement:
            return Response({'detail': 'mode_paiement is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.db.models import OuterRef, Subquery, Sum, DecimalField, Value
        from django.db.models.functions import Coalesce
        
        paid_subquery = Caisse.objects.filter(facture=OuterRef('pk'), statut='completee').exclude(mode_paiement='en_compte').values('facture').annotate(total=Sum('montant')).values('total')[:1]

        factures = Facture.objects.filter(id__in=facture_ids).annotate(
            montant_paye_annotated=Coalesce(Subquery(paid_subquery), Value(0, output_field=DecimalField()))
        )
        
        if not factures.exists():
             return Response({'detail': 'No invoices found.'}, status=status.HTTP_404_NOT_FOUND)
            
        client_ids = factures.values_list('client', flat=True).distinct()
        if len(client_ids) > 1:
             return Response({'detail': 'All invoices must belong to the same client.'}, status=status.HTTP_400_BAD_REQUEST)

        client = factures.first().client
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        releve_ref = f"REL-{timestamp}-{client.id}"
        
        releve = RelevePaiement.objects.create(client=client, generated_by=request.user if request.user.is_authenticated else None, total_amount=Decimal('0.00'), reference=releve_ref)

        total_paid_bulk = Decimal('0.00')
        count_processed = 0

        for facture in factures:
            montant_paye = getattr(facture, 'montant_paye_annotated', Decimal('0.00'))
            reste = facture.total_ttc - montant_paye
            if reste <= 0:
                continue
            paiement = Caisse.objects.create(facture=facture, mode_paiement=mode_paiement, montant=reste, reference=reference, statut='completee', user=validation_user, releve=releve)
            
            from ...services.payment_service import PaymentService
            PaymentService.process_payment(paiement, is_created=True)
            
            total_paid_bulk += reste
            count_processed += 1
            
        releve.total_amount = total_paid_bulk
        releve.save()

        return Response({'detail': f'Règlement groupé effectué. {count_processed} factures traitées.', 'releve_id': releve.id, 'releve_reference': releve.reference, 'total_amount': str(total_paid_bulk)})

    @action(detail=False, methods=['get'])
    def imprimer_releve_paiement(self, request):
        releve_id = request.query_params.get('releve_id')
        if not releve_id:
            return Response({'detail': 'releve_id est requis.'}, status=400)
            
        try:
            releve = RelevePaiement.objects.select_related('client').get(id=releve_id)
        except RelevePaiement.DoesNotExist:
            return Response({'detail': 'Relevé non trouvé.'}, status=404)
        except Exception as e:
            return Response({'detail': f'Erreur: {str(e)}'}, status=500)
        
        try:
            settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
            response = HttpResponse(content_type='application/pdf')
            filename = f"recapitulatif_reglement_{releve.reference}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
            story = []
            styles = getSampleStyleSheet()
            
            try:
                primary_color = HexColor(settings.primary_color) if settings.primary_color else colors.HexColor('#000000')
            except:
                primary_color = colors.HexColor('#000000')
            
            style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=14, spaceAfter=4, textColor=primary_color)
            style_normal = styles['Normal']
            style_title = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20, textColor=primary_color)
            style_label = ParagraphStyle('Label', parent=styles['Normal'], fontName='Helvetica-Bold')
            
            story.append(Paragraph(f"<b>{settings.company_name or 'Entreprise'}</b>", style_company))
            address = settings.company_address or ""
            if address:
                story.append(Paragraph(address.replace('\n', '<br/>'), style_normal))
            story.append(Spacer(1, 1*cm))
            story.append(Paragraph("RÉCAPITULATIF DE RÈGLEMENT", style_title))
            
            date_releve = releve.created_at.strftime('%d/%m/%Y à %H:%M') if releve.created_at else datetime.now().strftime('%d/%m/%Y à %H:%M')
            client_name = releve.client.name if releve.client else "Client inconnu"
            
            info_data = [
                [Paragraph("<b>Client :</b>", style_normal), Paragraph(client_name, style_normal)],
                [Paragraph("<b>Référence :</b>", style_normal), Paragraph(releve.reference or f"REL-{releve.id}", style_normal)],
                [Paragraph("<b>Date :</b>", style_normal), Paragraph(date_releve, style_normal)],
            ]
            info_table = Table(info_data, colWidths=[5*cm, 9*cm])
            info_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOTTOMPADDING', (0,0), (-1,-1), 4)]))
            story.append(info_table)
            story.append(Spacer(1, 0.5*cm))
            
            table_data = [['N° Facture', 'Date Facture', 'Bénéficiaire', 'Montant TTC', 'Réglé']]
            paiements = releve.paiements_caisse.all().select_related('facture', 'facture__ayant_droit')
            
            if not paiements.exists():
                story.append(Paragraph("<i>Aucun paiement trouvé.</i>", style_normal))
            else:
                for p in paiements:
                    try:
                        f = p.facture
                        if not f: continue
                        ayant_droit = f.ayant_droit.nom if f.ayant_droit else "-"
                        table_data.append([
                            f.numero_facture or str(f.id),
                            f.date.strftime('%d/%m/%Y') if f.date else "-",
                            ayant_droit or "-",
                            f"{float(f.total_ttc or 0):,.0f} F",
                            f"{float(p.montant or 0):,.0f} F"
                        ])
                    except Exception as e:
                        logger.error(f"Erreur traitement paiement {p.id}: {str(e)}")
                        continue
                
                if len(table_data) > 1:
                    story.append(Spacer(1, 0.5*cm))
                    t = Table(table_data, colWidths=[3.5*cm, 2.5*cm, 4*cm, 2*cm, 2*cm])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('ALIGN', (3, 1), (4, -1), 'RIGHT'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ]))
                    story.append(t)
            
            story.append(Spacer(1, 1*cm))
            total_amount = float(releve.total_amount) if releve.total_amount else 0.0
            total_data = [["", "", Paragraph("<b>TOTAL RÈGLEMENT :</b>", style_label), Paragraph(f"<b>{total_amount:,.0f} F</b>", style_label)]]
            total_table = Table(total_data, colWidths=[3.5*cm, 2.5*cm, 4*cm, 4*cm])
            total_table.setStyle(TableStyle([('ALIGN', (3, 0), (3, 0), 'RIGHT')]))
            story.append(total_table)
            
            story.append(Spacer(1, 2*cm))
            story.append(Paragraph("Merci de votre confiance.", ParagraphStyle('Thanks', parent=style_normal, alignment=1, italic=True)))
            
            doc.build(story)
            buffer.seek(0)
            response.write(buffer.getvalue())
            return response
            
        except Exception as e:
            logger.error(f"Erreur PDF relevé {releve_id}: {str(e)}", exc_info=True)
            return Response({'detail': f'Erreur PDF: {str(e)}'}, status=500)

    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    def vider(self, request):
        facture_id = request.data.get('facture')
        if not facture_id:
             return Response({'detail': 'ID facture requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        FactureProduit.objects.filter(facture_id=facture_id).delete()
        
        try:
            facture = Facture.objects.get(id=facture_id)
            facture.calculate_totals()
            facture.save()
        except Facture.DoesNotExist:
            pass

        return Response({'detail': 'Contenu de la facture vidé.'})
