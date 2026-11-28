from datetime import date
from decimal import Decimal
from io import BytesIO
from unittest import TestCase

from openpyxl import Workbook, load_workbook

from api.utils.excel import fit_excel_columns


class ExcelLayoutTests(TestCase):
    def test_headers_data_and_totals_without_minimum_width(self):
        ws = Workbook().active
        ws.append(['ID', 'Produit', 'Montant'])
        ws.append([0, 'Paracétamol', 1234.5])
        ws.append([None, 'Total', Decimal('12345.50')])
        for cell in (ws['C2'], ws['C3']):
            cell.number_format = '#,##0.00'
        ws.column_dimensions['A'].width = 40
        fit_excel_columns(ws)
        self.assertEqual(ws.column_dimensions['A'].width, 4)
        self.assertEqual(ws.column_dimensions['B'].width, 13)
        self.assertEqual(ws.column_dimensions['C'].width, 11)
        output = BytesIO()
        ws.parent.save(output)
        output.seek(0)
        restored = load_workbook(output).active
        self.assertEqual(restored['C3'].value, 12345.5)
        self.assertEqual(restored.column_dimensions['A'].width, 4)

    def test_ignores_pharmacy_header_and_merged_labels(self):
        ws = Workbook().active
        ws.append(['Pharmacie ' * 20])
        ws.append(['ID', 'Nom'])
        ws.append([1, 'Test'])
        ws.merge_cells('A4:B4')
        ws['A4'] = 'Total général ' * 20
        fit_excel_columns(ws, min_row=2)
        self.assertEqual(ws.column_dimensions['A'].width, 4)
        self.assertEqual(ws.column_dimensions['B'].width, 6)

    def test_multiline_cap_and_all_rows(self):
        ws = Workbook().active
        ws.append(['Texte', 'Notes'])
        for _ in range(250):
            ws.append(['a', None])
        ws.append(['longue ligne\ncourte', 'x' * 100])
        fit_excel_columns(ws)
        self.assertEqual(ws.column_dimensions['A'].width, 14)
        self.assertEqual(ws.column_dimensions['B'].width, 50)

    def test_date_and_zero_and_empty_sheet(self):
        ws = Workbook().active
        fit_excel_columns(ws)
        ws.append([date(2026, 11, 28), 0, False])
        ws['A1'].number_format = 'dd/mm/yyyy'
        fit_excel_columns(ws)
        self.assertEqual(ws.column_dimensions['A'].width, 12)
        self.assertEqual(ws.column_dimensions['B'].width, 3)
        self.assertEqual(ws.column_dimensions['C'].width, 7)

    def test_accounting_export_uses_shared_widths_after_serialization(self):
        from api.services.compta_exports import _build_excel, _build_liasse_excel

        response = _build_excel(
            'Pharmacie ' * 20, 'Rapport', 'Période',
            ['ID', 'Libellé', 'Montant'], [[1, 'Test', 12345.5]], None,
        )
        ws = load_workbook(BytesIO(response.content)).active
        self.assertEqual(ws.column_dimensions['A'].width, 4)
        self.assertEqual(ws.column_dimensions['C'].width, 11)
        response = _build_liasse_excel('Pharmacie ' * 20, 'Bilan', 'Période', {
            'actif': [{'ref': 'A', 'libelle': 'Test', 'montant': 1}],
            'passif': [], 'resultat': [],
            'totaux': {'total_actif': 1, 'total_passif': 0, 'resultat_net': 1},
        })
        for ws in load_workbook(BytesIO(response.content)).worksheets:
            self.assertEqual(ws.column_dimensions['A'].width, 5)
            self.assertLess(ws.column_dimensions['B'].width, 30)

    def test_report_wrappers_exclude_metadata(self):
        from api.views.rapports.excel_general import _auto_width
        from api.views.rapports.finance import _apply_auto_width

        for fit in (_auto_width, _apply_auto_width):
            ws = Workbook().active
            for _ in range(7):
                ws.append(['Métadonnées ' * 20])
            ws.append(['ID', 'Montant'])
            ws.append([0, 10])
            fit(ws)
            self.assertEqual(ws.column_dimensions['A'].width, 4)
            self.assertEqual(ws.column_dimensions['B'].width, 9)
