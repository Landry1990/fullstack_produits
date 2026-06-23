from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, models
from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import HttpResponse
import io

from ...models import Promis, MouvementStock, Produit
from ...serializers import PromisSerializer
from ...search_mixins import MultiTermSearchMixin
from ...pagination import StandardResultsSetPagination
import logging

logger = logging.getLogger(__name__)


class PromisViewSet(MultiTermSearchMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing Promis (products promised to clients).
    """
    queryset = Promis.objects.filter(is_active=True).select_related('client', 'produit', 'facture', 'created_by')
    serializer_class = PromisSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'client', 'produit']
    search_fields = ['client_name', 'client_phone', 'produit__name', 'notes']
    ordering_fields = ['date_promis', 'status']
    ordering = ['-date_promis']

    def perform_create(self, serializer):
        # DEBUG: Log the incoming data
        logger.info(f"DEBUG PROMIS - Request data: {self.request.data}")
        logger.info(f"DEBUG PROMIS - Client ID: {self.request.data.get('client')}, Client name: {self.request.data.get('client_name')}, Client phone: {self.request.data.get('client_phone')}")
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def delivrer(self, request, pk=None):
        """
        Marquer un promis comme délivré.
        """
        promis = self.get_object()
        
        if promis.status == Promis.Status.DELIVRE:
            return Response({'detail': 'Ce promis est déjà marqué comme délivré.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if promis.status == Promis.Status.ANNULE:
            return Response({'detail': 'Impossible de délivrer un promis annulé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        promis.status = Promis.Status.DELIVRE
        promis.date_livraison = timezone.now()
        promis.save()
        
        return Response({
            'detail': f'Promis #{promis.id} marqué comme délivré.',
            'promis': PromisSerializer(promis).data
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler_et_reintegrer(self, request, pk=None):
        """
        Annuler un promis et réintégrer le stock.
        Crée un mouvement de stock de type RETOUR (affiché en vert dans les stats).
        """
        promis = Promis.objects.select_for_update().get(pk=self.kwargs['pk'])

        if promis.status == Promis.Status.ANNULE:
            return Response({'detail': 'Ce promis est déjà annulé.'}, status=status.HTTP_400_BAD_REQUEST)

        if promis.status == Promis.Status.DELIVRE:
            return Response({'detail': 'Impossible d\'annuler un promis déjà délivré.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Réintégrer le stock
        produit = Produit.objects.select_for_update().get(pk=promis.produit_id) if promis.produit_id else None

        # Pour les produits avec gestion par lots, le stock est géré automatiquement par les signaux
        if produit and not produit.use_lot_management:
            produit.stock += promis.quantite
            produit.save(update_fields=['stock'])

        # 2. Créer le mouvement de stock (type RETOUR = affiché en vert)
        final_stock = produit.total_stock if produit else 0
        MouvementStock.objects.create(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.RETOUR,
            quantite=promis.quantite,
            stock_apres=final_stock,
            user=request.user,
            description=f"Réintégration stock - Annulation promis #{promis.id} (Client: {promis.client_display})"
        )

        # 3. Mettre à jour le statut du promis
        promis.status = Promis.Status.ANNULE
        promis.notes = f"{promis.notes}\n[Annulé le {timezone.now().strftime('%d/%m/%Y %H:%M')} par {request.user.username}]".strip()
        promis.save()

        return Response({
            'detail': f'Promis #{promis.id} annulé. {promis.quantite} unité(s) réintégrée(s) au stock de {produit.name if produit else "Produit inconnu"}.',
            'promis': PromisSerializer(promis).data,
            'nouveau_stock': final_stock
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_delivrer(self, request):
        """
        Marquer plusieurs promis comme délivrés.
        Payload: { "ids": [1, 2, 3] }
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        
        promis_list = Promis.objects.filter(id__in=ids, status=Promis.Status.EN_ATTENTE)
        count = promis_list.count()
        
        if count == 0:
            return Response({'detail': 'Aucun promis en attente trouvé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Bulk update
        promis_list.update(
            status=Promis.Status.DELIVRE,
            date_livraison=timezone.now()
        )
        
        return Response({
            'detail': f'{count} promis marqué(s) comme délivré(s).',
            'count': count
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_annuler(self, request):
        """
        Annuler plusieurs promis et réintégrer le stock.
        Payload: { "ids": [1, 2, 3] }
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        promis_list = list(Promis.objects.filter(
            id__in=ids,
            status=Promis.Status.EN_ATTENTE
        ).select_for_update())

        count = len(promis_list)
        if count == 0:
            return Response({'detail': 'Aucun promis en attente trouvé.'}, status=status.HTTP_400_BAD_REQUEST)

        # Lock products in deterministic order to avoid deadlocks
        product_ids = sorted({promis.produit_id for promis in promis_list if promis.produit_id})
        locked_products = {p.id: p for p in Produit.objects.filter(id__in=product_ids).select_for_update().order_by('id')} if product_ids else {}

        reintegrated = []
        for promis in promis_list:
            produit = locked_products.get(promis.produit_id) if promis.produit_id else None

            # Réintégrer le stock
            if produit and not produit.use_lot_management:
                produit.stock += promis.quantite
                produit.save(update_fields=['stock'])

            # Créer le mouvement de stock
            final_stock = produit.total_stock if produit else 0
            MouvementStock.objects.create(
                produit=produit,
                type_mouvement=MouvementStock.TypeMouvement.RETOUR,
                quantite=promis.quantite,
                stock_apres=final_stock,
                user=request.user,
                description=f"Réintégration stock - Annulation promis #{promis.id} (Client: {promis.client_display})"
            )

            reintegrated.append({
                'id': promis.id,
                'produit': produit.name if produit else 'Produit inconnu',
                'quantite': promis.quantite
            })

        # Bulk update status
        Promis.objects.filter(id__in=ids).update(
            status=Promis.Status.ANNULE,
            notes=models.F('notes')  # Can't easily append in bulk, so just mark as cancelled
        )

        return Response({
            'detail': f'{count} promis annulé(s) et stock réintégré.',
            'count': count,
            'reintegrated': reintegrated
        })

    @action(detail=True, methods=['get'])
    def imprimer_ticket(self, request, pk=None):
        """
        Génère un ticket PDF 80mm x 80mm en double (pharmacie + client).
        """
        promis = self.get_object()
        
        # Taille ticket 80mm x 80mm (environ 227 x 227 points)
        ticket_width = 227
        ticket_height = 227
        
        buffer = io.BytesIO()
        from reportlab.pdfgen import canvas as pdf_canvas
        c = pdf_canvas.Canvas(buffer, pagesize=(ticket_width, ticket_height * 2 + 20))
        
        def draw_ticket(y_offset, title):
            # Titre
            c.setFont("Helvetica-Bold", 10)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 15, "TICKET PROMIS")
            c.setFont("Helvetica", 8)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 28, f"({title})")
            
            # Ligne séparatrice
            c.line(10, y_offset + ticket_height - 35, ticket_width - 10, y_offset + ticket_height - 35)
            
            # Date
            c.setFont("Helvetica", 8)
            date_str = promis.date_promis.strftime('%d/%m/%Y %H:%M')
            c.drawString(10, y_offset + ticket_height - 50, f"Date: {date_str}")
            c.drawRightString(ticket_width - 10, y_offset + ticket_height - 50, f"N° {promis.id}")
            
            # Client
            c.setFont("Helvetica-Bold", 9)
            c.drawString(10, y_offset + ticket_height - 70, "CLIENT:")
            c.setFont("Helvetica", 9)
            client_name = promis.client_display[:25] if len(promis.client_display) > 25 else promis.client_display
            c.drawString(50, y_offset + ticket_height - 70, client_name)
            
            # Téléphone
            c.setFont("Helvetica", 8)
            phone = promis.client_phone_display or "N/A"
            c.drawString(10, y_offset + ticket_height - 85, f"Tél: {phone}")
            
            # Ligne séparatrice
            c.line(10, y_offset + ticket_height - 95, ticket_width - 10, y_offset + ticket_height - 95)
            
            # Produit
            c.setFont("Helvetica-Bold", 9)
            c.drawString(10, y_offset + ticket_height - 110, "PRODUIT PROMIS:")
            
            c.setFont("Helvetica", 9)
            produit_name = promis.produit.name[:30] if len(promis.produit.name) > 30 else promis.produit.name
            c.drawString(10, y_offset + ticket_height - 125, produit_name)
            
            # Quantité
            c.setFont("Helvetica-Bold", 12)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 150, f"Quantité: {promis.quantite}")
            
            # Ligne séparatrice
            c.line(10, y_offset + ticket_height - 165, ticket_width - 10, y_offset + ticket_height - 165)
            
            # Message
            c.setFont("Helvetica-Oblique", 7)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 180, "Conservez ce ticket comme preuve")
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 190, "de votre réservation.")
            
            # Statut
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 210, f"Statut: {promis.get_status_display()}")
            
            # Cadre
            c.rect(5, y_offset + 5, ticket_width - 10, ticket_height - 10)
        
        # Dessiner le ticket pharmacie (en haut)
        draw_ticket(ticket_height + 10, "EXEMPLAIRE PHARMACIE")
        
        # Ligne de découpe
        c.setDash(3, 3)
        c.line(0, ticket_height + 5, ticket_width, ticket_height + 5)
        c.setDash()
        c.setFont("Helvetica", 6)
        c.drawCentredString(ticket_width / 2, ticket_height + 7, "✂ DECOUPER ICI ✂")
        
        # Dessiner le ticket client (en bas)
        draw_ticket(0, "EXEMPLAIRE CLIENT")
        
        c.showPage()
        c.save()
        
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="ticket_promis_{promis.id}.pdf"'
        return response

    @action(detail=False, methods=['post'])
    def imprimer_ticket_groupe(self, request):
        """
        Génère un ticket unique pour une liste de Promis.
        Attend un payload JSON: { "ids": [1, 2, 3] }
        """
        promis_ids = request.data.get('ids', [])
        if not promis_ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        promis_list = Promis.objects.filter(id__in=promis_ids).select_related('client', 'produit', 'facture')
        if not promis_list.exists():
            return Response({'detail': 'Aucun Promis trouvé.'}, status=status.HTTP_404_NOT_FOUND)

        # On suppose que tous les promis sont pour le même client
        first_promis = promis_list.first()
        client = first_promis.client
        client_name = first_promis.client_name or (client.name if client else "Client Inconnu")
        client_phone = first_promis.client_phone or (client.phone if client else "")

        # Génération du PDF (Ticket 80mm)
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        # Dimensions 80mm
        ticket_width = 80 * mm
        ticket_height = 200 * mm 
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ticket_promis_groupe_{first_promis.id}.pdf"'

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=(ticket_width, ticket_height),
                                rightMargin=2*mm, leftMargin=2*mm,
                                topMargin=2*mm, bottomMargin=2*mm)

        styles = getSampleStyleSheet()
        style_normal = styles["Normal"]
        style_center = ParagraphStyle('Center', parent=styles['Normal'], alignment=1) # 1=Center

        elements = []

        # En-tête
        elements.append(Paragraph("<b>Djadeu Pharmacy</b>", style_center))
        elements.append(Paragraph("TICKET PROMIS (RELIQUAT)", style_center))
        elements.append(Spacer(1, 2*mm))
        
        elements.append(Paragraph(f"Client: {client_name}", style_normal))
        if client_phone:
            elements.append(Paragraph(f"Tel: {client_phone}", style_normal))
        
        elements.append(Paragraph(f"Date: {first_promis.date_promis.strftime('%d/%m/%Y %H:%M')}", style_normal))
        elements.append(Spacer(1, 2*mm))

        # Tableau des produits promis
        data = [['Produit', 'Qté']]
        for promis in promis_list:
            data.append([
                Paragraph(promis.produit.name, style_normal),
                str(promis.quantite)
            ])

        table = Table(data, colWidths=[55*mm, 15*mm])
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(table)

        elements.append(Spacer(1, 5*mm))
        elements.append(Paragraph("Veuillez conserver ce ticket pour récupérer vos produits.", style_center))
        
        doc.build(elements)
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

    @action(detail=False, methods=['get'])
    def disponibles(self, request):
        """
        Retourne les promis en attente dont le produit est maintenant disponible en stock.
        Utile pour les alertes Dashboard et la page Promis.
        """
        # Promis en attente avec stock suffisant
        promis_disponibles = Promis.objects.filter(
            status=Promis.Status.EN_ATTENTE,
            produit__isnull=False,
            produit__stock__gte=F('quantite')
        ).select_related('client', 'produit', 'facture').order_by('-date_promis')
        
        # Sérialiser
        data = []
        for p in promis_disponibles:
            data.append({
                'id': p.id,
                'client': p.client_display,
                'client_phone': p.client_phone_display,
                'produit_id': p.produit.id if p.produit else None,
                'produit_nom': p.produit.name if p.produit else p.produit_nom,
                'quantite': p.quantite,
                'stock_actuel': p.produit.stock if p.produit else 0,
                'date_promis': p.date_promis.isoformat(),
                'jours_attente': (timezone.now() - p.date_promis).days
            })
        
        return Response({
            'count': len(data),
            'promis_disponibles': data
        })
