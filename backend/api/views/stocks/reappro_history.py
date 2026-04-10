from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from ...models.stock import ReapproSession, StockAdjustment
from ...serializers import ReapproSessionSerializer
import io
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from ...pdf_utils import (
    PharmaColors, get_pharma_styles, draw_pharma_header, 
    draw_pharma_footer, get_pharma_table_style, create_spacer
)

class ReapproSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API pour consulter l'historique des réapprovisionnements réserve -> rayon.
    """
    queryset = ReapproSession.objects.all().order_by('-created_at')
    serializer_class = ReapproSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        session = self.get_object()
        adjustments = session.adjustments.all().select_related('produit', 'stock_lot')

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4,
            rightMargin=1.5*cm, leftMargin=1.5*cm,
            topMargin=3*cm, bottomMargin=2*cm
        )
        
        styles = get_pharma_styles()
        elements = []

        # Tête du doc
        elements.append(Paragraph(f"SESSION DE RÉAPPROVISIONNEMENT #{session.id}", styles['PharmaTitle']))
        elements.append(create_spacer(0.5))
        
        # Infos session
        info_data = [
            [Paragraph(f"<b>Date :</b> {session.created_at.strftime('%d/%m/%Y %H:%M')}", styles['PharmaBody'])],
            [Paragraph(f"<b>Effectué par :</b> {session.user.get_full_name() or session.user.username}", styles['PharmaBody'])],
            [Paragraph(f"<b>Volume total :</b> {session.total_units} unités ({session.total_products} produits)", styles['PharmaBody'])]
        ]
        info_table = Table(info_data, colWidths=[15*cm])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), PharmaColors.GRAY_LIGHTER),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('BOX', (0, 0), (-1, -1), 1, PharmaColors.GRAY_LIGHT),
        ]))
        elements.append(info_table)
        elements.append(create_spacer(1))

        # Tableau des produits
        table_data = [[
            Paragraph("<b>PRODUIT</b>", styles['PharmaLabel']),
            Paragraph("<b>LOT</b>", styles['PharmaLabel']),
            Paragraph("<b>PÉREMPTION</b>", styles['PharmaLabel']),
            Paragraph("<b>QTÉ</b>", styles['PharmaLabel']),
        ]]

        for adj in adjustments:
            expiry = adj.stock_lot.date_expiration.strftime('%m/%Y') if adj.stock_lot and adj.stock_lot.date_expiration else "N/A"
            lot_num = adj.stock_lot.lot if adj.stock_lot else "N/A"
            
            table_data.append([
                Paragraph(adj.produit.name if adj.produit else "Produit inconnu", styles['PharmaBody']),
                Paragraph(lot_num, styles['PharmaBody']),
                Paragraph(expiry, styles['PharmaBody']),
                Paragraph(str(adj.quantity_change), styles['PharmaBody']),
            ])

        if len(table_data) > 1:
            prod_table = Table(table_data, colWidths=[8*cm, 3*cm, 3*cm, 2.5*cm])
            prod_table.setStyle(get_pharma_table_style())
            elements.append(prod_table)
        else:
            elements.append(Paragraph("Aucun produit enregistré pour cette session.", styles['PharmaBody']))

        # Génération finale
        def on_page(canvas, doc):
            draw_pharma_header(canvas, doc, title="CONFIRMATION DE RÉAPPROVISIONNEMENT", lang='fr')
            draw_pharma_footer(canvas, doc, additional_info=f"Session #{session.id}", lang='fr')

        doc.build(elements, onFirstPage=on_page, onLaterPages=on_page)
        
        pdf = buffer.getvalue()
        buffer.close()
        
        filename = f"reappro_session_{session.id}_{session.created_at.strftime('%Y%m%d')}.pdf"
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write(pdf)
        return response
