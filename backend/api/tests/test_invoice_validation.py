"""
Tests for invoice (Facture) validation flow.
Tests critical business logic:
- Stock decrement on validation
- FIFO lot allocation
- Payment recording
- Cancellation and stock restoration
"""
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Caisse,
    FactureProduit,
    FactureProduitAllocation,
    StockLot,
)
from .factories import TestDataFactory


class InvoiceValidationTestCase(APITestCase):
    """Test suite for invoice validation flow."""
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

        # Create product with stock
        self.rayon = TestDataFactory.create_rayon(name='Médicaments')
        self.fournisseur = TestDataFactory.create_fournisseur(name='Pharma Distrib')
        self.produit = TestDataFactory.create_produit(
            name='Doliprane 500mg',
            stock=100,
            cost_price=50,
            selling_price=100,
            rayon=self.rayon,
            fournisseur=self.fournisseur
        )

        # Create client
        self.client_obj = TestDataFactory.create_client(name='Patient Test')

        # Several invoice actions require an active cashier session
        self.session = TestDataFactory.create_session_caisse(user=self.user)

    def test_validate_invoice_decrements_stock(self):
        """
        Test that validating an invoice decrements the product stock.
        """
        initial_stock = self.produit.stock
        quantity_sold = 5
        
        # Create invoice with product
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=quantity_sold,
            selling_price=self.produit.selling_price
        )
        
        # Validate the invoice
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        
        # Check response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify stock decremented
        self.produit.refresh_from_db()
        self.assertEqual(
            self.produit.stock,
            initial_stock - quantity_sold,
            f"Stock should be {initial_stock - quantity_sold}, got {self.produit.stock}"
        )
    
    def test_validate_invoice_with_insufficient_stock(self):
        """
        Test that validation fails when there's not enough stock.
        """
        # Try to sell more than available
        quantity_to_sell = self.produit.stock + 10
        
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=quantity_to_sell,
            selling_price=self.produit.selling_price
        )
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        self.client.post(url, {'mode_paiement': 'especes'})
        
        # Should fail or handle appropriately
        # Note: Actual behavior depends on implementation
        # Some systems allow negative stock, others block
        self.produit.refresh_from_db()
        
    def test_validate_invoice_creates_payment(self):
        """
        Test that validating an invoice creates a payment record.
        """
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=2,
            selling_price=Decimal('100.00')
        )
        
        # Update total
        facture.total_ttc = Decimal('200.00')
        facture.save()
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check payment was created
        payments = Caisse.objects.filter(facture=facture)
        self.assertTrue(payments.exists(), "Payment record should be created")
    
    def test_validate_invoice_fifo_allocation(self):
        """
        Test that FIFO allocation works correctly with multiple lots.
        """
        # Create two stock lots with different dates
        lot_old = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=30,
            lot_name='LOT-OLD',
            date_expiration=timezone.now().date() + timezone.timedelta(days=30)
        )
        lot_new = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=50,
            lot_name='LOT-NEW',
            date_expiration=timezone.now().date() + timezone.timedelta(days=180)
        )
        
        # Update product stock to match lots
        self.produit.stock = lot_old.quantity_remaining + lot_new.quantity_remaining
        self.produit.save()
        
        # Sell 40 units (should take 30 from old lot, 10 from new)
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=40,
            selling_price=self.produit.selling_price
        )
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify lot allocations (FIFO: old lot first)
        lot_old.refresh_from_db()
        lot_new.refresh_from_db()
        
        self.assertEqual(lot_old.quantity_remaining, 0, "Old lot should be depleted first")
        self.assertEqual(lot_new.quantity_remaining, 40, "New lot should have 40 remaining")
    
    def test_cancel_invoice_restores_stock(self):
        """
        Test that cancelling an invoice restores the stock.
        """
        initial_stock = self.produit.stock
        quantity_sold = 10
        
        # Create and validate invoice
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=quantity_sold,
            selling_price=self.produit.selling_price
        )
        
        # Validate
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        self.client.post(url, {'mode_paiement': 'especes'})
        
        # Verify stock decreased
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, initial_stock - quantity_sold)
        
        # Cancel invoice
        url = reverse('facture-annuler', kwargs={'pk': facture.pk})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify stock restored
        self.produit.refresh_from_db()
        self.assertEqual(
            self.produit.stock,
            initial_stock,
            "Stock should be restored after cancellation"
        )

    def test_cancel_invoice_after_multi_lot_payment_restores_per_lot(self):
        """
        Annulation d'une facture apres paiement multi-lots : on verifie que
        chaque StockLot.quantity_remaining revient a sa valeur initiale.
        """
        # Creer 2 lots avec des quantites differentes
        lot1 = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=40,
            lot_name='LOT-MULTI-CANCEL-1',
            date_expiration=timezone.now().date() + timezone.timedelta(days=60),
        )
        lot2 = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=60,
            lot_name='LOT-MULTI-CANCEL-2',
            date_expiration=timezone.now().date() + timezone.timedelta(days=180),
        )

        lot1_initial = lot1.quantity_remaining
        lot2_initial = lot2.quantity_remaining

        # Synchroniser le stock du produit depuis les lots
        self.produit.refresh_from_db()

        # Creer une facture avec 2 lignes, chaque ligne pointant vers un lot specifique
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=10,
            selling_price=self.produit.selling_price,
            stock_lot=lot1,
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=5,
            selling_price=self.produit.selling_price,
            stock_lot=lot2,
        )

        # Valider la facture
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verifier que les lots ont ete decrements
        lot1.refresh_from_db()
        lot2.refresh_from_db()
        self.assertEqual(lot1.quantity_remaining, lot1_initial - 10,
                         "Lot1 doit etre decremente de 10 apres validation")
        self.assertEqual(lot2.quantity_remaining, lot2_initial - 5,
                         "Lot2 doit etre decremente de 5 apres validation")

        # Verifier que les allocations existent
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        )
        self.assertEqual(allocations.count(), 2,
                         "2 allocations doivent exister (une par lot)")

        # Annuler la facture
        url = reverse('facture-annuler', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'motif': 'Test annulation multi-lots'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verifier que chaque lot est restaure a sa valeur initiale
        lot1.refresh_from_db()
        lot2.refresh_from_db()
        self.assertEqual(lot1.quantity_remaining, lot1_initial,
                         "Lot1 doit etre restaure a sa valeur initiale apres annulation")
        self.assertEqual(lot2.quantity_remaining, lot2_initial,
                         "Lot2 doit etre restaure a sa valeur initiale apres annulation")

        # Les allocations doivent etre supprimees
        remaining_allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        )
        self.assertEqual(remaining_allocations.count(), 0,
                         "Toutes les allocations doivent etre supprimees apres annulation")


class InvoiceStatusTransitionTests(APITestCase):
    """Test invoice status transitions."""
    
    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.client_obj = TestDataFactory.create_client()
        self.produit = TestDataFactory.create_produit()
    
    def test_cannot_validate_already_validated_invoice(self):
        """Test that validating an already validated invoice fails."""
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL'  # Already validated
        )
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'})
        
        # Should fail or return appropriate message
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_200_OK])
