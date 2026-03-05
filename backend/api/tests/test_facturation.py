"""
Tests for the Facturation (billing) module.
Covers: finaliser, destroy, bulk_delete, marquer_payee, stats_jour,
        historique ventes, and model calculate_totals.
"""
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import TestDataFactory
from ..models import (
    Facture, FactureProduit, Produit, Caisse, StockLot,
    FactureProduitAllocation, MouvementStock
)


class FinaliserVenteTests(APITestCase):
    """Tests for the 'finaliser' action — atomic sale completion."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.rayon = TestDataFactory.create_rayon(name='Médicaments')
        self.fournisseur = TestDataFactory.create_fournisseur(name='Distrib Pharma')
        self.produit = TestDataFactory.create_produit(
            name='Doliprane 1000mg', stock=50,
            cost_price=200, selling_price=500,
            rayon=self.rayon, fournisseur=self.fournisseur
        )
        self.client_obj = TestDataFactory.create_client(name='Patient Dupont')

    def _finaliser_payload(self, **overrides):
        """Helper to build a valid finaliser payload."""
        payload = {
            'client': self.client_obj.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 3,
                'selling_price': '500',
                'discount': '0',
                'tva': '0',
            }],
            'paiements': [{'mode': 'especes', 'montant': '1500'}],
            'remise': '0',
            'type': 'STD',
            'centralized_cash_register': True,
        }
        payload.update(overrides)
        return payload

    def test_finaliser_creates_invoice_and_products(self):
        """A successful finaliser call creates a facture with its products."""
        url = reverse('facture-finaliser')
        payload = self._finaliser_payload()
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Facture was created
        facture = Facture.objects.order_by('-id').first()
        self.assertIsNotNone(facture)

        # Products attached
        lines = FactureProduit.objects.filter(facture=facture)
        self.assertEqual(lines.count(), 1)
        self.assertEqual(lines.first().quantity, 3)

    def test_finaliser_centralized_validates_and_destocks(self):
        """
        With centralized_cash_register=True, finaliser validates the facture
        and decrements stock immediately (destockage at facturation).
        No payment records are created (handled later at caisse).
        """
        # Create a stock lot for FIFO allocation
        TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=50, lot_name='LOT-CENT-001'
        )
        self.produit.stock = 50
        self.produit.save()

        url = reverse('facture-finaliser')
        initial_stock = self.produit.stock
        payload = self._finaliser_payload(centralized_cash_register=True)
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        # Facture should be VALIDEE (stock deducted at facturation)
        self.assertEqual(facture.status, Facture.Status.VALIDEE)

        # Stock decremented immediately
        self.produit.refresh_from_db()
        self.assertLess(self.produit.stock, initial_stock)

        # No payment records in centralized mode
        self.assertEqual(Caisse.objects.filter(facture=facture).count(), 0)

    def test_finaliser_non_centralized_validates(self):
        """
        With centralized_cash_register=False, finaliser validates the invoice,
        decrements stock, and creates payment records.
        """
        # Create a stock lot for FIFO allocation
        TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=50, lot_name='LOT-FIN-001'
        )
        self.produit.stock = 50
        self.produit.save()

        url = reverse('facture-finaliser')
        initial_stock = self.produit.stock
        payload = self._finaliser_payload(centralized_cash_register=False)
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        # Should be VALIDEE or PAYEE (payment triggers signal)
        self.assertIn(facture.status, [Facture.Status.VALIDEE, Facture.Status.PAYEE])

        # Stock decremented
        self.produit.refresh_from_db()
        self.assertLess(self.produit.stock, initial_stock)

    def test_finaliser_empty_products_rejected(self):
        """Finaliser with no products returns 400."""
        url = reverse('facture-finaliser')
        payload = self._finaliser_payload(produits=[])
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('produits', response.data.get('detail', '').lower())

    def test_finaliser_with_discount(self):
        """Finaliser applies the global discount correctly."""
        url = reverse('facture-finaliser')
        payload = self._finaliser_payload(remise='200')
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        facture = Facture.objects.order_by('-id').first()
        self.assertEqual(facture.remise, Decimal('200'))
        # TTC = 3 * 500 - 200 = 1300
        self.assertEqual(facture.total_ttc, Decimal('1300.00'))

    def test_finaliser_creates_payment_in_non_centralized(self):
        """In non-centralized mode, finaliser creates payment entries in Caisse."""
        TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=50, lot_name='LOT-PAY-001'
        )
        self.produit.stock = 50
        self.produit.save()

        url = reverse('facture-finaliser')
        payload = self._finaliser_payload(centralized_cash_register=False)
        self.client.post(url, payload, format='json')

        facture = Facture.objects.order_by('-id').first()
        payments = Caisse.objects.filter(facture=facture)
        self.assertTrue(payments.exists(), "At least one payment record should exist")


class MarquerPayeeTests(APITestCase):
    """Tests for the 'marquer_payee' action."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()

    def test_marquer_payee_valid(self):
        """Marking a validated invoice as paid succeeds."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='VAL', total_ttc=Decimal('1000')
        )
        url = reverse('facture-marquer-payee', kwargs={'pk': facture.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.PAYEE)

    def test_marquer_payee_brouillon_rejected(self):
        """Marking a brouillon invoice as paid is rejected."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        url = reverse('facture-marquer-payee', kwargs={'pk': facture.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.BROUILLON)

    def test_marquer_payee_already_paid_rejected(self):
        """Marking an already paid invoice returns 400."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='PAY'
        )
        url = reverse('facture-marquer-payee', kwargs={'pk': facture.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DestroyFactureTests(APITestCase):
    """Tests for deleting individual invoices."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()

    def test_destroy_brouillon_succeeds(self):
        """Deleting a draft invoice succeeds."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        url = reverse('facture-detail', kwargs={'pk': facture.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Facture.objects.filter(pk=facture.pk).exists())


class BulkDeleteTests(APITestCase):
    """Tests for the 'bulk_delete' action."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()

    def test_bulk_delete_brouillons(self):
        """Bulk deleting draft invoices works."""
        f1 = TestDataFactory.create_facture(client=self.client_obj, status='BROU')
        f2 = TestDataFactory.create_facture(client=self.client_obj, status='BROU')
        f3 = TestDataFactory.create_facture(client=self.client_obj, status='BROU')

        url = reverse('facture-bulk-delete')
        response = self.client.post(url, {'ids': [f1.id, f2.id, f3.id]}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['detail'], '3 facture(s) supprimée(s).')
        self.assertEqual(Facture.objects.filter(id__in=[f1.id, f2.id, f3.id]).count(), 0)

    def test_bulk_delete_skips_validated(self):
        """Bulk delete refuses to delete validated invoices."""
        f_val = TestDataFactory.create_facture(client=self.client_obj, status='VAL')
        f_brou = TestDataFactory.create_facture(client=self.client_obj, status='BROU')

        url = reverse('facture-bulk-delete')
        response = self.client.post(url, {'ids': [f_val.id, f_brou.id]}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Only brouillon deleted
        self.assertTrue(Facture.objects.filter(pk=f_val.pk).exists())
        self.assertFalse(Facture.objects.filter(pk=f_brou.pk).exists())

    def test_bulk_delete_no_ids(self):
        """Bulk delete with empty ID list returns 400."""
        url = reverse('facture-bulk-delete')
        response = self.client.post(url, {'ids': []}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class StatsJourTests(APITestCase):
    """Tests for the 'stats_jour' action."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.rayon = TestDataFactory.create_rayon(name='Rayon Stats')
        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Fournisseur Stats',
            email='stats-fournisseur@test.com',
            phone='0100000001'
        )

    def test_stats_jour_empty(self):
        """stats_jour with no sales returns null top_vendeur and top_produit."""
        url = reverse('facture-stats-jour')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['top_vendeur'])
        self.assertIsNone(response.data['top_produit'])

    def test_stats_jour_with_sales(self):
        """stats_jour returns top seller and top product from today's sales."""
        client_stats = TestDataFactory.create_client(
            name='Client Stats', email='clientstats@test.com', phone='0600000001'
        )
        produit1 = TestDataFactory.create_produit(
            name='Amoxicilline', stock=200,
            cost_price=100, selling_price=300,
            rayon=self.rayon, fournisseur=self.fournisseur
        )
        produit2 = TestDataFactory.create_produit(
            name='Ibuprofène', stock=100,
            cost_price=50, selling_price=150,
            rayon=self.rayon, fournisseur=self.fournisseur
        )

        # Create validated invoice with products
        facture = TestDataFactory.create_facture(
            client=client_stats, status='VAL',
            total_ttc=Decimal('1200.00'), created_by=self.user
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=produit1, quantity=3, selling_price=Decimal('300')
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=produit2, quantity=1, selling_price=Decimal('150')
        )

        url = reverse('facture-stats-jour')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data['top_vendeur'])
        self.assertIsNotNone(response.data['top_produit'])
        # Top produit should be Amoxicilline (qty=3 > qty=1)
        self.assertEqual(response.data['top_produit']['name'], 'Amoxicilline')
        self.assertEqual(response.data['top_produit']['quantity'], 3)


class HistoriqueVentesTests(APITestCase):
    """Tests for HistoriqueVentesViewSet."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.rayon = TestDataFactory.create_rayon(name='Rayon Hist')
        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Fournisseur Hist',
            email='hist-fournisseur@test.com',
            phone='0100000002'
        )
        self.client_obj = TestDataFactory.create_client(
            name='Client Hist', email='clienthist@test.com', phone='0600000002'
        )

    def test_historique_list(self):
        """List returns aggregated daily data for validated invoices."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='VAL',
            total_ttc=Decimal('5000'), total_ht=Decimal('4200'),
            total_tva=Decimal('800')
        )

        url = reverse('historiqueventes-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # HistoriqueVentesViewSet.list returns a dict {count, results, totals}
        self.assertIn('results', response.data)
        self.assertGreaterEqual(len(response.data['results']), 1)

        day_data = response.data['results'][0]
        self.assertIn('nb_ventes', day_data)
        self.assertIn('ca_ttc', day_data)

    def test_ventes_par_tranche_with_dates(self):
        """ventes_par_tranche returns product-level data for a given range."""
        produit = TestDataFactory.create_produit(
            name='Paracétamol', stock=100,
            cost_price=30, selling_price=80,
            rayon=self.rayon, fournisseur=self.fournisseur
        )
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='VAL'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=produit, quantity=5, selling_price=Decimal('80')
        )

        now = timezone.now()
        debut = (now - timezone.timedelta(hours=2)).isoformat()
        fin = (now + timezone.timedelta(hours=1)).isoformat()

        url = reverse('historiqueventes-ventes-par-tranche')
        response = self.client.get(url, {'date_debut': debut, 'date_fin': fin})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have at least the product row + TOTAL row
        self.assertGreaterEqual(len(response.data), 2)

        # Last row should be TOTAL
        total_row = response.data[-1]
        self.assertEqual(total_row['nom'], 'TOTAL')


