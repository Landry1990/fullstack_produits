"""Génération PDF pour les commandes — bon de réception et étiquettes.

Extrait de commandes.py pour séparer la logique métier de la génération PDF.
"""
import io
import logging
from datetime import datetime

from django.http import HttpResponse
from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)


def _header_footer(canvas, doc, company_info, commande_info, total_achat):
    """Dessine l'en-tête et le pied de page du bon de réception."""
    canvas.saveState()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='RightAlign', alignment=2))

    _page_width, page_height = letter
    margin = doc.leftMargin
    content_width = doc.width

    # Header
    header_data = [
        [
            Paragraph(f"<b>{company_info['name']}</b><br/>{company_info['address']}<br/>Tel: {company_info['tel']}", styles['Normal']),
            Paragraph("<b>BON DE RÉCEPTION</b>", styles['h1'])
        ]
    ]
    header_table = Table(header_data, colWidths=[content_width / 2, content_width / 2])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    _w_header, h_header = header_table.wrapOn(canvas, content_width, doc.topMargin)
    header_table.drawOn(canvas, margin, page_height - doc.topMargin - h_header)

    # Separator line after header
    canvas.line(margin, page_height - doc.topMargin - h_header - 0.1*inch, margin + content_width, page_height - doc.topMargin - h_header - 0.1*inch)

    # Info box
    info_data = [
        [
            Paragraph(f"<b>Fournisseur:</b><br/>{commande_info['fournisseur_name']}<br/>{commande_info['fournisseur_address']}", styles['Normal']),
            Paragraph(f"<b>Commande N°:</b> {commande_info['commande_id']}<br/><b>Date Commande:</b> {commande_info['date_commande']}<br/><b>Date Réception:</b> {commande_info['date_reception']}", styles['Normal'])
        ]
    ]
    info_table = Table(info_data, colWidths=[content_width / 2, content_width / 2])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('TOPPADDING', (0,0), (-1,-1), 12)
    ]))
    _w_info, h_info = info_table.wrapOn(canvas, content_width, doc.topMargin)
    info_table.drawOn(canvas, margin, page_height - doc.topMargin - h_header - 0.1*inch - h_info - 0.1*inch)

    # Footer
    footer_texts = [
        f"Page {doc.page}",
        f"Montant Total: {int(total_achat):,} F".replace(",", " ")
    ]
    canvas.drawString(margin, 0.75 * inch, footer_texts[0])
    canvas.drawRightString(margin + content_width, 0.75 * inch, footer_texts[1])

    canvas.restoreState()


