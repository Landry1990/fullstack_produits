from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Caisse, CouponMonnaie, Facture, PosteCaisse
from api.services.payment_service import PaymentService
from api.services.sale_finalizer import SaleFinalizer

from .factories import TestDataFactory


class DirectPaymentEdgeTests(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_user(username='direct-payment-user')
        self.facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
            part_client=Decimal('1000.00'),
        )

    def test_handle_payments_is_idempotent(self):
        payments = [
            {'mode': 'especes', 'montant': '600', 'reference': 'CASH-1'},
            {'mode': 'momo', 'montant': '400', 'reference': 'MOMO-1'},
        ]

        SaleFinalizer._handle_payments(self.facture, payments, self.user)
        SaleFinalizer._handle_payments(self.facture, payments, self.user)

        created = Caisse.objects.filter(facture=self.facture).order_by('id')
        self.assertEqual(created.count(), 2)
        self.assertEqual(sum((p.montant for p in created), Decimal('0')), Decimal('1000'))

    def test_handle_payments_ignores_zero_and_negative_amounts(self):
        SaleFinalizer._handle_payments(
            self.facture,
            [
                {'mode': 'especes', 'montant': '0'},
                {'mode': 'momo', 'montant': '-100'},
            ],
            self.user,
        )

        self.assertFalse(Caisse.objects.filter(facture=self.facture).exists())

    def test_handle_payments_preserves_mode_reference_and_owner(self):
        SaleFinalizer._handle_payments(
            self.facture,
            [{'mode': 'om', 'montant': '1000', 'reference': 'OM-TRANSACTION-42'}],
            self.user,
        )

        payment = Caisse.objects.get(facture=self.facture)
        self.assertEqual(payment.mode_paiement, 'om')
        self.assertEqual(payment.reference, 'OM-TRANSACTION-42')
        self.assertEqual(payment.user, self.user)
        self.assertEqual(payment.statut, 'completee')

    def test_completed_payment_does_not_reopen_cancelled_invoice(self):
        self.facture.status = Facture.Status.ANNULEE
        self.facture.save(update_fields=['status'])
        payment = Caisse.objects.create(
            facture=self.facture,
            mode_paiement='especes',
            montant=Decimal('1000'),
            statut='completee',
            user=self.user,
        )

        PaymentService.process_payment(payment, is_created=True)

        self.facture.refresh_from_db()
        self.assertEqual(self.facture.status, Facture.Status.ANNULEE)


class SplitBillingIdempotencyTests(APITestCase):
    def test_auto_credit_is_created_only_once(self):
        user = TestDataFactory.create_user(username='split-billing-user')
        facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
            part_client=Decimal('400.00'),
        )
        payment = Caisse.objects.create(
            facture=facture,
            mode_paiement='especes',
            montant=Decimal('400.00'),
            statut='completee',
            user=user,
        )

        PaymentService.process_payment(payment, is_created=True)
        PaymentService.process_payment(payment, is_created=True)

        credits = Caisse.objects.filter(
            facture=facture,
            mode_paiement='en_compte',
            statut='completee',
        )
        self.assertEqual(credits.count(), 1)
        self.assertEqual(credits.get().montant, Decimal('600.00'))


class CouponFinalizationEdgeTests(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_user(username='coupon-user')
        self.facture = TestDataFactory.create_facture(status=Facture.Status.BROUILLON)

    def test_active_coupon_is_linked_and_marked_used(self):
        coupon = CouponMonnaie.objects.create(
            numero='COUPON-ACTIVE-001',
            montant=Decimal('500.00'),
            status=CouponMonnaie.Status.ACTIF,
            cree_par=self.user,
        )

        SaleFinalizer._handle_coupon(coupon.numero, self.facture, self.user)

        coupon.refresh_from_db()
        self.assertEqual(coupon.status, CouponMonnaie.Status.UTILISE)
        self.assertEqual(coupon.facture_utilisation, self.facture)
        self.assertEqual(coupon.utilise_par, self.user)
        self.assertIsNotNone(coupon.date_utilisation)

    def test_used_coupon_is_rejected_without_reassignment(self):
        original_facture = TestDataFactory.create_facture(status=Facture.Status.PAYEE)
        coupon = CouponMonnaie.objects.create(
            numero='COUPON-USED-001',
            montant=Decimal('500.00'),
            status=CouponMonnaie.Status.UTILISE,
            cree_par=self.user,
            utilise_par=self.user,
            facture_utilisation=original_facture,
            date_utilisation=timezone.now(),
        )

        with self.assertRaisesRegex(ValueError, "n'est pas actif"):
            SaleFinalizer._handle_coupon(coupon.numero, self.facture, self.user)

        coupon.refresh_from_db()
        self.assertEqual(coupon.facture_utilisation, original_facture)


class CashClosurePostIsolationTests(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_superuser(username='closure-post-user')
        self.client.force_authenticate(user=self.user)
        self.poste_a = PosteCaisse.objects.create(nom='Caisse A', code='CAISSE-A')
        self.poste_b = PosteCaisse.objects.create(nom='Caisse B', code='CAISSE-B')

    def _payment_for_post(self, poste, amount):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.PAYEE,
            total_ttc=amount,
            poste_caisse=poste,
        )
        return TestDataFactory.create_caisse(
            facture=facture,
            montant=amount,
            mode_paiement='especes',
            user=self.user,
        )

    def test_closure_only_includes_selected_physical_register(self):
        self._payment_for_post(self.poste_a, Decimal('700.00'))
        self._payment_for_post(self.poste_b, Decimal('300.00'))
        now = timezone.now()

        response = self.client.post(
            reverse('caisse-cloturer'),
            {
                'date_debut': (now - timedelta(minutes=5)).isoformat(),
                'date_fin': (now + timedelta(minutes=5)).isoformat(),
                'montant_reel': '700.00',
                'user_id': self.user.id,
                'poste_caisse_id': self.poste_a.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(str(response.data['cloture']['total_ventes'])), Decimal('700.00'))
        self.assertEqual(Decimal(str(response.data['cloture']['montant_theorique'])), Decimal('700.00'))
