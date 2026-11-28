from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Caisse, ClotureCaisse, FactureProduit
from .factories import TestDataFactory as F


class ClotureSalesTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cashier = F.create_superuser()
        cls.seller = F.create_user()
        cls.other_cashier = F.create_user()
        cls.station = F.create_poste_caisse()
        cls.other_station = F.create_poste_caisse()
        cls.end = timezone.now() - timedelta(hours=1)
        cls.start = cls.end - timedelta(hours=8)
        cls.closure = ClotureCaisse.objects.create(
            user=cls.cashier, poste_caisse=cls.station,
            date_debut=cls.start, date_fin=cls.end,
            montant_reel=0, montant_theorique=0,
        )

    def setUp(self):
        self.client.force_authenticate(self.cashier)
        self.url = reverse('cloturecaisse-ventes', args=[self.closure.pk])

    def invoice(self, total=1000, **kwargs):
        return F.create_facture(
            status='VAL', total_ttc=Decimal(str(total)),
            created_by=self.seller, poste_caisse=kwargs.pop('poste_caisse', self.station),
            **kwargs,
        )

    def payment(self, invoice, amount, mode='especes', user=None, at=None, **kwargs):
        payment = F.create_caisse(
            facture=invoice, montant=amount, mode_paiement=mode,
            user=user or self.cashier, **kwargs,
        )
        Caisse.objects.filter(pk=payment.pk).update(date_paiement=at or self.start + timedelta(hours=1))
        return payment

    def test_mixed_payments_one_row_and_totals(self):
        mixed = self.invoice()
        self.payment(mixed, 200)
        self.payment(mixed, 300, 'carte')
        self.payment(mixed, 500, 'en_compte')
        paid = self.invoice(750)
        self.payment(paid, 750)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['totaux'], {
            'montant': '1750.00', 'regle': '1250.00', 'en_compte': '500.00',
        })
        row = next(row for row in response.data['ventes'] if row['facture_id'] == mixed.pk)
        self.assertEqual(row['vendeur'], self.seller.username)
        self.assertEqual(row['caissier'], self.cashier.username)
        self.assertEqual(row['regle'], '500.00')
        self.assertEqual(row['en_compte'], '500.00')

    def test_excludes_credit_only_recoveries_deposits_and_wrong_scope(self):
        for mode in ('en_compte', 'recouvrement', 'depot'):
            self.payment(self.invoice(), 1000, mode)
        self.payment(self.invoice(), 1000, reference='Règlement [RECOUV]')
        self.payment(self.invoice(), 1000, user=self.other_cashier)
        self.payment(self.invoice(poste_caisse=self.other_station), 1000)
        self.payment(self.invoice(), 1000, at=self.start - timedelta(seconds=1))
        self.payment(self.invoice(), 1000, at=self.end + timedelta(seconds=1))
        cancelled = self.payment(self.invoice(), 1000)
        Caisse.objects.filter(pk=cancelled.pk).update(statut='annulee')
        pending = self.payment(self.invoice(), 1000)
        Caisse.objects.filter(pk=pending.pk).update(statut='en_attente')
        self.payment(self.invoice(), 0)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ventes'], [])
        self.assertEqual(response.data['totaux']['regle'], '0.00')

    def test_later_recovery_does_not_change_closing_balance(self):
        invoice = self.invoice()
        self.payment(invoice, 400)
        self.payment(invoice, 600, 'en_compte')
        before = self.client.get(self.url).data
        self.payment(invoice, 600, 'recouvrement', at=self.end + timedelta(minutes=1))
        after = self.client.get(self.url).data
        self.assertEqual(before, after)
        self.assertEqual(after['ventes'][0]['en_compte'], '600.00')

    def test_includes_boundaries_and_does_not_count_previous_receipts_as_current(self):
        invoice = self.invoice()
        self.payment(invoice, 100, at=self.start - timedelta(seconds=1))
        self.payment(invoice, 200, at=self.start)
        self.payment(invoice, 300, at=self.end)
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['ventes'][0]['regle'], '500.00')
        self.assertEqual(response.data['ventes'][0]['en_compte'], '400.00')
        self.assertEqual(response.data['ventes'][0]['date_encaissement'], self.start.isoformat())

    def test_products_keep_chronology_line_order_and_repeated_occurrences(self):
        later = self.invoice(500)
        earlier = self.invoice(1500)
        for invoice, name, quantity, price in (
            (later, 'Doliprane', 1, 500),
            (earlier, 'Doliprane', 2, 500),
            (earlier, 'Vitamine C', 1, 500),
        ):
            FactureProduit.objects.create(
                facture=invoice, produit_nom=name, quantity=quantity, selling_price=price,
            )
        self.payment(later, 500, at=self.start + timedelta(hours=2))
        self.payment(earlier, 1000, at=self.start)
        self.payment(earlier, 500, 'carte', at=self.start + timedelta(minutes=1))
        credit_only = self.invoice()
        FactureProduit.objects.create(facture=credit_only, produit_nom='Exclu', quantity=1, selling_price=1000)
        self.payment(credit_only, 1000, 'en_compte')
        response = self.client.get(self.url, {'detail': 'produits'})
        self.assertEqual(response.status_code, 200)
        lines = response.data['produits']['lignes']
        self.assertEqual([line['produit'] for line in lines], ['Doliprane', 'Vitamine C', 'Doliprane'])
        self.assertEqual([line['quantite'] for line in lines], [2, 1, 1])
        self.assertEqual([line['facture_id'] for line in lines], [earlier.pk, earlier.pk, later.pk])
        self.assertEqual(lines[0]['date_encaissement'], self.start.isoformat())
        self.assertEqual(lines[1]['date_encaissement'], self.start.isoformat())
        self.assertEqual(response.data['produits']['totaux'], {'quantite': 4, 'montant': '2000.00'})
        self.assertNotIn('produits', self.client.get(self.url).data)

    def test_product_net_totals_include_global_discount_and_rounding(self):
        invoice = self.invoice(1000, remise=Decimal('140'))
        for i in range(3):
            FactureProduit.objects.create(
                facture=invoice, produit_nom=f'Produit {i}', quantity=1,
                selling_price=400, discount=20,
            )
        self.payment(invoice, 1000)
        data = self.client.get(self.url, {'detail': 'produits'}).data
        lines = data['produits']['lignes']
        self.assertEqual(len(lines), 3)
        self.assertEqual(sum(Decimal(line['montant']) for line in lines), Decimal('1000.00'))
        self.assertEqual([line['prix_unitaire'] for line in lines], ['380.00'] * 3)
        self.assertEqual(data['produits']['totaux']['montant'], data['totaux']['montant'])
        self.assertEqual(data['produits']['totaux']['quantite'], 3)

    def test_product_report_refuses_to_silently_omit_a_sale_without_lines(self):
        invoice = self.invoice()
        self.payment(invoice, 1000)
        response = self.client.get(self.url, {'detail': 'produits'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('Aucune ligne produit', response.data['detail'])
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_missing_cashier_is_not_an_unfiltered_report(self):
        self.closure.user = None
        self.closure.save(update_fields=['user'])
        self.assertEqual(self.client.get(self.url).status_code, 400)

    def test_authentication_required_and_missing_closure(self):
        self.assertEqual(self.client.get(reverse('cloturecaisse-ventes', args=[999999])).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))