class CalculateTotalsTests(TestCase):
    """Tests for the Facture.calculate_totals model method."""

    def setUp(self):
        self.client_obj = TestDataFactory.create_client(
            name='Client Calc', email='clientcalc@test.com', phone='0600000003'
        )
        self.produit = TestDataFactory.create_produit(
            name='Produit Calc', selling_price=1000, cost_price=500
        )

    def test_totals_simple(self):
        """calculate_totals with a single line, no TVA, no discount."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=3, selling_price=Decimal('1000')
        )

        facture.refresh_from_db()
        self.assertEqual(facture.total_ttc, Decimal('3000.00'))

    def test_totals_with_global_discount(self):
        """calculate_totals subtracts the global discount (remise)."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU', remise=Decimal('500')
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=2, selling_price=Decimal('1000')
        )

        facture.refresh_from_db()
        # 2 * 1000 - 500 = 1500
        self.assertEqual(facture.total_ttc, Decimal('1500.00'))

    def test_totals_with_line_discount(self):
        """calculate_totals accounts for per-line discount on units."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=5, selling_price=Decimal('1000'),
            discount=Decimal('100')  # 100 F off each unit
        )

        facture.refresh_from_db()
        # 5 * (1000 - 100) = 4500
        self.assertEqual(facture.total_ttc, Decimal('4500.00'))

    def test_totals_with_tva(self):
        """calculate_totals properly separates HT/TVA/TTC."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=1, selling_price=Decimal('1192.50'),
            tva=Decimal('19.25')
        )

        facture.refresh_from_db()
        # TTC = 1192.50, HT = 1192.50 / 1.1925 = 1000.00, TVA = 192.50
        self.assertEqual(facture.total_ttc, Decimal('1192.50'))
        self.assertEqual(facture.total_ht, Decimal('1000.00'))
        self.assertEqual(facture.total_tva, Decimal('192.50'))

    def test_part_client_with_coverage(self):
        """calculate_totals sets part_client based on taux_couverture."""
        insured_client = TestDataFactory.create_client(
            name='Client Assuré', taux_couverture=Decimal('80'),
            email='assure@test.com', phone='0600000004'
        )
        facture = TestDataFactory.create_facture(
            client=insured_client, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=1, selling_price=Decimal('1000')
        )

        facture.refresh_from_db()
        # Client pays 20% of 1000 = 200
        self.assertEqual(facture.part_client, Decimal('200.00'))


