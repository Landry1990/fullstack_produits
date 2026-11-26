from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Caisse, CouponMonnaie, Facture, PosteCaisse, PosteVente
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


class CancelledInvoicePaymentGuardTests(APITestCase):
    """L'API caisse refuse d'encaisser une facture annulée/supprimée.

    Régression : un rappel de vente annule la facture, mais la file caisse
    pouvait rester affichée (polling 30 s) — un clic « encaisser » créait un
    paiement 'completee' sur une facture ANNULEE (écart de caisse).
    """

    def setUp(self):
        from api.models import PosteVente
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        PosteVente.objects.create(vendeur=self.user, est_actif=True)

    def test_payment_on_cancelled_invoice_is_rejected(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.ANNULEE,
            total_ttc=Decimal('1000.00'),
        )

        response = self.client.post(reverse('caisse-list'), {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '1000',
            'statut': 'completee',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Caisse.objects.filter(facture=facture).exists())

    def test_payment_on_inactive_invoice_is_rejected(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
        )
        facture.is_active = False
        facture.save(update_fields=['is_active'])

        response = self.client.post(reverse('caisse-list'), {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '1000',
            'statut': 'completee',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Caisse.objects.filter(facture=facture).exists())

    def test_bulk_payment_on_cancelled_invoice_is_rejected(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.ANNULEE,
            total_ttc=Decimal('1000.00'),
        )

        response = self.client.post(reverse('caisse-bulk-create'), {
            'items': [{
                'facture': facture.id,
                'mode_paiement': 'especes',
                'montant': '1000',
                'statut': 'completee',
            }],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Caisse.objects.filter(facture=facture).exists())

    def test_payment_on_pending_invoice_still_accepted(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
        )

        response = self.client.post(reverse('caisse-list'), {
            'facture': facture.id,
            'mode_paiement': 'especes',
            'montant': '1000',
            'statut': 'completee',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Caisse.objects.filter(facture=facture).exists())

    def test_bulk_payment_same_key_creates_payments_and_uses_coupon_once(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
        )
        coupon = CouponMonnaie.objects.create(
            numero='CPN-IDEM-1', montant=Decimal('200.00'), cree_par=self.user,
        )
        payload = {
            'items': [
                {'facture': facture.id, 'mode_paiement': 'coupon', 'montant': '200', 'statut': 'completee'},
                {'facture': facture.id, 'mode_paiement': 'especes', 'montant': '800', 'statut': 'completee'},
            ],
            'coupon_numero': coupon.numero,
            'ticket': {'montant_verse': '800', 'montant_rendu': '0'},
        }
        headers = {'HTTP_IDEMPOTENCY_KEY': 'cash-bulk-idem-1'}

        response1 = self.client.post(reverse('caisse-bulk-create'), payload, format='json', **headers)
        response2 = self.client.post(reverse('caisse-bulk-create'), payload, format='json', **headers)

        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Caisse.objects.filter(facture=facture).count(), 2)
        coupon.refresh_from_db()
        facture.refresh_from_db()
        self.assertEqual(coupon.status, CouponMonnaie.Status.UTILISE)
        self.assertEqual(coupon.facture_utilisation, facture)
        self.assertEqual(facture.status, Facture.Status.PAYEE)
        self.assertEqual(facture.montant_verse, Decimal('800'))

    def test_bulk_payment_rolls_back_all_items_when_one_is_invalid(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
        )
        payload = {'items': [
            {'facture': facture.id, 'mode_paiement': 'especes', 'montant': '500', 'statut': 'completee'},
            {'facture': facture.id, 'mode_paiement': 'momo', 'montant': '-1', 'statut': 'completee'},
        ]}

        response = self.client.post(
            reverse('caisse-bulk-create'), payload, format='json',
            HTTP_IDEMPOTENCY_KEY='cash-bulk-rollback-1',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Caisse.objects.filter(facture=facture).exists())

    def test_bulk_payment_invalid_ticket_writes_nothing(self):
        facture = TestDataFactory.create_facture(
            status=Facture.Status.VALIDEE,
            total_ttc=Decimal('1000.00'),
        )
        payload = {
            'items': [
                {'facture': facture.id, 'mode_paiement': 'especes', 'montant': '1000', 'statut': 'completee'},
            ],
            'ticket': {'montant_verse': 'NaN', 'montant_rendu': '0'},
        }

        response = self.client.post(
            reverse('caisse-bulk-create'), payload, format='json',
            HTTP_IDEMPOTENCY_KEY='cash-bulk-invalid-ticket-1',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Caisse.objects.filter(facture=facture).exists())
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.VALIDEE)


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


class RecapSessionMobileSalesTests(APITestCase):
    """Le ruban « Récap caisse » doit compter les ventes envoyées à la caisse
    depuis un poste sans caisse (app mobile-facturation, web centralisé) —
    critère facture.poste_caisse comme la clôture, pas seulement poste_vente."""

    def setUp(self):
        self.caissiere = TestDataFactory.create_superuser()
        self.vendeur_pda = TestDataFactory.create_user(username='pda-vendeur')
        self.caisse = PosteCaisse.objects.create(nom='Caisse principale')
        self.poste_caisse = PosteVente.objects.create(
            nom='Poste caisse', caisse=self.caisse, vendeur=self.caissiere,
            est_actif=True, date_ouverture=timezone.now() - timedelta(hours=1),
        )
        self.poste_pda = PosteVente.objects.create(
            nom='PDA vendeur', vendeur=self.vendeur_pda, est_actif=True,
            date_ouverture=timezone.now() - timedelta(hours=1),
        )
        self.client.force_authenticate(self.caissiere)

    def _encaisser(self, facture, montant):
        return Caisse.objects.create(
            facture=facture, mode_paiement='especes', montant=montant,
            statut='completee', user=self.caissiere)

    def test_vente_mobile_comptee_dans_le_recap(self):
        # Vente prise sur PDA : poste_vente = poste vendeur, poste_caisse =
        # caisse qui encaissera — le ruban de cette caisse doit la compter.
        facture_mobile = TestDataFactory.create_facture(status=Facture.Status.VALIDEE)
        Facture.objects.filter(pk=facture_mobile.pk).update(
            poste_vente=self.poste_pda, poste_caisse=self.caisse)
        self._encaisser(facture_mobile, Decimal('3750'))

        # Vente directe à la caisse : les deux doivent figurer.
        facture_directe = TestDataFactory.create_facture(status=Facture.Status.VALIDEE)
        Facture.objects.filter(pk=facture_directe.pk).update(
            poste_vente=self.poste_caisse, poste_caisse=self.caisse)
        self._encaisser(facture_directe, Decimal('2000'))

        response = self.client.get('/api/postes-ventes/recap_session/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['has_session'])
        self.assertEqual(Decimal(str(response.data['total_encaisse'])), Decimal('5750'))
        self.assertEqual(response.data['nb_transactions'], 2)
        self.assertEqual(Decimal(str(response.data['details_par_mode']['especes'])), Decimal('5750'))

    def test_vente_mobile_pas_comptee_chez_le_vendeur(self):
        # Attribution unique : la vente routée vers la caisse ne doit PAS
        # apparaître dans le ruban du poste vendeur (sinon double comptage
        # entre les deux récaps).
        facture_mobile = TestDataFactory.create_facture(status=Facture.Status.VALIDEE)
        Facture.objects.filter(pk=facture_mobile.pk).update(
            poste_vente=self.poste_pda, poste_caisse=self.caisse)
        self._encaisser(facture_mobile, Decimal('3750'))

        self.client.force_authenticate(self.vendeur_pda)
        response = self.client.get('/api/postes-ventes/recap_session/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['has_session'])
        self.assertEqual(Decimal(str(response.data['total_encaisse'])), Decimal('0'))
        self.assertEqual(response.data['nb_transactions'], 0)