def generate_reception_pdf(commande):
    """Génère le PDF du bon de réception d'une commande clôturée.

    Retourne une HttpResponse avec le PDF en pièce jointe.
    """
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="reception_commande_{commande.id}.pdf"'

    buffer = io.BytesIO()

    company_info = {
        "name": "Djadeu Pharmacy",
        "address": "Logbessou",
        "tel": "697268949"
    }

    # Date de réception : Utiliser la date de clôture si disponible, sinon maintenant (fallback)
    date_reception_str = commande.date_cloture.strftime("%d/%m/%Y") if commande.date_cloture else datetime.now().strftime("%d/%m/%Y")

    commande_info = {
        "commande_id": commande.id,
        "fournisseur_name": commande.fournisseur.name,
        "fournisseur_address": commande.fournisseur.address,
        "date_commande": commande.date.strftime("%d/%m/%Y"),
        "date_reception": date_reception_str
    }

    doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=2.5*inch, bottomMargin=1*inch)
    # Prefetch products to avoid N+1
    items = list(commande.produits.select_related('produit').all())
    total_achat = sum(item.price * item.quantity for item in items)

    # Create a Frame for the content
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')

    # Create a PageTemplate and add the header/footer function
    template = PageTemplate(id='main_template', frames=[frame],
                            onPage=lambda canvas, doc: _header_footer(canvas, doc, company_info, commande_info, total_achat))
    doc.addPageTemplates([template])

    story = []

    # Table Header
    data = [['ID', 'Nom', 'Prix Achat', 'Prix Vente', 'Stock Avant', 'Qte Reçue', 'Stock Après']]

    for item in items:
        produit = item.produit
        # Utiliser les données capturées au moment de la clôture (snapshot)
        # pour garantir que le PDF reflète l'état du stock à la réception
        total_qty = item.quantity + item.unites_gratuites
        stock_apres = item.stock_apres_reception if item.stock_apres_reception else produit.stock
        stock_avant = stock_apres - total_qty
        # Prix de vente au moment de la commande, pas le prix actuel
        prix_vente = item.selling_price if item.selling_price else produit.selling_price

        data.append([
            str(produit.id),
            produit.name,
            f"{int(item.price):,}".replace(",", " "),
            f"{int(prix_vente):,}".replace(",", " "),
            str(stock_avant),
            str(item.quantity),
            str(stock_apres)
        ])

    table = Table(data, colWidths=[0.5*inch, 2*inch, 1*inch, 1*inch, 1*inch, 1*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#008080')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))

    story.append(table)

    styles = getSampleStyleSheet()
    total_text = f"<b>Montant d'achat final: {int(total_achat):,} F</b>".replace(",", " ")
    p_total = Paragraph(total_text, styles['h3'])
    story.append(p_total)

    doc.build(story)

    pdf = buffer.getvalue()
    buffer.close()
    response.write(pdf)

    return response


def generate_labels_pdf(commande, label_format='40x20'):
    """Génère un PDF d'étiquettes pour les produits d'une commande.

    Format: 40x20mm ou 30x15mm (paramètre label_format).
    Contenu: nom produit, lot, fournisseur, code-barres (CIP), date d'entrée, prix de vente.
    """
    # Dimensions en mm convertis en points (1mm = 2.83465 points)
    mm_to_points = 2.83465
    if label_format == '30x15':
        label_width = 30 * mm_to_points  # ~85 points
        label_height = 15 * mm_to_points  # ~42 points
    else:  # 40x20 par défaut
        label_width = 40 * mm_to_points  # ~113 points
        label_height = 20 * mm_to_points  # ~57 points

    buffer = io.BytesIO()

    # Liste pour stocker toutes les étiquettes
    labels_data = []

    # Récupérer tous les produits de la commande (prefetch pour éviter N+1)
    items = list(commande.produits.select_related('produit').all())
    for item in items:
        produit = item.produit
        quantity = item.quantity + item.unites_gratuites  # Total reçu

        # Récupérer le lot de la commande (priorité) ou générer un par défaut
        lot_info = item.lot if item.lot else f"LOT-{commande.id}-{produit.id}"

        # Utiliser la date de clôture (réception effective) si disponible, sinon date commande
        ref_date = commande.date_cloture if commande.date_cloture else commande.date
        date_entree = ref_date.strftime('%d/%m/%Y') if ref_date else ""

        fournisseur_name = commande.fournisseur.name if commande.fournisseur else ""
        invoice_ref = commande.numero_facture if commande.numero_facture else ""

        # Déterminer quel CIP utiliser pour le code-barres
        barcode_value = produit.cip1 or produit.cip2 or produit.cip3 or str(produit.id).zfill(8)

        # Utiliser le prix de vente au moment de la commande (item.selling_price)
        # Si non disponible, utiliser le prix actuel du produit
        selling_price = float(item.selling_price) if item.selling_price else float(produit.selling_price)

        # Créer une étiquette pour chaque unité
        for _ in range(quantity):
            labels_data.append({
                'product_name': produit.name,
                'lot': lot_info,
                'fournisseur': fournisseur_name,
                'barcode': barcode_value,
                'date_entree': date_entree,
                'selling_price': selling_price,
                'invoice_ref': invoice_ref
            })

    # Créer le PDF avec SimpleDocTemplate - marges NULLES
    doc = SimpleDocTemplate(
        buffer,
        pagesize=(label_width, label_height),
        topMargin=0,
        bottomMargin=0,
        leftMargin=0,
        rightMargin=0
    )

    story = []
    styles = getSampleStyleSheet()

    # Style personnalisé ultra-compact
    style_small = ParagraphStyle(
        'SmallLeft',
        parent=styles['Normal'],
        fontSize=5 if label_format == '30x15' else 6,
        alignment=0,
        leading=5.5 if label_format == '30x15' else 6.5,
        spaceAfter=0,
        spaceBefore=0,
        leftIndent=0,
        rightIndent=1
    )

    style_tiny = ParagraphStyle(
        'TinyLeft',
        parent=styles['Normal'],
        fontSize=4 if label_format == '30x15' else 5,
        alignment=0,
        leading=4.5 if label_format == '30x15' else 5.5,
        spaceAfter=0,
        spaceBefore=0,
        leftIndent=1,
        rightIndent=1
    )

    # Générer chaque étiquette
    for label_data in labels_data:
        # Nom du produit (tronqué pour tenir sur UNE SEULE ligne)
        max_chars = 20 if label_format == '30x15' else 30
        product_name = label_data['product_name']
        if len(product_name) > max_chars:
            product_name = product_name[:max_chars-3] + '...'

        story.append(Paragraph(f"<b>{product_name}</b>", style_small))

        # Espace plus grand AVANT le code-barres (1.9)
        story.append(Spacer(1, 1.9))

        # Code-barres - TRÈS compact
        if label_data['barcode']:
            try:
                from reportlab.platypus import Flowable

                class BarcodeFlowable(Flowable):
                    def __init__(self, barcode_value, barcode_height_mm, barcode_width_factor, debug=False):
                        Flowable.__init__(self)
                        self.barcode_value = barcode_value
                        self.barcode_height_mm = barcode_height_mm
                        self.barcode_width_factor = barcode_width_factor
                        self.debug = debug
                        self.width = label_width - 2
                        self.height = barcode_height_mm * mm_to_points

                    def draw(self):
                        barcode_obj = code128.Code128(
                            str(self.barcode_value),
                            barHeight=self.barcode_height_mm * mm_to_points,
                            barWidth=self.barcode_width_factor
                        )
                        barcode_obj.drawOn(self.canv, 0, 0)

                        if self.debug:
                            from reportlab.lib.colors import green
                            self.canv.setStrokeColor(green)
                            self.canv.setLineWidth(0.5)
                            self.canv.rect(0, 0, self.width, self.height)

                # Barcode ultra-compact
                barcode_height_mm = 4 if label_format == '30x15' else 5
                barcode_width_factor = 0.5 if label_format == '30x15' else 0.7

                barcode_flowable = BarcodeFlowable(
                    label_data['barcode'],
                    barcode_height_mm,
                    barcode_width_factor,
                )
                story.append(barcode_flowable)

            except Exception as e:
                logger.error(f"Erreur génération code-barres: {e}", exc_info=True)
                story.append(Paragraph(f"<b>{label_data['barcode']}</b>", style_tiny))

        # Espace plus grand après le code-barres
        story.append(Spacer(1, 1.9))

        # Informations sur 2 lignes avec Table pour alignement
        style_price = ParagraphStyle(
            'PriceRight',
            parent=styles['Normal'],
            fontSize=8 if label_format == '30x15' else 9,
            alignment=2,
            leading=8 if label_format == '30x15' else 9,
            spaceAfter=0,
            spaceBefore=0,
            rightIndent=1
        )

        style_center = ParagraphStyle(
            'CenterTiny',
            parent=style_tiny,
            alignment=1,
        )

        # Ligne 1: Lot (Gauche) + Date (Milieu) + Prix (Droite)
        lot_text = f"L:{label_data['lot'][:8]}" if label_data['lot'] else ""
        date_text = str(label_data['date_entree']) if label_data['date_entree'] else ""
        price_text = f"<b>{label_data['selling_price']:.0f}F</b>"

        data = [[
            Paragraph(lot_text, style_tiny),
            Paragraph(date_text, style_center),
            Paragraph(price_text, style_price)
        ]]

        col1 = label_width * 0.30
        col2 = label_width * 0.35
        col3 = label_width * 0.35

        t = Table(data, colWidths=[col1, col2, col3])
        t.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('ALIGN', (0,0), (0,0), 'LEFT'),
            ('ALIGN', (1,0), (1,0), 'CENTER'),
            ('ALIGN', (2,0), (2,0), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(t)

        # Espace vertical avant la ligne fournisseur (1.9mm)
        story.append(Spacer(1, 1.9 * mm_to_points))

        # Ligne 2: Fournisseur (Gauche) + Facture (Droite)
        if label_data['fournisseur'] or label_data.get('invoice_ref'):
            fourn_text = label_data['fournisseur'][:15]
            inv_text = f"Fact:{label_data['invoice_ref'][:8]}" if label_data.get('invoice_ref') else ""

            style_tiny_right = ParagraphStyle(
                'TinyRight',
                parent=style_tiny,
                alignment=2,
            )

            data_bottom = [[
                Paragraph(fourn_text, style_tiny),
                Paragraph(inv_text, style_tiny_right)
            ]]

            t_bottom = Table(data_bottom, colWidths=[label_width*0.55, label_width*0.45])
            t_bottom.setStyle(TableStyle([
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('ALIGN', (0,0), (0,0), 'LEFT'),
                ('ALIGN', (1,0), (1,0), 'RIGHT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ]))
            story.append(t_bottom)

        # Saut de page pour la prochaine étiquette
        story.append(PageBreak())

    # Construire le PDF
    doc.build(story)

    buffer.seek(0)
    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="etiquettes_commande_{commande.id}.pdf"'
    return response