class AnnulationTests(APITestCase):
    """Tests for the 'annuler' action edge cases."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client(
            name='Client Annul', email='annul@test.com', phone='0600000005'
        )
        self.rayon = TestDataFactory.create_rayon(name='Rayon Annul')
        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Fournisseur Annul',
            email='annul-fournisseur@test.com',
            phone='0100000003'
        )
        self.produit = TestDataFactory.create_produit(
            name='Amoxicilline', stock=80,
            cost_price=100, selling_price=250,
            rayon=self.rayon, fournisseur=self.fournisseur
        )

    def test_annuler_already_cancelled(self):
        """Cancelling an already cancelled invoice returns 400."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='ANN'
        )
        url = reverse('facture-annuler', kwargs={'pk': facture.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_annuler_creates_mouvement_stock(self):
        """Cancelling a validated invoice creates stock return movements."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=5, selling_price=Decimal('250')
        )

        # Validate first
        val_url = reverse('facture-valider', kwargs={'pk': facture.pk})
        self.client.post(val_url, {'mode_paiement': 'especes'})

        initial_movements = MouvementStock.objects.count()

        # Cancel
        ann_url = reverse('facture-annuler', kwargs={'pk': facture.pk})
        response = self.client.post(ann_url, {'motif': 'Erreur de saisie'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Stock return movement should be created
        new_movements = MouvementStock.objects.count() - initial_movements
        self.assertGreaterEqual(new_movements, 1)

    def test_annuler_restores_lot_quantities(self):
        """Cancelling restores FIFO lot remaining quantities."""
        lot = TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=80, lot_name='LOT-ANN-TEST'
        )
        self.produit.stock = 80
        self.produit.save()

        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture, produit=self.produit,
            quantity=15, selling_price=Decimal('250')
        )

        # Validate
        val_url = reverse('facture-valider', kwargs={'pk': facture.pk})
        self.client.post(val_url, {'mode_paiement': 'especes'})

        lot.refresh_from_db()
        self.assertEqual(lot.quantity_remaining, 65)

        # Cancel
        ann_url = reverse('facture-annuler', kwargs={'pk': facture.pk})
        self.client.post(ann_url)

        lot.refresh_from_db()
        self.assertEqual(lot.quantity_remaining, 80, "Lot should be fully restored")


class CaisseCappingTests(APITestCase):
    """Tests for the backend safeguard capping payment amounts."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client(name='Patient Test')

    def test_caisse_payment_capped_to_invoice_total(self):
        """CaisseViewSet.perform_create caps the amount to the invoice total."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='VAL', total_ttc=Decimal('1000')
        )
        url = reverse('caisse-list')
        payload = {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '1500', # Excessive amount
            'statut': 'completee'
        }
        response = self.client.post(url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that the amount was capped to 1000
        payment = Caisse.objects.get(id=response.data['id'])
        self.assertEqual(payment.montant, Decimal('1000.00'))

    def test_caisse_payment_capped_to_part_patient(self):
        """CaisseViewSet.perform_create caps the amount to the part_client for insured clients."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='VAL', total_ttc=Decimal('1000'),
            part_client=Decimal('200')
        )
        # Record the insurance part as 'en_compte'
        Caisse.objects.create(
            facture=facture, mode_paiement='en_compte', montant=Decimal('800'),
            statut='completee', user=self.user
        )
        
        url = reverse('caisse-list')
        payload = {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '500', # Excessive amount (more than 200)
            'statut': 'completee'
        }
        response = self.client.post(url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that the amount was capped to 200
        payment = Caisse.objects.get(id=response.data['id'])
        self.assertEqual(payment.montant, Decimal('200.00'))

    def test_caisse_payment_partial_capped(self):
        """Subsequent payments are also capped to the remaining balance."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj, status='VAL', total_ttc=Decimal('1000')
        )
        # First payment of 600
        Caisse.objects.create(
            facture=facture, mode_paiement='especes', montant=Decimal('600'),
            statut='completee', user=self.user
        )
        
        url = reverse('caisse-list')
        payload = {
            'facture': facture.id,
            'mode_paiement': 'carte',
            'montant': '700', # Excessive amount (more than 400 remaining)
            'statut': 'completee'
        }
        response = self.client.post(url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that the amount was capped to 400
        payment = Caisse.objects.get(id=response.data['id'])
        self.assertEqual(payment.montant, Decimal('400.00'))

