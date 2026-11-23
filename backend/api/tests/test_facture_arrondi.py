from decimal import Decimal

from django.test import TestCase

from api.models import Caisse, EcritureComptable, Facture
from api.tests.test_client_financials import ClientFinancialsTestCase
from api.serializers.billing import FactureSerializer
from api.tests.factories import TestDataFactory


class FactureArrondiTests(TestCase):
    def facture(self, prix, couverture=None, remise='0', legacy=False, tva='0'):
        client = TestDataFactory.create_client(taux_couverture=Decimal(couverture or '0'))
        facture = Facture.objects.create(client=client, remise=Decimal(remise), arrondi_5f=not legacy)
        produit = TestDataFactory.create_produit(selling_price=Decimal(prix))
        TestDataFactory.create_facture_produit(facture, produit, selling_price=Decimal(prix), tva=Decimal(tva))
        facture.refresh_from_db()
        return facture

    def test_nearest_five_both_directions(self):
        for prix, attendu in [('4566', '4565'), ('4568', '4570'), ('4565', '4565'), ('4570', '4570')]:
            with self.subTest(prix=prix):
                facture = self.facture(prix)
                self.assertEqual(facture.part_client, Decimal(attendu))
                self.assertEqual(facture.total_ttc, Decimal(attendu))
                self.assertEqual(facture.ecart_arrondi, Decimal(attendu) - Decimal(prix))
                self.assertEqual(facture.total_ht + facture.total_tva + facture.ecart_arrondi, facture.total_ttc)

    def test_rounding_after_discount_not_the_discount_itself(self):
        facture = self.facture('5000', remise='432')
        self.assertEqual(facture.remise, Decimal('432'))
        self.assertEqual(facture.part_client, Decimal('4570'))
        self.assertEqual(facture.ecart_arrondi, Decimal('2'))

    def test_insurer_share_is_unchanged_including_cents(self):
        facture = self.facture('15226', couverture='70')
        self.assertEqual(facture.part_client, Decimal('4570'))
        self.assertEqual(facture.total_ttc - facture.part_client, Decimal('10658.20'))
        self.assertEqual(facture.ecart_arrondi, Decimal('2.20'))
        self.assertEqual(facture.total_ttc, Decimal('15228.20'))

    def test_halfway_rounds_up_and_small_amounts_can_round_to_zero(self):
        facture = self.facture('25', couverture='90')
        self.assertEqual(facture.part_client, Decimal('5'))
        self.assertEqual(facture.ecart_arrondi, Decimal('2.50'))
        self.assertEqual(facture.total_ttc - facture.part_client, Decimal('22.50'))
        self.assertEqual(self.facture('2').total_ttc, Decimal('0'))

    def test_half_even_cents_are_preserved_before_rounding_to_five(self):
        facture = self.facture('1', couverture='49.50')
        self.assertEqual(facture.part_client, Decimal('0'))
        self.assertEqual(facture.ecart_arrondi, Decimal('-0.50'))
        self.assertEqual(facture.total_ttc, Decimal('0.50'))

    def test_pdf_and_print_data_expose_the_adjustment_and_exact_insurer_share(self):
        from unittest.mock import patch
        from reportlab.platypus import Table
        from api.models import InvoiceSettings
        from api.serializers.billing import FacturePrintSerializer
        from api.services.invoice_pdf import generate_invoice_pdf
        from api.utils_doclang import T

        facture = self.facture('15226', couverture='70')
        data = FacturePrintSerializer(facture).data
        self.assertEqual(Decimal(data['ecart_arrondi']), Decimal('2.20'))
        self.assertEqual(Decimal(data['part_assurance']), Decimal('10658.20'))
        self.assertIn('20/100', data['total_lettres'])
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        for lang in ('fr', 'en'):
            with patch('api.services.invoice_pdf.valider_licence_systeme', return_value=(False, '', {})), patch('api.services.invoice_pdf.Table', wraps=Table) as tables:
                pdf = generate_invoice_pdf(facture, settings, lang=lang)
            self.assertTrue(pdf.getvalue().startswith(b'%PDF'))
            rows = [row for call in tables.call_args_list for row in call.args[0]]
            self.assertIn([T(lang, 'inv_rounding'), '+2.20 F'], rows)
            self.assertIn([T(lang, 'inv_insurer_share'), '10,658.20 F'], rows)

    def test_full_coverage_has_no_rounding(self):
        facture = self.facture('4568', couverture='100')
        self.assertEqual(facture.part_client, Decimal('0'))
        self.assertEqual(facture.ecart_arrondi, Decimal('0'))
        self.assertEqual(facture.total_ttc, Decimal('4568'))

    def test_legacy_invoices_keep_their_original_calculation(self):
        facture = self.facture('15226', couverture='70', legacy=True)
        self.assertEqual(facture.total_ttc, Decimal('15226'))
        self.assertEqual(facture.part_client, Decimal('4567.80'))
        self.assertEqual(facture.ecart_arrondi, Decimal('0'))
        facture.calculate_totals()
        facture.refresh_from_db()
        self.assertEqual(facture.part_client, Decimal('4567.80'))

    def test_repeated_calculation_does_not_accumulate_rounding(self):
        facture = self.facture('4568', tva='19.25')
        snapshot = (facture.total_ht, facture.total_tva, facture.total_ttc, facture.part_client, facture.ecart_arrondi)
        for _ in range(3):
            facture.calculate_totals()
            facture.refresh_from_db()
            self.assertEqual((facture.total_ht, facture.total_tva, facture.total_ttc, facture.part_client, facture.ecart_arrondi), snapshot)

    def test_serialized_rounding_fields_are_not_client_writable(self):
        facture = self.facture('4568')
        serializer = FactureSerializer(facture, data={'ecart_arrondi': '100', 'arrondi_5f': False}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('ecart_arrondi', serializer.validated_data)
        self.assertNotIn('arrondi_5f', serializer.validated_data)
        self.assertEqual(Decimal(serializer.data['ecart_arrondi']), Decimal('2'))

    def test_accounting_preserves_tax_bases_and_balances_fractional_discounts(self):
        from api.signals_comptabilite import generer_ecriture_vente

        for prix, remise, tva in [('4569', '0', '20'), ('5000', '432.49', '19.25')]:
            with self.subTest(prix=prix, remise=remise, tva=tva):
                facture = self.facture(prix, remise=remise, tva=tva)
                bases = (facture.total_ht, facture.total_tva, facture.ecart_arrondi)
                facture.status = Facture.Status.VALIDEE
                facture.save()
                generer_ecriture_vente(Facture, facture, False)
                lignes = list(EcritureComptable.objects.get(facture=facture).lignes.all())
                self.assertEqual(sum(ligne.debit for ligne in lignes), sum(ligne.credit for ligne in lignes))
                facture.refresh_from_db()
                self.assertEqual((facture.total_ht, facture.total_tva, facture.ecart_arrondi), bases)

    def test_accounting_rounding_is_separate_and_balanced(self):
        from api.signals_comptabilite import generer_ecriture_vente

        for prix, compte, debit, credit in [('4568', '758000', '0', '2'), ('4566', '658000', '1', '0')]:
            with self.subTest(prix=prix):
                facture = self.facture(prix)
                facture.status = Facture.Status.VALIDEE
                facture.save()
                generer_ecriture_vente(Facture, facture, False)
                ecriture = EcritureComptable.objects.get(facture=facture)
                lignes = list(ecriture.lignes.all())
                self.assertEqual(sum(l.debit for l in lignes), sum(l.credit for l in lignes))
                ligne = ecriture.lignes.get(compte__numero=compte)
                self.assertEqual(ligne.debit, Decimal(debit))
                self.assertEqual(ligne.credit, Decimal(credit))
                self.assertIn('arrondi', ligne.libelle_ligne.lower())


class ArrondiEncaissementTests(ClientFinancialsTestCase):
    def encaisser(self, facture, montant):
        from django.urls import reverse

        response = self.client_api.post(reverse('caisse-bulk-create'), {
            'items': [{'facture': facture.id, 'mode_paiement': 'especes', 'montant': montant, 'statut': 'completee', 'part_patient': montant if facture.part_client < facture.total_ttc else None}],
            'ticket': {'montant_verse': montant, 'montant_rendu': '0'},
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        facture.refresh_from_db()

    def test_discounted_sale_is_settled_at_rounded_amount(self):
        produit = self.factory.create_produit(selling_price=5000)
        response = self._make_sale(None, produit, paiements=[{'mode': 'especes', 'montant': '4570'}], extra={'remise': '432', 'totals': {'totalTtc': 4570}})
        self.assertEqual(response.status_code, 201, response.data)
        facture = Facture.objects.latest('id')
        self.encaisser(facture, '4570')
        self.assertEqual(facture.total_ttc, Decimal('4570'))
        self.assertEqual(facture.ecart_arrondi, Decimal('2'))
        self.assertEqual(Decimal(FactureSerializer(facture).data['reste_a_payer']), Decimal('0'))
        self.assertEqual(sum(Caisse.objects.filter(facture=facture).values_list('montant', flat=True)), Decimal('4570'))

    def test_professional_sale_keeps_insurer_debt_unchanged(self):
        client = self.factory.create_client(client_type='PROFESSIONNEL', taux_couverture=Decimal('70'), plafond=Decimal('50000'))
        produit = self.factory.create_produit(selling_price=15226)
        response = self._make_sale(client, produit, paiements=[
            {'mode': 'especes', 'montant': '4570', 'part_patient': '4570'},
            {'mode': 'en_compte', 'montant': '10658.20', 'part_assurance': '10658.20'},
        ], extra={'totals': {'totalTtc': '15228.20'}})
        self.assertEqual(response.status_code, 201, response.data)
        facture = Facture.objects.latest('id')
        self.encaisser(facture, '4570')
        self.assertEqual(facture.part_client, Decimal('4570'))
        self.assertEqual(facture.total_ttc, Decimal('15228.20'))
        self.assertEqual(sum(Caisse.objects.filter(facture=facture, mode_paiement='en_compte').values_list('montant', flat=True)), Decimal('10658.20'))
        self.assertEqual(Decimal(FactureSerializer(facture).data['reste_a_payer']), Decimal('10658.20'))

    def test_rounding_down_does_not_leave_an_unpaid_franc(self):
        produit = self.factory.create_produit(selling_price=4566)
        response = self._make_sale(None, produit, paiements=[{'mode': 'especes', 'montant': '4565'}], extra={'totals': {'totalTtc': 4565}})
        self.assertEqual(response.status_code, 201, response.data)
        facture = Facture.objects.latest('id')
        self.encaisser(facture, '4565')
        self.assertEqual(facture.ecart_arrondi, Decimal('-1'))
        self.assertEqual(Decimal(FactureSerializer(facture).data['reste_a_payer']), Decimal('0'))
