from decimal import Decimal
from io import BytesIO

import openpyxl
from unittest.mock import patch

from django.test import SimpleTestCase

from api.services.compta_liasse import compute_ebe


class EbeTests(SimpleTestCase):
    def compute(self, soldes):
        with patch('api.services.compta_liasse._soldes_par_compte', return_value={
            k: Decimal(str(v)) for k, v in soldes.items()
        }) as query:
            report = compute_ebe('2026-01-01', '2026-01-31')
        query.assert_called_once_with('2026-01-01', '2026-01-31')
        return {row['ref']: row['montant'] for row in report['lignes']}

    def test_cascade_and_excluded_accounts(self):
        values = self.compute({
            '701100': -1000, '601100': 600, '603100': -100,
            '702100': -50, '705100': -20, '707100': -30,
            '731000': -10, '721000': -20, '711000': -30,
            '751000': -40, '781000': -50, '602100': 10,
            '603200': 5, '604100': 10, '605100': 10, '608100': 10,
            '603300': -5, '611000': 10, '621000': 10, '631000': 10,
            '641000': 10, '651000': 10, '661000': 100,
            '671000': 999, '681100': 999, '691100': 999,
            '771000': -999, '791000': -999, '891000': 999,
        })
        self.assertEqual(values['XA'], Decimal('500'))
        self.assertEqual(values['XB'], Decimal('1100'))
        self.assertEqual(values['XC'], Decimal('660'))
        self.assertEqual(values['XD'], Decimal('560'))

    def test_depletion_returns_and_negative_ebe(self):
        values = self.compute({'701100': -90, '601100': 100, '603100': 20, '661000': 10})
        self.assertEqual(values['XA'], Decimal('-30'))
        self.assertEqual(values['XD'], Decimal('-40'))

    def test_empty_period(self):
        self.assertTrue(all(value == 0 for value in self.compute({}).values()))

    def test_report_is_explicitly_provisional(self):
        with patch('api.services.compta_liasse._soldes_par_compte', return_value={}):
            report = compute_ebe(None, None)
        self.assertTrue(report['provisoire'])
        self.assertIn('stock', report['avertissement'].lower())

    def test_decimal_precision_and_credit_expense(self):
        values = self.compute({'701100': '-100.23', '601100': '30.11', '661000': '-5.01'})
        self.assertEqual(values['XD'], Decimal('75.13'))

    def test_exports_include_provisional_warning(self):
        from api.services.compta_exports import build_compta_export
        for lang in ('fr', 'en'):
            with patch('api.services.compta_liasse._soldes_par_compte', return_value={}):
                report = compute_ebe(None, None, lang=lang)
            with patch('api.services.compta_exports._pharmacy_header', return_value=('Pharmacie', 'EBE — PROVISOIRE', '2026')):
                excel = build_compta_export('ebe', 'excel', report, None, None)
                pdf = build_compta_export('ebe', 'pdf', report, None, None)
            workbook = openpyxl.load_workbook(BytesIO(excel.content))
            sheet = workbook.active
            self.assertEqual(sheet.cell(sheet.max_row, 2).value, report['avertissement'])
            self.assertEqual(sheet.cell(29, 1).value, 'XD')
            self.assertTrue(pdf.content.startswith(b'%PDF'))

    def test_endpoint_rejects_reversed_dates(self):
        from rest_framework.exceptions import ValidationError
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory
        from api.views.comptabilite import EcritureComptableViewSet

        request = Request(APIRequestFactory().get('/', {'date_debut': '2026-02-01', 'date_fin': '2026-01-01'}))
        with self.assertRaises(ValidationError):
            EcritureComptableViewSet().ebe(request)

