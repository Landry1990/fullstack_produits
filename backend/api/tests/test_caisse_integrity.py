from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Caisse, ClotureCaisse, Facture, MouvementCaisse


class CaisseIntegrityTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='password', email='admin@test.com')
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)
        
        # 1. Facture payée en espèces (1000F)
        self.facture1 = Facture.objects.create(
            total_ttc=Decimal('1000.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user
        )
        Caisse.objects.create(
            facture=self.facture1,
            montant=Decimal('1000.00'),
            mode_paiement='especes',
            statut='completee',
            user=self.user
        )

        # 2. Facture de recouvrement de créance (500F payé aujourd'hui pour une dette passée)
        self.facture2 = Facture.objects.create(
            total_ttc=Decimal('5000.00'),
            status=Facture.Status.VALIDEE,
            created_by=self.user
        )
        # On simule un paiement de type recouvrement (indépendant de la vente du jour)
        Caisse.objects.create(
            facture=self.facture2,
            montant=Decimal('500.00'),
            mode_paiement='especes',
            reference='[RECOUV] Paiement partiel',
            statut='completee',
            user=self.user
        )

        # 3. Une sortie de caisse (200F)
        MouvementCaisse.objects.create(
            type='SORTIE',
            montant=Decimal('200.00'),
            motif='Achat café',
            user=self.user
        )

    def test_encaissements_par_mode_consolidated(self):
        """Vérifie que les détails par mode incluent ventes + recouvrements."""
        
        # 1. Vente OM (1000F)
        f_om = Facture.objects.create(total_ttc=Decimal('1000.00'), status=Facture.Status.PAYEE, created_by=self.user)
        Caisse.objects.create(facture=f_om, montant=Decimal('1000.00'), mode_paiement='om', statut='completee', user=self.user)
        
        # 2. Recouvrement OM (500F)
        f_debt = Facture.objects.create(total_ttc=Decimal('5000.00'), status=Facture.Status.VALIDEE, created_by=self.user)
        Caisse.objects.create(facture=f_debt, montant=Decimal('500.00'), mode_paiement='om', reference='[RECOUV]', statut='completee', user=self.user)
        
        # Action : Récupérer les totaux
        url = '/api/caisse/get_totals/'
        response = self.client_api.get(url)
        data = response.data
        
        # Le détail OM actuel renverrait 1000F (que la vente). 
        # On VEUT 1500F (Vente + Recouvrement).
        self.assertEqual(float(data['details']['om']), 1500.00, 
                         f"Erreur: le détail OM est de {data['details']['om']} au lieu de 1500F (1000 vente + 500 recouvrement)")


class CaisseMultiModeIntegrityTest(TestCase):
    """Tests de cohérence des totaux caisse avec multi-modes, recouvrement et avoir."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='admin_multi', password='password', email='admin_multi@test.com'
        )
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)

    def test_session_multi_modes_recouvrement_avoir_totaux_coherents(self):
        """
        Une session caisse avec paiements multi-modes (especes + carte + momo),
        un recouvrement de dette client, et un avoir (coupon) doit produire
        des totaux coherents par mode dans get_totals.
        """
        # 1. Vente multi-modes: facture de 3000F payee en especes 1000 + carte 1000 + momo 1000
        f_vente = Facture.objects.create(
            total_ttc=Decimal('3000.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user,
        )
        Caisse.objects.create(
            facture=f_vente, montant=Decimal('1000.00'),
            mode_paiement='especes', statut='completee', user=self.user,
        )
        Caisse.objects.create(
            facture=f_vente, montant=Decimal('1000.00'),
            mode_paiement='carte', statut='completee', user=self.user,
        )
        Caisse.objects.create(
            facture=f_vente, montant=Decimal('1000.00'),
            mode_paiement='momo', statut='completee', user=self.user,
        )

        # 2. Recouvrement de dette client: 500F en especes
        f_dette = Facture.objects.create(
            total_ttc=Decimal('5000.00'),
            status=Facture.Status.VALIDEE,
            created_by=self.user,
        )
        Caisse.objects.create(
            facture=f_dette, montant=Decimal('500.00'),
            mode_paiement='especes', reference='[RECOUV] Paiement dette',
            statut='completee', user=self.user,
        )

        # 3. Avoir / retour: coupon de 200F (mode coupon)
        f_avoir = Facture.objects.create(
            total_ttc=Decimal('200.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user,
        )
        Caisse.objects.create(
            facture=f_avoir, montant=Decimal('200.00'),
            mode_paiement='coupon', statut='completee', user=self.user,
        )

        # Action : recuperer les totaux
        url = '/api/caisse/get_totals/'
        response = self.client_api.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        details = data['details']

        # Especes: 1000 (vente) + 500 (recouvrement) = 1500
        self.assertEqual(
            float(details['especes']), 1500.00,
            f"especes devrait etre 1500 (1000 vente + 500 recouvrement), "
            f"got {details['especes']}"
        )
        # Carte: 1000 (vente uniquement)
        self.assertEqual(
            float(details['carte']), 1000.00,
            f"carte devrait etre 1000, got {details['carte']}"
        )
        # Momo: 1000 (vente uniquement)
        self.assertEqual(
            float(details['momo']), 1000.00,
            f"momo devrait etre 1000, got {details['momo']}"
        )
        # Coupon (avoir): doit apparaitre en negatif (-200)
        self.assertEqual(
            float(details['coupon']), -200.00,
            f"coupon (avoir) devrait etre -200, got {details['coupon']}"
        )

        # total_ventes doit exclure le recouvrement mais inclure les ventes
        # Les ventes = 3000 (facture de vente) + 200 (avoir/coupon, negatif)
        # Le recouvrement est compte separement dans total_recouvrement
        total_ventes = float(data['total_ventes'])
        total_recouv = float(data['total_recouvrement'])
        self.assertGreaterEqual(
            total_ventes, 3000.00,
            f"total_ventes devrait inclure les 3000F de ventes, got {total_ventes}"
        )
        self.assertEqual(
            total_recouv, 500.00,
            f"total_recouvrement devrait etre 500, got {total_recouv}"
        )

    def test_avoir_retour_impacte_negativement_total_mode_original(self):
        """
        Un avoir/retour (mode coupon) doit impacter negativement le total
        caisse dans les details par mode. Le total theorique doit aussi
        refleter cette reduction.
        """
        # 1. Vente en especes: 1000F
        f_vente = Facture.objects.create(
            total_ttc=Decimal('1000.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user,
        )
        Caisse.objects.create(
            facture=f_vente, montant=Decimal('1000.00'),
            mode_paiement='especes', statut='completee', user=self.user,
        )

        # 2. Avoir / retour: 300F en coupon (negatif dans les totaux)
        f_avoir = Facture.objects.create(
            total_ttc=Decimal('300.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user,
        )
        Caisse.objects.create(
            facture=f_avoir, montant=Decimal('300.00'),
            mode_paiement='coupon', statut='completee', user=self.user,
        )

        # Recuperer les totaux
        url = '/api/caisse/get_totals/'
        response = self.client_api.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        details = data['details']

        # Le coupon doit apparaitre en negatif
        self.assertIn('coupon', details, "Le mode coupon doit apparaitre dans les details")
        self.assertEqual(
            float(details['coupon']), -300.00,
            f"Le coupon (avoir) doit etre -300, got {details['coupon']}"
        )

        # Le total_coupons doit etre negatif (-300) — l'avoir reduit le CA coupon
        total_coupons = float(data.get('total_coupons', 0))
        self.assertEqual(
            total_coupons, -300.00,
            f"Le total_coupons doit etre -300 (avoir), got {total_coupons}"
        )


class FactureClotureIntegrityTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username='admin_cloture', password='password', email='admin_cloture@test.com'
        )
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)

    def _create_paid_invoice(self, invoice_date):
        facture = Facture.objects.create(
            total_ttc=Decimal('1000.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user,
        )
        Facture.objects.filter(pk=facture.pk).update(date=invoice_date)
        facture.refresh_from_db()
        return facture

    def _close_period_around(self, invoice_date):
        return ClotureCaisse.objects.create(
            montant_reel=Decimal('1000.00'),
            montant_theorique=Decimal('1000.00'),
            date_debut=invoice_date - timedelta(hours=1),
            date_fin=invoice_date + timedelta(hours=1),
            user=self.user,
            cloture_par=self.user,
        )

    def test_annulation_refusee_apres_cloture(self):
        yesterday = timezone.now() - timedelta(days=1)
        facture = self._create_paid_invoice(yesterday)
        self._close_period_around(yesterday)

        response = self.client_api.post(f'/api/factures/{facture.id}/annuler/', {}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['detail'],
            "Impossible d'annuler cette facture : la période de caisse est déjà clôturée. Utilisez un avoir client.",
        )

    def test_modification_refusee_apres_cloture(self):
        yesterday = timezone.now() - timedelta(days=1)
        facture = self._create_paid_invoice(yesterday)
        self._close_period_around(yesterday)

        response = self.client_api.post(f'/api/factures/{facture.id}/modifier/', {}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data['detail'],
            "Impossible de modifier cette facture : la période de caisse est déjà clôturée. Utilisez un avoir client.",
        )

    def test_annulation_autorisee_avant_cloture(self):
        facture = self._create_paid_invoice(timezone.now())

        response = self.client_api.post(f'/api/factures/{facture.id}/annuler/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.ANNULEE)
