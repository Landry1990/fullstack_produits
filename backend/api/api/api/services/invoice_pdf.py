import io

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from api.utils_licence import valider_licence_systeme


def _header_footer(canvas, doc, company_info, facture_info, facture):
    canvas.saveState()
    styles = getSampleStyleSheet()
    _page_width, page_height = letter
    margin = doc.leftMargin
    content_width = doc.width

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
    _, header_height = header_table.wrapOn(canvas, content_width, doc.topMargin)
    header_table.drawOn(canvas, margin, page_height - doc.topMargin - header_height)
    canvas.line(margin, page_height - doc.topMargin - header_height - 0.1 * inch, margin + content_width, page_height - doc.topMargin - header_height - 0.1 * inch)

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
        ('TOPPADDING', (0, 0), (-1, -1), 12)
    ]))
    _, info_height = info_table.wrapOn(canvas, content_width, doc.topMargin)
    info_table.drawOn(canvas, margin, page_height - doc.topMargin - header_height - 0.1 * inch - info_height - 0.1 * inch)
    canvas.drawString(margin, 0.75 * inch, f"Page {doc.page}")
    canvas.drawRightString(margin + content_width, 0.75 * inch, f"Total TTC: {facture.total_ttc} F")
    canvas.restoreState()


def generate_invoice_pdf(facture, settings, is_proforma=False):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    story = []
    styles = getSampleStyleSheet()
    style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=16, spaceAfter=6, textColor=HexColor(settings.primary_color))
    style_normal = styles['Normal']
    style_right = ParagraphStyle('Right', parent=styles['Normal'], alignment=2)
    style_center = ParagraphStyle('Center', parent=styles['Normal'], alignment=1)
    style_left = ParagraphStyle('Left', parent=styles['Normal'], alignment=0)

    valid, _, payload = valider_licence_systeme()
    company_name = payload.get('pharmacie_nom') if valid and payload and payload.get('pharmacie_nom') else settings.company_name
    company_address = settings.company_address.replace('\n', '<br/>')
    company_block = [Paragraph(f"<b>{company_name}</b>", style_company), Paragraph(company_address, style_normal)]
    invoice_date = (facture.date_document or facture.date).strftime('%d/%m/%Y à %H:%M')
    client_name = facture.client_name_override or (facture.client.name if facture.client else 'Client de passage')
    invoice_details = f"<b>N° Facture: {facture.numero_facture or facture.id}</b><br/>Date: {invoice_date}<br/>Client: {client_name}"
    if facture.client:
        if facture.client.phone:
            invoice_details += f"<br/>Tel: {facture.client.phone}"
        if getattr(facture.client, 'niu', None):
            invoice_details += f"<br/>NIU: {facture.client.niu}"
        if getattr(facture.client, 'registre_commerce', None):
            invoice_details += f"<br/>RC: {facture.client.registre_commerce}"

    document_title = 'PROFORMA' if is_proforma else 'FACTURE'
    if is_proforma and not facture.numero_facture:
        facture.numero_facture = f'PROFORMA-{facture.id}'
    layout = settings.header_layout
    style_document_title = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=24, alignment=2 if layout in ['split', 'right'] else (0 if layout == 'left' else 1), textColor=HexColor(settings.primary_color), spaceAfter=12)
    title_flowable = Paragraph(f"<b>{document_title}</b>", style_document_title)

    if layout == 'split':
        header_table = Table([[company_block, [title_flowable, Paragraph(invoice_details, style_right)]]], colWidths=[9 * cm, 8 * cm])
        header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
        story.append(header_table)
    elif layout == 'left':
        story.extend(company_block)
        story.append(Spacer(1, 0.5 * cm))
        story.extend([title_flowable, Paragraph(invoice_details, style_left)])
    elif layout == 'center':
        story.extend([
            Paragraph(f"<b>{company_name}</b>", ParagraphStyle('CompanyCenter', parent=style_company, alignment=1)),
            Paragraph(company_address, style_center),
            Spacer(1, 0.5 * cm),
            title_flowable,
            Paragraph(invoice_details, style_center),
        ])
    elif layout == 'right':
        story.extend([
            Paragraph(f"<b>{company_name}</b>", ParagraphStyle('CompanyRight', parent=style_company, alignment=2)),
            Paragraph(company_address, ParagraphStyle('NormalRight', parent=style_normal, alignment=2)),
            Spacer(1, 0.5 * cm),
            title_flowable,
            Paragraph(invoice_details, style_right),
        ])

    story.append(Spacer(1, 1 * cm))
    rows = [[Paragraph('<b>Désignation</b>', style_normal), Paragraph('<b>Qté</b>', style_center), Paragraph('<b>P.U</b>', style_right), Paragraph('<b>Total</b>', style_right)]]
    for item in facture.produits.all():
        total_line = item.quantity * item.selling_price
        rows.append([
            Paragraph(item.produit.name, style_normal),
            Paragraph(str(item.quantity), style_center),
            Paragraph(f'{item.selling_price:,.0f}', style_right),
            Paragraph(f'{total_line:,.0f}', style_right),
        ])
    items_table = Table(rows, colWidths=[9 * cm, 2.5 * cm, 2.5 * cm, 3 * cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(settings.primary_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.extend([items_table, Spacer(1, 1 * cm)])
    totals_table = Table([
        ['Sous-total :', f'{facture.total_ht:,.0f} F'],
        ['TVA :', f'{facture.total_tva:,.0f} F'],
        ['Remise :', f'{facture.remise:,.0f} F'],
        ['TOTAL À PAYER :', f'{facture.total_ttc:,.0f} F'],
    ], colWidths=[4 * cm, 4 * cm])
    totals_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT'), ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'), ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black)]))
    story.append(totals_table)

    doc.build(story, onFirstPage=lambda canvas, document: _header_footer(canvas, document, {
        'name': company_name,
        'address': company_address.replace('<br/>', '\n'),
        'tel': 'N/A',
    }, {
        'facture_id': facture.numero_facture or f'#{facture.id}',
        'date_facture': invoice_date,
        'client_name': client_name,
        'client_address': facture.client.address if facture.client and facture.client.address else '',
        'client_phone': facture.client.phone if facture.client and facture.client.phone else '',
    }, facture))
    buffer.seek(0)
    return buffer
