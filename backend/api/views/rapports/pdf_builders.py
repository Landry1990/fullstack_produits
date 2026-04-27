"""
Constructeur PDF pour les rapports financiers ZENITH.
Isolé de finance.py pour alléger la lecture du mixin.
"""
from io import BytesIO

from django.http import HttpResponse


def build_rapport_pdf(data: dict, title_text: str, filename: str) -> HttpResponse:
    """
    Construit un PDF A4 complet (KPIs, encaissements, achats, clients pro,
    unités gratuites, TVA, créances, mouvements de caisse).
    """
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, PropertySet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    from api.pdf_utils import (
        PharmaColors, draw_pharma_footer, draw_pharma_header,
        format_currency, get_pharma_styles,
    )

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=12 * mm, leftMargin=12 * mm,
        topMargin=28 * mm, bottomMargin=18 * mm,
    )
    styles = get_pharma_styles()
    W = doc.width  # ≈ 186 mm
    half_w = (W - 4 * mm) / 2

    # ── Styles texte ──────────────────────────────────────────────────────────
    s_section = ParagraphStyle(
        'SectionTitle', parent=styles['Heading2'],
        fontSize=11, textColor=PharmaColors.GREEN_DARK,
        fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=4,
    )
    s_cell   = ParagraphStyle('Cell',      fontSize=7, fontName='Helvetica',      leading=9, textColor=PharmaColors.TEXT)
    s_cell_b = ParagraphStyle('CellBold',  fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=PharmaColors.TEXT)
    s_cell_r = ParagraphStyle('CellRight', fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=PharmaColors.TEXT, alignment=TA_RIGHT)
    s_header   = ParagraphStyle('THeader',  fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=colors.white)
    s_header_r = ParagraphStyle('THeaderR', fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=colors.white, alignment=TA_RIGHT)

    def _compact_style() -> TableStyle:
        return TableStyle([
            ('BACKGROUND',   (0, 0), (-1,  0), PharmaColors.GREEN),
            ('TEXTCOLOR',    (0, 0), (-1,  0), colors.white),
            ('FONTSIZE',     (0, 0), (-1, -1), 7),
            ('TOPPADDING',   (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 3),
            ('LEFTPADDING',  (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS',(0, 1),(-1, -1), [colors.white, PharmaColors.GRAY_LIGHTER]),
            ('GRID',         (0, 0), (-1, -1), 0.3, PharmaColors.GRAY),
            ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ])

    def _two_col_style() -> TableStyle:
        return TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (0,   0), 2 * mm),
            ('LEFTPADDING',   (1, 0), (1,   0), 2 * mm),
        ])

    def _ph(text: str, style: "ParagraphStyle | PropertySet") -> Paragraph:
        return Paragraph(text, style)

    def _cur(value, style: "ParagraphStyle | PropertySet") -> Paragraph:
        return Paragraph(format_currency(value), style)

    story = []

    # ── Titre ─────────────────────────────────────────────────────────────────
    story.append(_ph(f"<b>{title_text}</b>", styles['Title']))
    story.append(Spacer(1, 2 * mm))

    # ── 1. KPIs ───────────────────────────────────────────────────────────────
    kpi_items = [
        ('CA TTC',      format_currency(data['ca']['ca_ttc'])),
        ('CA HT',       format_currency(data['ca']['ca_ht'])),
        ('Marge Brute', format_currency(data['marge']['marge_brute'])),
        ('Marge %',     f"{data['marge']['marge_pct']}%"),
        ('Remises',     format_currency(data['ca']['total_remises'])),
        ('Nb Ventes',   str(data['ca']['nb_ventes'])),
    ]
    s_kpi_val = ParagraphStyle(
        'KpiVal', fontSize=9, fontName='Helvetica-Bold',
        leading=11, textColor=PharmaColors.GREEN_DARK, alignment=TA_CENTER,
    )
    kw = W / len(kpi_items)
    t_kpi = Table(
        [[_ph(f"<b>{k}</b>", s_header) for k, _ in kpi_items],
         [_ph(f"<b>{v}</b>", s_kpi_val) for _, v in kpi_items]],
        colWidths=[kw] * len(kpi_items),
    )
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND',  (0, 0), (-1, 0), PharmaColors.GREEN),
        ('BACKGROUND',  (0, 1), (-1, 1), PharmaColors.GREEN_LIGHT),
        ('ALIGN',       (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',  (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0,0), (-1, -1), 4),
        ('BOX',         (0, 0), (-1, -1), 1, PharmaColors.GREEN),
        ('INNERGRID',   (0, 0), (-1, -1), 0.3, PharmaColors.GREEN),
    ]))
    story += [t_kpi, Spacer(1, 4 * mm)]

    # ── 2. Encaissements (gauche) + Achats fournisseurs (droite) ──────────────
    enc_rows = [[_ph('<b>Mode</b>', s_header), _ph('<b>Montant</b>', s_header_r)]]
    for e in data.get('encaissements', []):
        montant = float(e.get('montant', 0))
        if montant > 0:
            enc_rows.append([_ph(str(e.get('mode_label', '')), s_cell), _cur(montant, s_cell_r)])
    if float(data.get('depots_total', 0)) > 0:
        enc_rows.append([_ph('Dépôts', s_cell), _cur(data['depots_total'], s_cell_r)])
    total_enc = (
        sum(float(e.get('montant', 0)) for e in data.get('encaissements', []))
        + float(data.get('depots_total', 0))
    )
    enc_rows.append([_ph('<b>Total Encaissements</b>', s_cell_b), _ph(f'<b>{format_currency(total_enc)}</b>', s_cell_r)])
    if float(data.get('ventes_credit', 0)) > 0:
        enc_rows.append([_ph('Ventes à crédit', s_cell), _cur(data['ventes_credit'], s_cell_r)])
    if float(data.get('coupons_total', 0)) > 0:
        enc_rows.append([_ph('Coupons', s_cell), _cur(data['coupons_total'], s_cell_r)])
    t_enc = Table(enc_rows, colWidths=[half_w * 0.55, half_w * 0.45])
    t_enc.setStyle(_compact_style())

    ach_rows = [[_ph('<b>Fournisseur</b>', s_header), _ph('<b>Cmd</b>', s_header_r), _ph('<b>Montant</b>', s_header_r)]]
    achats = data.get('achats_par_fournisseur', [])
    for f in achats[:10]:
        ach_rows.append([
            _ph(str(f.get('fournisseur_nom', ''))[:30], s_cell),
            _ph(str(f.get('nb_commandes', 0)), s_cell_r),
            _cur(f.get('montant_total', 0), s_cell_r),
        ])
    if not achats:
        ach_rows.append([_ph('Aucun achat', s_cell), _ph('-', s_cell_r), _ph('-', s_cell_r)])
    total_ach = sum(float(f.get('montant_total', 0)) for f in achats)
    ach_rows.append([_ph('<b>Total</b>', s_cell_b), _ph('', s_cell_r), _ph(f'<b>{format_currency(total_ach)}</b>', s_cell_r)])
    t_ach = Table(ach_rows, colWidths=[half_w * 0.50, half_w * 0.15, half_w * 0.35])
    t_ach.setStyle(_compact_style())

    story.append(_ph('<b>💰 Encaissements & Achats</b>', s_section))
    story.append(Table([[t_enc, t_ach]], colWidths=[half_w, half_w], hAlign='LEFT', style=_two_col_style()))
    story.append(Spacer(1, 4 * mm))

    # ── 3. Clients Pro (gauche) + Unités Gratuites (droite) ───────────────────
    pro = data.get('clients_professionnels', {})
    pro_rows = [[_ph('<b>Client</b>', s_header), _ph('<b>CA</b>', s_header_r), _ph('<b>Reste</b>', s_header_r)]]
    for c in pro.get('top_clients', [])[:7]:
        pro_rows.append([
            _ph(str(c.get('client_nom', ''))[:25], s_cell),
            _cur(c.get('ca_total', 0), s_cell_r),
            _cur(c.get('reste_a_payer', 0), s_cell_r),
        ])
    pro_rows.append([
        _ph(f"<b>Total ({pro.get('taux_recouvrement_pct', 0):.0f}% recouv.)</b>", s_cell_b),
        _ph(f"<b>{format_currency(pro.get('ca_total', 0))}</b>", s_cell_r),
        _ph(f"<b>{format_currency(pro.get('reste_a_payer', 0))}</b>", s_cell_r),
    ])
    t_pro = Table(pro_rows, colWidths=[half_w * 0.45, half_w * 0.28, half_w * 0.27])
    t_pro.setStyle(_compact_style())

    ug = data.get('unites_gratuites', {})
    ug_rows = [[_ph('<b>Produit</b>', s_header), _ph('<b>Qté</b>', s_header_r), _ph('<b>Valeur</b>', s_header_r)]]
    for p in ug.get('top_produits', [])[:7]:
        ug_rows.append([
            _ph(str(p.get('produit_nom', ''))[:25], s_cell),
            _ph(str(p.get('quantite_gratuite', 0)), s_cell_r),
            _cur(p.get('valeur_totale', 0), s_cell_r),
        ])
    ug_rows.append([
        _ph(f"<b>Total ({ug.get('pct_du_ca', 0):.1f}% CA)</b>", s_cell_b),
        _ph(f"<b>{ug.get('quantite_totale', 0)}</b>", s_cell_r),
        _ph(f"<b>{format_currency(ug.get('valeur_totale', 0))}</b>", s_cell_r),
    ])
    t_ug = Table(ug_rows, colWidths=[half_w * 0.45, half_w * 0.20, half_w * 0.35])
    t_ug.setStyle(_compact_style())

    story.append(_ph('<b>👥 Clients Professionnels & Unités Gratuites</b>', s_section))
    story.append(Table([[t_pro, t_ug]], colWidths=[half_w, half_w], hAlign='LEFT', style=_two_col_style()))
    story.append(Spacer(1, 4 * mm))

    # ── 4. TVA (gauche) + Créances + Mouvements Caisse (droite) ──────────────
    tva_rows = [[
        _ph('<b>Taux</b>', s_header), _ph('<b>CA HT</b>', s_header_r),
        _ph('<b>TVA</b>', s_header_r), _ph('<b>TTC</b>', s_header_r),
    ]]
    for tva in data.get('ca_par_tva', []):
        tva_rows.append([
            _ph(f"{tva.get('taux', 0)}%", s_cell),
            _cur(tva.get('ca_ht', 0), s_cell_r),
            _cur(tva.get('montant_tva', 0), s_cell_r),
            _cur(tva.get('ca_ttc', 0), s_cell_r),
        ])
    t_tva = Table(tva_rows, colWidths=[half_w * 0.20, half_w * 0.27, half_w * 0.26, half_w * 0.27])
    t_tva.setStyle(_compact_style())

    mvts = data.get('mouvements_caisse', {})
    t_cr = Table(
        [[_ph('<b>Créances à Percevoir</b>', s_header),
          _ph(f"<b>{format_currency(data.get('creances_a_percevoir', 0))}</b>", s_header_r)]],
        colWidths=[half_w * 0.55, half_w * 0.45],
    )
    t_cr.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), PharmaColors.GREEN_LIGHT),
        ('BOX',          (0, 0), (-1, -1), 0.5, PharmaColors.GREEN),
        ('TOPPADDING',   (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 5),
        ('LEFTPADDING',  (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TEXTCOLOR',    (0, 0), (-1, -1), PharmaColors.GREEN_DARK),
    ]))

    t_mvt = Table(
        [
            [_ph('<b>Mouvements Caisse</b>', s_header), _ph('<b>Montant</b>', s_header_r)],
            [_ph('Entrées diverses', s_cell),  _cur(mvts.get('total_entrees', 0), s_cell_r)],
            [_ph('Sorties diverses', s_cell),  _cur(mvts.get('total_sorties', 0), s_cell_r)],
            [_ph('<b>Solde</b>', s_cell_b),    _ph(f"<b>{format_currency(mvts.get('solde', 0))}</b>", s_cell_r)],
        ],
        colWidths=[half_w * 0.55, half_w * 0.45],
    )
    t_mvt.setStyle(_compact_style())

    right_stack = Table(
        [[t_cr], [Spacer(1, 2 * mm)], [t_mvt]],
        colWidths=[half_w],
        style=TableStyle([
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]),
    )

    story.append(_ph('<b>📊 TVA, Créances & Mouvements</b>', s_section))
    story.append(Table([[t_tva, right_stack]], colWidths=[half_w, half_w], hAlign='LEFT', style=_two_col_style()))

    # ── 5. Détail mouvements de caisse ────────────────────────────────────────
    mvt_liste = mvts.get('liste', [])
    if mvt_liste:
        story.append(Spacer(1, 4 * mm))
        story.append(_ph('<b>📋 Détail des Mouvements de Caisse</b>', s_section))
        detail_rows = [[
            _ph('<b>Date</b>', s_header),
            _ph('<b>Type</b>', s_header),
            _ph('<b>Motif</b>', s_header),
            _ph('<b>Utilisateur</b>', s_header),
            _ph('<b>Montant</b>', s_header_r),
        ]]
        for m in mvt_liste[:15]:
            is_entree = m.get('type') == 'ENTREE'
            detail_rows.append([
                _ph(str(m.get('date', ''))[:10], s_cell),
                _ph('Entrée' if is_entree else 'Sortie', s_cell),
                _ph(str(m.get('motif', ''))[:35], s_cell),
                _ph(str(m.get('user', ''))[:15], s_cell),
                _ph(f"{'+'  if is_entree else '-'}{format_currency(m.get('montant', 0))}", s_cell_r),
            ])
        t_detail = Table(detail_rows, colWidths=[W * 0.13, W * 0.10, W * 0.37, W * 0.18, W * 0.22])
        t_detail.setStyle(_compact_style())
        story.append(t_detail)

    # ── Build ─────────────────────────────────────────────────────────────────
    def _on_page(canvas, doc):
        draw_pharma_header(canvas, doc, title="RAPPORT")
        draw_pharma_footer(canvas, doc)

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write(buffer.getvalue())
    return response
