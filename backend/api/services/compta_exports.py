"""
Exports des états comptables (Excel / PDF).

Chaque document est réduit à une spec tabulaire commune :
  title, headers, rows, total_row (optionnel)
puis rendue par build_excel() ou build_pdf().

Usage : EcritureComptableViewSet.export_document
  GET /api/compta/ecritures/export/?type=balance&format=excel&date_debut=…&date_fin=…
"""

from decimal import Decimal

from django.http import HttpResponse

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

DOC_TYPES = ('balance', 'resultat', 'bilan', 'tva', 'ecritures', 'grand_livre',
             'fec', 'liasse')
FORMATS = ('excel', 'pdf', 'txt')

TITLES = {
    'balance': "Balance des comptes",
    'resultat': "Compte de résultat",
    'bilan': "Bilan",
    'tva': "Rapport TVA",
    'ecritures': "Journal des écritures",
    'grand_livre': "Grand livre général",
    'fec': "Fichier des écritures comptables (FEC)",
    'liasse': "Liasse OHADA",
}

# Ordre des colonnes du FEC (norme de la DGFIP, adaptée OHADA — les comptes
# auxiliaires et la devise sont vides, non gérés par le modèle).
FEC_COLUMNS = ('JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
               'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
               'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
               'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise')


def _num(value):
    """Decimal → float pour l'export (None → 0)."""
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return value


def _spec(doc_type, data):
    """Retourne (headers, rows, total_row|None) pour un type de document."""
    if doc_type == 'balance':
        headers = ['N° Compte', 'Libellé', 'Ouv. Débit', 'Ouv. Crédit',
                   'Mvt Débit', 'Mvt Crédit', 'Clôture Débit', 'Clôture Crédit']
        rows = [[c['numero'], c['libelle'],
                 _num(c['ouverture_debit']), _num(c['ouverture_credit']),
                 _num(c['mouvement_debit']), _num(c['mouvement_credit']),
                 _num(c['cloture_debit']), _num(c['cloture_credit'])]
                for c in data['comptes']]
        t = data['totaux']
        total = ['', 'TOTAUX', _num(t['ouverture_debit']), _num(t['ouverture_credit']),
                 _num(t['mouvement_debit']), _num(t['mouvement_credit']),
                 _num(t['cloture_debit']), _num(t['cloture_credit'])]
        return headers, rows, total

    if doc_type == 'resultat':
        headers = ['Section', 'Compte', 'Libellé', 'Montant']
        rows = [['Produits', d['compte__numero'], d['compte__libelle'], _num(d['montant'])]
                for d in data['details_produits']]
        rows += [['Charges', d['compte__numero'], d['compte__libelle'], _num(d['montant'])]
                 for d in data['details_charges']]
        rows += [
            ['', '', 'Total produits', _num(data['total_produits'])],
            ['', '', 'Valeur du stock', _num(data['valeur_stock'])],
            ['', '', 'Total charges', _num(data['total_charges'])],
        ]
        total = ['', '', 'RÉSULTAT NET', _num(data['resultat_net'])]
        return headers, rows, total

    if doc_type == 'bilan':
        headers = ['Section', 'Compte', 'Libellé', 'Solde']
        rows = [['Actif', d['numero'], d['libelle'], _num(d['solde'])]
                for d in data['details_actif']]
        rows += [['Passif', d['numero'], d['libelle'], _num(d['solde'])]
                 for d in data['details_passif']]
        rows += [
            ['', '', 'Total actif', _num(data['total_actif'])],
            ['', '', 'Total passif', _num(data['total_passif'])],
        ]
        total = ['', '', 'ÉQUILIBRE', _num(data['equilibre'])]
        return headers, rows, total

    if doc_type == 'tva':
        headers = ['Mois', 'TVA collectée', 'TVA déductible', 'TVA nette']
        rows = [[d['mois'], _num(d['tva_collectee']), _num(d['tva_deductible']),
                 _num(d['tva_nette'])] for d in data['details']]
        total = ['TOTAL', _num(data['total_tva_collectee']),
                 _num(data['total_tva_deductible']), _num(data['tva_nette_a_payer'])]
        return headers, rows, total

    if doc_type == 'ecritures':
        headers = ['Date', 'N° Pièce', 'Journal', 'Compte', 'Libellé', 'Débit', 'Crédit']
        rows = [[l['date'], l['numero_piece'], l['journal'], l['compte'],
                 l['libelle'], _num(l['debit']), _num(l['credit'])]
                for l in data['lignes']]
        total = ['', '', '', '', 'TOTAUX', _num(data['total_debit']), _num(data['total_credit'])]
        return headers, rows, total

    if doc_type == 'grand_livre':
        headers = ['Compte', 'Date', 'N° Pièce', 'Journal', 'Libellé',
                   'Débit', 'Crédit', 'Solde progressif']
        rows = [[l['compte'], l['date'], l['numero_piece'], l['journal'],
                 l['libelle'], _num(l['debit']), _num(l['credit']),
                 _num(l['solde_progressif'])]
                for l in data['lignes']]
        total = ['', '', '', '', 'TOTAUX', _num(data['total_debit']),
                 _num(data['total_credit']), '']
        return headers, rows, total

    raise ValueError(f"Type de document inconnu : {doc_type}")


