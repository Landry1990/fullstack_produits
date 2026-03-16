"""
Utilitaires pour générer des PDFs professionnels avec identité pharmaceutique.

Ce module fournit des composants réutilisables pour créer des documents PDF
élégants et cohérents avec le branding PharmaStock.
"""

from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import Table, TableStyle, Paragraph, Spacer
from datetime import datetime

# ============================================================================
# COULEURS PHARMACEUTIQUES
# ============================================================================

class PharmaColors:
    """Palette de couleurs professionnelles pour documents pharmaceutiques"""
    
    # Vert croix de pharmacie
    GREEN = colors.Color(0.133, 0.773, 0.369)      # #22c55e
    GREEN_LIGHT = colors.Color(0.863, 0.980, 0.906) # #dcfce7
    GREEN_DARK = colors.Color(0.082, 0.502, 0.238)  # #15803d
    
    # Gris professionnel
    GRAY_DARK = colors.Color(0.118, 0.161, 0.231)   # #1e293b
    GRAY = colors.Color(0.580, 0.639, 0.721)        # #94a3b8
    GRAY_LIGHT = colors.Color(0.941, 0.980, 0.988)  # #f1f5f9
    GRAY_LIGHTER = colors.Color(0.972, 0.980, 0.992) # #f8fafc
    
    # Texte
    TEXT = colors.Color(0.059, 0.090, 0.165)        # #0f172a
    TEXT_LIGHT = colors.Color(0.392, 0.455, 0.545)  # #64748b
    
    # Alertes
    RED = colors.Color(0.937, 0.267, 0.267)         # #ef4444
    BLUE = colors.Color(0.231, 0.510, 0.965)        # #3b82f6
    
    # Blanc
    WHITE = colors.white


# ============================================================================
# STYLES DE TEXTE
# ============================================================================

def get_pharma_styles():
    """
    Retourne les styles de paragraphe personnalisés pour les PDFs pharma.
    
    Utilise des polices professionnelles avec espacements généreux.
    """
    styles = getSampleStyleSheet()
    
    # Titre principal (grand, vert)
    styles.add(ParagraphStyle(
        name='PharmaTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=PharmaColors.GREEN,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
        spaceAfter=20,
        spaceBefore=10,
    ))
    
    # Sous-titre (moyen, gris foncé)
    styles.add(ParagraphStyle(
        name='PharmaSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=PharmaColors.GRAY_DARK,
        fontName='Helvetica-Bold',
        alignment=TA_LEFT,
        spaceAfter=12,
        spaceBefore=8,
    ))
    
    # Texte normal (lisible, aéré)
    styles.add(ParagraphStyle(
        name='PharmaBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=PharmaColors.TEXT,
        fontName='Helvetica',
        alignment=TA_LEFT,
        spaceAfter=6,
        leading=14,  # Interligne généreux
    ))
    
    # Texte petit (pour infos secondaires)
    styles.add(ParagraphStyle(
        name='PharmaSmall',
        parent=styles['Normal'],
        fontSize=8,
        textColor=PharmaColors.TEXT_LIGHT,
        fontName='Helvetica',
        alignment=TA_LEFT,
        spaceAfter=4,
        leading=10,
    ))
    
    # Total (gros, vert, aligné à droite)
    styles.add(ParagraphStyle(
        name='PharmaTotal',
        fontSize=16,
        textColor=PharmaColors.GREEN,
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT,
        spaceAfter=10,
        spaceBefore=10,
    ))
    
    # Label (petit, gras)
    styles.add(ParagraphStyle(
        name='PharmaLabel',
        fontSize=9,
        textColor=PharmaColors.TEXT_LIGHT,
        fontName='Helvetica-Bold',
        alignment=TA_LEFT,
        spaceAfter=2,
    ))
    
    return styles


# ============================================================================
# EN-TÊTE ET FOOTER
# ============================================================================

