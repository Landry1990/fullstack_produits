"""
Génération PDF et données d'impression pour les inventaires.
"""
import io

from django.http import HttpResponse

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from ....utils_doclang import T, format_doc_date, get_document_language


def generate_ecarts_pdf(inventaire, lang=None):
    """
    Génère un PDF listant uniquement les écarts.
    Retourne une HttpResponse avec le PDF.
    """
    if not lang:
        lang = get_document_language()

    response = HttpResponse(content_type='application/pdf')
    filename = f"ecarts_inventaire_{inventaire.id}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    buffer = io.BytesIO()
    # Marges réduites pour maximiser l'espace
    doc = BaseDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
        leftMargin=0.5*inch, rightMargin=0.5*inch
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
    template = PageTemplate(id='main', frames=[frame])
    doc.addPageTemplates([template])

    story = []
    styles = getSampleStyleSheet()

    # Style économique
    styles.add(ParagraphStyle(name='Small', parent=styles['Normal'], fontSize=8, leading=10))

    story.append(Paragraph(T(lang, 'invd_ecarts_title', id=inventaire.id), styles['Title']))
    story.append(Paragraph(T(lang, 'invd_date', d=format_doc_date(inventaire.date, lang)), styles['Normal']))
    story.append(Spacer(1, 20))

    # Filtre: Ecart != 0 (exclude 0)
    lignes = inventaire.lignes.exclude(ecart=0).select_related(
        'produit', 'produit__rayon'
    ).order_by('produit__rayon__name', 'produit__name')

    if not lignes.exists():
        story.append(Paragraph(T(lang, 'invd_no_ecart'), styles['Normal']))
    else:
        grouped = {}
        for l in lignes:
            r = l.produit.rayon.name if l.produit and l.produit.rayon else T(lang, 'grp_autres')
            if r not in grouped:
                grouped[r] = []
            grouped[r].append(l)

        total_global_ecart = 0

        for rayon in sorted(grouped.keys()):
            story.append(Paragraph(f"<b>{T(lang, 'invd_rayon_prefix', r=rayon)}</b>", styles['Heading3']))

            # Colonnes ajoutées: ID, PMP
            data = [['ID', T(lang, 'col_produit'), 'PMP', T(lang, 'invd_col_theo'), T(lang, 'invd_col_phys'), T(lang, 'invd_col_ecart'), T(lang, 'invd_col_val')]]
            total_rayon = 0
            for l in grouped[rayon]:
                price = (l.produit.pmp if l.produit and l.produit.pmp > 0 else
                    (l.produit.cost_price if l.produit else 0)
                )
                val = l.ecart * price
                total_rayon += val

                # Style pour ecart negatif (Rouge) / positif (Vert/Noir)
                ecart_display = f"{l.ecart:+}" if l.ecart != 0 else "0"
                val_display = f"{val:+.0f}" if val != 0 else "0"
                price_display = f"{price:.0f}"

                data.append([
                    str(l.produit.id) if l.produit else "-",
                    Paragraph(l.produit.name[:50] if l.produit else T(lang, 'produit_inconnu'), styles['Small']),
                    price_display,
                    str(l.stock_theorique),
                    str(l.quantite_physique),
                    ecart_display,
                    val_display
                ])

            total_global_ecart += total_rayon
            data.append(['', '', '', '', '', T(lang, 'row_total'), f"{total_rayon:+.0f}"])

            # Largeur totale dispo ~ 7.5 inches
            t = Table(
                data,
                colWidths=[0.5*inch, 3.0*inch, 0.8*inch, 0.7*inch, 0.7*inch, 0.7*inch, 1.0*inch]
            )
            t.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -2), 0.25, colors.black),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
                ('LINEBELOW', (0, -2), (-1, -2), 0.25, colors.black),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),  # Header Bold
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),  # Total Bold
                ('FONTSIZE', (0, 0), (-1, -1), 8),  # Global Font Size
                ('LEADING', (0, 0), (-1, -1), 10),  # Global Leading
            ]))
            story.append(t)
            story.append(Spacer(1, 15))

        # Grand Total
        story.append(Spacer(1, 15))
        story.append(Paragraph(
            T(lang, 'invd_total_ecarts', v=f"{total_global_ecart:+,.0f}"),
            styles['Heading2']
        ))

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    response.write(pdf)
    return response