def _pharmacy_header(doc_type, date_debut, date_fin):
    from api.utils.currency import get_pharmacy_name
    name = get_pharmacy_name()
    period = f"Période : {date_debut or '…'} → {date_fin or '…'}"
    return name, TITLES[doc_type], period


def build_compta_export(doc_type, fmt, data, date_debut, date_fin):
    """Point d'entrée : rend la spec en HttpResponse Excel, PDF ou TXT (FEC)."""
    name, title, period = _pharmacy_header(doc_type, date_debut, date_fin)
    filename = f"compta_{doc_type}_{date_debut or 'debut'}_{date_fin or 'fin'}"

    if doc_type == 'fec':
        # Le FEC impose son format : texte plat, colonnes à '|', dates AAAAMMJJ,
        # montants à virgule. Le paramètre format est ignoré.
        response = _build_fec(data)
        filename = f"FEC_{date_fin or 'export'}"
        ext = 'txt'
    elif doc_type == 'liasse':
        if fmt == 'pdf':
            response = _build_liasse_pdf(name, title, period, data)
            ext = 'pdf'
        else:
            response = _build_liasse_excel(name, title, period, data)
            ext = 'xlsx'
    else:
        headers, rows, total_row = _spec(doc_type, data)
        if fmt == 'pdf':
            response = _build_pdf(name, title, period, headers, rows, total_row)
            ext = 'pdf'
        else:
            response = _build_excel(name, title, period, headers, rows, total_row)
            ext = 'xlsx'

    response['Content-Disposition'] = f'attachment; filename="{filename}.{ext}"'
    return response


def _build_fec(data):
    """Rend le FEC : ligne d'en-tête + 1 ligne par ligne d'écriture, CRLF."""
    def dec(v):
        return f"{_num(v):.2f}".replace('.', ',')

    def d8(v):
        return v.strftime('%Y%m%d') if v else ''

    lines = ['|'.join(FEC_COLUMNS)]
    for l in data['lignes']:
        lines.append('|'.join([
            l['journal_code'], l['journal_lib'], str(l['numero_piece']),
            d8(l['date']), l['compte'], l['compte_libelle'],
            '', '',                          # CompAuxNum / CompAuxLib
            l['reference'] or '', d8(l['date']), l['libelle'],
            dec(l['debit']), dec(l['credit']),
            l['lettrage'] or '', d8(l['date_lettrage']),
            d8(l['date']),                   # ValidDate = date d'écriture
            '', '',                          # Montantdevise / Idevise
        ]))

    response = HttpResponse(
        '\r\n'.join(lines) + '\r\n',
        content_type='text/plain; charset=utf-8')
    return response


def _build_excel(name, title, period, headers, rows, total_row):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title[:31]

    header_font = Font(bold=True, color='FFFFFF')
    header_fill = PatternFill('solid', fgColor='1E3A8A')
    bold = Font(bold=True)
    thin = Side(style='thin', color='CBD5E1')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    num_cols = {i + 1 for i, h in enumerate(headers)
                if any(k in h.lower() for k in ('débit', 'crédit', 'montant', 'solde', 'tva'))}

    ws.append([name])
    ws.cell(row=1, column=1).font = Font(bold=True, size=14)
    ws.append([title])
    ws.cell(row=2, column=1).font = bold
    ws.append([period])
    ws.append([])

    ws.append(headers)
    for cell in ws[5]:
        cell.font = header_font
        cell.fill = header_fill
        cell.border = border
        cell.alignment = Alignment(horizontal='center')

    for row in rows:
        ws.append(row)

    if total_row:
        ws.append(total_row)
        for cell in ws[ws.max_row]:
            cell.font = bold
            cell.border = Border(top=Side(style='double'))

    # Formats nombre + bordures + largeurs
    for r in ws.iter_rows(min_row=5):
        for cell in r:
            cell.border = border
            if isinstance(cell.value, (int, float)) and cell.column in num_cols:
                cell.number_format = '#,##0.00'
                cell.alignment = Alignment(horizontal='right')

    for i, h in enumerate(headers, start=1):
        width = max(len(str(h)),
                    max((len(str(r[i - 1])) for r in rows[:200]), default=0)) + 2
        ws.column_dimensions[get_column_letter(i)].width = min(max(width, 10), 55)

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    wb.save(response)
    return response


# ── Liasse OHADA (multi-sections) ────────────────────────────

_LIASSE_HEADERS = ['Réf', 'Libellé', 'Montant']
_LIASSE_SECTIONS = (
    ('actif', 'BILAN — ACTIF'),
    ('passif', 'BILAN — PASSIF'),
    ('resultat', 'COMPTE DE RÉSULTAT'),
)


def _liasse_sheet_rows(lignes, total_label, total_montant):
    rows = [[l['ref'], l['libelle'], _num(l['montant'])] for l in lignes]
    return rows, ['', total_label, _num(total_montant)]