def draw_pharma_header(canvas, doc, title="DOCUMENT", subtitle=None, lang='fr'):
    """
    Dessine un en-tête professionnel avec logo croix et informations.
    
    Args:
        canvas: Canvas ReportLab
        doc: Document ReportLab
        title: Titre principal du document (ex: "FACTURE")
        subtitle: Sous-titre optionnel (ex: numéro de facture)
        lang: Langue ('fr' ou 'en')
    """
    canvas.saveState()
    
    # Fond header (gris très clair)
    canvas.setFillColor(PharmaColors.GRAY_LIGHTER)
    canvas.rect(
        0, 
        doc.height + doc.topMargin - 90, 
        doc.width + 2*doc.leftMargin, 
        90, 
        fill=True, 
        stroke=False
    )
    
    # Logo croix de pharmacie (simplifié mais joli)
    x_logo = doc.leftMargin + 15
    y_logo = doc.height + doc.topMargin - 75
    
    canvas.setFillColor(PharmaColors.GREEN)
    canvas.setStrokeColor(PharmaColors.GREEN)
    
    # Croix verticale
    canvas.roundRect(x_logo + 18, y_logo, 12, 55, 2, fill=True, stroke=False)
    # Croix horizontale
    canvas.roundRect(x_logo, y_logo + 22, 48, 12, 2, fill=True, stroke=False)
    
    # Cercle autour (optionnel, élégant)
    canvas.setStrokeColor(PharmaColors.GREEN_LIGHT)
    canvas.setLineWidth(2)
    canvas.circle(x_logo + 24, y_logo + 28, 32, fill=False, stroke=True)
    
    # Nom de l'application
    canvas.setFillColor(PharmaColors.GRAY_DARK)
    canvas.setFont('Helvetica-Bold', 18)
    canvas.drawString(doc.leftMargin + 90, doc.height + doc.topMargin - 40, "PharmaStock")
    
    desc = "Pharmacy Management" if lang == 'en' else "Gestion Pharmaceutique Professionnelle"
    canvas.drawString(doc.leftMargin + 90, doc.height + doc.topMargin - 55, desc)
    
    # Titre du document (centré, vert)
    canvas.setFillColor(PharmaColors.GREEN)
    canvas.setFont('Helvetica-Bold', 16)
    text_width = canvas.stringWidth(title, 'Helvetica-Bold', 16)
    x_center = (doc.width + 2*doc.leftMargin - text_width) / 2
    canvas.drawString(x_center, doc.height + doc.topMargin - 110, title)
    
    # Sous-titre si fourni
    if subtitle:
        canvas.setFillColor(PharmaColors.TEXT_LIGHT)
        canvas.setFont('Helvetica', 10)
        sub_width = canvas.stringWidth(subtitle, 'Helvetica', 10)
        x_sub = (doc.width + 2*doc.leftMargin - sub_width) / 2
        canvas.drawString(x_sub, doc.height + doc.topMargin - 125, subtitle)
    
    canvas.restoreState()


def draw_pharma_footer(canvas, doc, additional_info=None, lang='fr'):
    """
    Dessine un footer professionnel avec pagination et date.
    
    Args:
        canvas: Canvas ReportLab
        doc: Document ReportLab
        additional_info: Information additionnelle à afficher (ex: nom utilisateur)
        lang: Langue ('fr' ou 'en')
    """
    canvas.saveState()
    
    # Ligne de séparation
    canvas.setStrokeColor(PharmaColors.GRAY_LIGHT)
    canvas.setLineWidth(1)
    canvas.line(doc.leftMargin, 60, doc.width + doc.leftMargin, 60)
    
    # Texte footer (petit, gris)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(PharmaColors.TEXT_LIGHT)
    
    # Page number (gauche)
    page_num = canvas.getPageNumber()
    page_label = "Page" if lang == 'fr' else "Page" # Same for both? No, wait.
    canvas.drawString(doc.leftMargin, 45, f"{page_label} {page_num}")
    
    # Date et heure (centre)
    at_label = "à" if lang == 'fr' else "at"
    fmt = "%d/%m/%Y" + f" {at_label} " + "%H:%M"
    date_text = datetime.now().strftime(fmt)
    text_width = canvas.stringWidth(date_text, 'Helvetica', 8)
    x_center = (doc.width + 2*doc.leftMargin - text_width) / 2
    canvas.drawString(x_center, 45, date_text)
    
    # Info additionnelle (droite)
    if additional_info:
        text_width = canvas.stringWidth(additional_info, 'Helvetica', 8)
        canvas.drawString(doc.width + doc.leftMargin - text_width, 45, additional_info)
    
    canvas.restoreState()