def generate_etat_pdf(inventaire, lang=None):
    """
    Génère un PDF de l'état d'inventaire groupé par rayon.
    Retourne une HttpResponse avec le PDF.
    """
    if not lang:
        lang = get_document_language()

    response = HttpResponse(content_type='application/pdf')
    filename = f"inventaire_{inventaire.id}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    buffer = io.BytesIO()
    doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=1*inch)

    # Simple frame
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
    template = PageTemplate(id='main', frames=[frame])
    doc.addPageTemplates([template])

    story = []
    styles = getSampleStyleSheet()

    # Titles
    story.append(Paragraph(T(lang, 'invd_etat_title', id=inventaire.id), styles['Title']))
    story.append(Paragraph(T(lang, 'invd_date', d=format_doc_date(inventaire.date, lang)), styles['Normal']))
    if inventaire.description:
        story.append(Paragraph(T(lang, 'invd_desc', d=inventaire.description), styles['Normal']))
    story.append(Spacer(1, 20))

    # Data
    lignes = inventaire.lignes.select_related(
        'produit', 'produit__rayon'
    ).order_by('produit__rayon__name', 'produit__name')

    grouped = {}
    for l in lignes:
        r = l.produit.rayon.name if l.produit and l.produit.rayon else T(lang, 'grp_autres')
        if r not in grouped:
            grouped[r] = []
        grouped[r].append(l)

    for rayon in sorted(grouped.keys()):
        story.append(Paragraph(f"<b>{T(lang, 'invd_rayon_prefix', r=rayon)}</b>", styles['Heading3']))

        data = [[T(lang, 'col_produit'), T(lang, 'invd_col_theo'), T(lang, 'invd_col_phys'), T(lang, 'invd_col_ecart'), T(lang, 'invd_col_val')]]
        total_val = 0
        for l in grouped[rayon]:
            price = l.produit.pmp if l.produit else 0
            val = l.ecart * price
            total_val += val
            data.append([
                Paragraph(l.produit.name[:35], styles['Normal']),
                str(l.stock_theorique),
                str(l.quantite_physique),
                f"{l.ecart:+}" if l.ecart != 0 else "0",
                f"{val:+.0f}" if val != 0 else "0"
            ])
        data.append(['', '', '', T(lang, 'row_total'), f"{total_val:+.0f}"])

        t = Table(data, colWidths=[3*inch, 0.8*inch, 0.8*inch, 0.6*inch, 1*inch])
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -2), 1, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold')
        ]))
        story.append(t)
        story.append(Spacer(1, 15))

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    response.write(pdf)
    return response


def get_print_data(inventaire, group_by='rayon', is_report=False, lang=None):
    """
    Retourne les données structurées pour l'impression frontend (React).
    Supporte les feuilles de saisie et les rapports d'écarts.

    Args:
        inventaire: Instance de Inventaire
        group_by: Champ de regroupement ('rayon', 'forme', 'groupe')
        is_report: True si c'est un rapport validé

    Returns:
        dict avec les données structurées
    """
    if not lang:
        lang = get_document_language()

    lignes = inventaire.lignes.select_related(
        'produit', 'produit__rayon', 'produit__forme', 'produit__groupe', 'stock_lot'
    )

    # Ajuster l'ordre en fonction du regroupement
    if group_by == 'forme':
        lignes = lignes.order_by('produit__forme__nom', 'produit__name')
    elif group_by == 'groupe':
        lignes = lignes.order_by('produit__groupe__nom', 'produit__name')
    else:
        lignes = lignes.order_by('produit__rayon__name', 'produit__name')

    grouped = {}
    total_global_ecart = 0.0

    for l in lignes:
        if group_by == 'forme':
            group_name = (
                l.produit.forme.nom
                if l.produit and l.produit.forme and l.produit.forme.nom
                else T(lang, 'grp_sans_forme')
            )
        elif group_by == 'groupe':
            group_name = (
                l.produit.groupe.nom
                if l.produit and l.produit.groupe and l.produit.groupe.nom
                else T(lang, 'grp_sans_groupe')
            )
        else:
            group_name = (
                l.produit.rayon.name
                if l.produit and l.produit.rayon and l.produit.rayon.name
                else T(lang, 'grp_autres')
            )

        if group_name not in grouped:
            grouped[group_name] = []

        # Calcul du PMP/Coût pour la valeur de l'écart
        pmp = (
            l.produit.pmp if l.produit and l.produit.pmp else 0
        ) or (
            l.produit.cost_price if l.produit else 0
        )
        valeur_ecart = float(l.ecart) * float(pmp if pmp else 0)
        total_global_ecart += valeur_ecart

        grouped[group_name].append({
            'id': l.id,
            'cip1': l.produit.cip1 if l.produit else '-',
            'name': l.produit.name if l.produit else '-',
            'lot_numero': (
                l.stock_lot.lot if l.stock_lot
                else (l.lot_numero if hasattr(l, 'lot_numero') else '-')
            ),
            'lot_expiration': (
                l.stock_lot.date_expiration.isoformat()
                if l.stock_lot and l.stock_lot.date_expiration
                else None
            ),
            'stock': float(l.stock_theorique),
            'stock_theorique': float(l.stock_theorique),
            'quantite_physique': float(l.quantite_physique),
            'ecart': float(l.ecart),
            'valeur_ecart': valeur_ecart,
            'selling_price': (
                float(l.produit.selling_price)
                if l.produit and l.produit.selling_price
                else 0
            ),
            'is_lot_line': False
        })

    return {
        'title': T(lang, 'invd_report_title') if is_report else T(lang, 'invd_sheet_title'),
        'subtitle': (
            T(lang, 'invd_ref_desc', id=inventaire.id, desc=inventaire.description)
            if inventaire.description
            else T(lang, 'invd_ref', id=inventaire.id)
        ),
        'date': inventaire.date.isoformat(),
        'groups': grouped,
        'is_report': is_report,
        'total_global_ecart': total_global_ecart
    }