def _build_liasse_excel(name, title, period, data):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    header_font = Font(bold=True, color='FFFFFF')
    header_fill = PatternFill('solid', fgColor='1E3A8A')
    thin = Side(style='thin', color='CBD5E1')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    totals = {'actif': ('TOTAL ACTIF', data['totaux']['total_actif']),
              'passif': ('TOTAL PASSIF', data['totaux']['total_passif']),
              'resultat': ('RÉSULTAT NET', data['totaux']['resultat_net'])}

    for key, sheet_name in _LIASSE_SECTIONS:
        ws = wb.create_sheet(title[:31] if key == 'actif' else sheet_name[:31])
        ws.title = sheet_name[:31]
        ws.append([name])
        ws.cell(row=1, column=1).font = Font(bold=True, size=14)
        ws.append([sheet_name])
        ws.cell(row=2, column=1).font = Font(bold=True)
        ws.append([period])
        ws.append([])
        ws.append(_LIASSE_HEADERS)
        for cell in ws[5]:
            cell.font = header_font
            cell.fill = header_fill
            cell.border = border
            cell.alignment = Alignment(horizontal='center')
        rows, total_row = _liasse_sheet_rows(data[key], *totals[key])
        for r in rows:
            ws.append(r)
        ws.append(total_row)
        for r in ws.iter_rows(min_row=5):
            for cell in r:
                cell.border = border
                if isinstance(cell.value, (int, float)) and cell.column == 3:
                    cell.number_format = '#,##0.00'
                    cell.alignment = Alignment(horizontal='right')
        for cell in ws[ws.max_row]:
            cell.font = Font(bold=True)
            cell.border = Border(top=Side(style='double'))
        for i, w in enumerate((8, 55, 16), start=1):
            ws.column_dimensions[get_column_letter(i)].width = w

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    wb.save(response)
    return response


def _build_liasse_pdf(name, title, period, data):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    styles = getSampleStyleSheet()
    response = HttpResponse(content_type='application/pdf')
    doc = SimpleDocTemplate(response, pagesize=landscape(A4),
                            leftMargin=1 * cm, rightMargin=1 * cm,
                            topMargin=1.2 * cm, bottomMargin=1.2 * cm)

    story = [
        Paragraph(f"<b>{name}</b>", styles['Title']),
        Paragraph(f"<b>{title}</b>", styles['Heading2']),
        Paragraph(period, styles['Normal']),
        Spacer(1, 0.4 * cm),
    ]

    totals = {'actif': ('TOTAL ACTIF', data['totaux']['total_actif']),
              'passif': ('TOTAL PASSIF', data['totaux']['total_passif']),
              'resultat': ('RÉSULTAT NET', data['totaux']['resultat_net'])}

    def fmt(v):
        return f"{v:,.2f}".replace(',', ' ') if isinstance(v, (int, float)) else str(v)

    for key, section_title in _LIASSE_SECTIONS:
        story.append(Paragraph(f"<b>{section_title}</b>", styles['Heading3']))
        table_data = [[Paragraph(f"<b>{h}</b>", styles['Normal']) for h in _LIASSE_HEADERS]]
        rows, total_row = _liasse_sheet_rows(data[key], *totals[key])
        table_data += [[fmt(v) for v in r] for r in rows]
        table_data.append([Paragraph(f"<b>{fmt(v)}</b>", styles['Normal']) for v in total_row])
        table = Table(table_data, repeatRows=1, colWidths=[2 * cm, 15 * cm, 5 * cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CBD5E1')),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story += [table, Spacer(1, 0.5 * cm)]

    doc.build(story)
    return response


def _build_pdf(name, title, period, headers, rows, total_row):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    styles = getSampleStyleSheet()
    response = HttpResponse(content_type='application/pdf')
    doc = SimpleDocTemplate(response, pagesize=landscape(A4),
                            leftMargin=1 * cm, rightMargin=1 * cm,
                            topMargin=1.2 * cm, bottomMargin=1.2 * cm)

    def fmt(v):
        if isinstance(v, (int, float)):
            return f"{v:,.2f}".replace(',', ' ')
        return str(v)

    story = [
        Paragraph(f"<b>{name}</b>", styles['Title']),
        Paragraph(f"<b>{title}</b>", styles['Heading2']),
        Paragraph(period, styles['Normal']),
        Spacer(1, 0.4 * cm),
    ]

    table_data = [[Paragraph(f"<b>{h}</b>", styles['Normal']) for h in headers]]
    for r in rows:
        table_data.append([fmt(v) for v in r])
    if total_row:
        table_data.append([Paragraph(f"<b>{fmt(v)}</b>", styles['Normal']) for v in total_row])

    num_style_cols = {i for i, h in enumerate(headers)
                      if any(k in h.lower() for k in ('débit', 'crédit', 'montant', 'solde', 'tva'))}
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CBD5E1')),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    for i in num_style_cols:
        style.append(('ALIGN', (i, 1), (i, -1), 'RIGHT'))
    if total_row:
        style.append(('LINEABOVE', (0, -1), (-1, -1), 1, colors.black))

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle(style))
    story.append(table)
    doc.build(story)
    return response