# ============================================================================
# STYLES DE TABLEAUX
# ============================================================================

def get_pharma_table_style(header_bg=None, alternating=True):
    """
    Retourne un style de tableau professionnel et aéré.
    
    Args:
        header_bg: Couleur de fond du header (défaut: vert pharma)
        alternating: Si True, alterne les couleurs des lignes
    
    Returns:
        TableStyle configuré pour un tableau pharmaceutique élégant
    """
    if header_bg is None:
        header_bg = PharmaColors.GREEN
    
    style_commands = [
        # ===== HEADER =====
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 14),
        ('TOPPADDING', (0, 0), (-1, 0), 14),
        
        # ===== BODY =====
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TEXTCOLOR', (0, 1), (-1, -1), PharmaColors.TEXT),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        
        # ===== ALTERNATING ROWS (pour lisibilité) =====
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), 
         [colors.white, PharmaColors.GRAY_LIGHTER] if alternating else [colors.white]),
        
        # ===== PADDING GÉNÉREUX (aéré) =====
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        
        # ===== BORDURES =====
        ('LINEBELOW', (0, 0), (-1, 0), 2, PharmaColors.GREEN_DARK),  # Ligne sous header
        ('GRID', (0, 1), (-1, -1), 0.5, PharmaColors.GRAY_LIGHT),    # Grille corps
        ('BOX', (0, 0), (-1, -1), 1.5, PharmaColors.GRAY_DARK),      # Contour
    ]
    
    return TableStyle(style_commands)


def get_pharma_summary_table_style():
    """
    Style pour tableaux de résumé (totaux, infos récap).
    Fond vert clair, sans grille interne.
    """
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PharmaColors.GREEN_LIGHT),
        ('TEXTCOLOR', (0, 0), (-1, -1), PharmaColors.GRAY_DARK),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 2, PharmaColors.GREEN),
    ])


# ============================================================================
# HELPERS
# ============================================================================

def create_info_box(data, col_widths=None):
    """
    Crée une boîte d'information élégante (pour afficher client, dates, etc.)
    
    Args:
        data: Liste de tuples [(label, valeur), ...]
        col_widths: Largeurs des colonnes (optionnel)
    
    Returns:
        Table formatée
    """
    styles = get_pharma_styles()
    
    table_data = []
    for label, value in data:
        table_data.append([
            Paragraph(f"<b>{label}:</b>", styles['PharmaLabel']),
            Paragraph(str(value), styles['PharmaBody'])
        ])
    
    if col_widths is None:
        col_widths = [4*cm, 8*cm]
    
    table = Table(table_data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), PharmaColors.GRAY_LIGHTER),
        ('BACKGROUND', (1, 0), (1, -1), colors.white),
        ('BOX', (0, 0), (-1, -1), 1, PharmaColors.GRAY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, PharmaColors.GRAY_LIGHT),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    return table


def create_spacer(height_cm=1):
    """Crée un espace vertical (plus lisible que Spacer(1, X))"""
    return Spacer(1, height_cm * cm)


def format_currency(amount):
    """Formate un montant en FCFA avec séparateurs"""
    try:
        return f"{int(amount):,} F".replace(',', ' ')
    except (ValueError, TypeError):
        return "0 F"
