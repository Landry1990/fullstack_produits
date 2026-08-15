"""
Tests pour les achats de mise en place et le paiement au comptant à la clôture.

Couvre :
- Calcul de l'échéance pour un achat de mise en place (FACTURE et RELEVE).
- Recalcul de l'échéance après modification d'une commande clôturée.
- Achat au comptant (paye_a_la_cloture) : création d'un PaiementFournisseur.
- Idempotence : pas de doublon de paiement si on re-clôture après annulation.
- Exclusion des achats au comptant des dettes fournisseurs.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Commande,
    CommandeProduit,
    PaiementFournisseur,
)
from ..services.supplier_finance import build_supplier_schedule, build_supplier_detailed_schedule
from .factories import TestDataFactory


class MiseEnPlaceEcheanceTestCase(APITestCase):
    """Tests du calcul d'échéance pour les achats de mise en place."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

        self.fournisseur_facture = TestDataFactory.create_fournisseur(
            name='Grossiste FACTURE',
            type_reglement='FACTURE',
            delai_paiement_jours=10,
        )
        self.fournisseur_releve = TestDataFactory.create_fournisseur(
            name='Grossiste RELEVE',
            type_reglement='RELEVE',
            delai_paiement_jours=15,
            periode_releve_jours=10,
        )
        self.rayon = TestDataFactory.create_rayon(name='Rayon MEP')
        self.produit = TestDataFactory.create_produit(
            name='Produit MEP',
            stock=5,
            cost_price=100,
            selling_price=200,
            rayon=self.rayon,
            fournisseur=self.fournisseur_facture,
        )

    def _create_and_close_mise_en_place(self, fournisseur, delai_negocie, paye_a_la_cloture=False):
        """Helper : crée une commande de mise en place et la clôture via l'API."""
        commande = TestDataFactory.create_commande(
            fournisseur=fournisseur,
            status='PREP',
            is_mise_en_place=True,
            delai_paiement_negocie_jours=delai_negocie,
            paye_a_la_cloture=paye_a_la_cloture,
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=10,
            price=200,
            price_cost=100,
        )
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        commande.refresh_from_db()
        return commande

    def test_echeance_mise_en_place_facture(self):
        """Un achat de mise en place chez un fournisseur FACTURE utilise le délai négocié."""
        commande = self._create_and_close_mise_en_place(
            self.fournisseur_facture, delai_negocie=45
        )
        self.assertIsNotNone(commande.date_cloture)
        expected = commande.date_cloture.date() + timedelta(days=45)
        self.assertEqual(commande.date_echeance, expected)

    def test_echeance_mise_en_place_releve(self):
        """Un achat de mise en place chez un fournisseur RELEVE garde une échéance individuelle."""
        commande = self._create_and_close_mise_en_place(
            self.fournisseur_releve, delai_negocie=30
        )
        expected = commande.date_cloture.date() + timedelta(days=30)
        self.assertEqual(commande.date_echeance, expected)

    def test_echeance_paye_a_la_cloture(self):
        """Un achat au comptant a son échéance = date de clôture."""
        commande = self._create_and_close_mise_en_place(
            self.fournisseur_facture, delai_negocie=None, paye_a_la_cloture=True
        )
        self.assertEqual(commande.date_echeance, commande.date_cloture.date())

    def test_recalcul_echeance_apres_modification(self):
        """Modifier le délai négocié d'une commande clôturée recalcule l'échéance."""
        commande = self._create_and_close_mise_en_place(
            self.fournisseur_facture, delai_negocie=20
        )
        old_echeance = commande.date_echeance

        # Modifier le délai négocié et sauvegarder directement
        commande.delai_paiement_negocie_jours = 60
        commande.save()
        commande.refresh_from_db()

        expected = commande.date_cloture.date() + timedelta(days=60)
        self.assertEqual(commande.date_echeance, expected)
        self.assertNotEqual(commande.date_echeance, old_echeance)


class PayeALaClotureTestCase(APITestCase):
    """Tests du paiement automatique au comptant à la clôture."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Grossiste Comptant',
            type_reglement='FACTURE',
            delai_paiement_jours=10,
        )
        self.rayon = TestDataFactory.create_rayon(name='Rayon Comptant')
        self.produit = TestDataFactory.create_produit(
            name='Produit Comptant',
            stock=5,
            cost_price=100,
            selling_price=200,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
        )

    def _create_mise_en_place_commande(self, paye_a_la_cloture=True, delai_negocie=None):
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='PREP',
            is_mise_en_place=True,
            delai_paiement_negocie_jours=delai_negocie,
            paye_a_la_cloture=paye_a_la_cloture,
        )
        TestDataFactory.create_commande_produit(
            commande=commande,
            produit=self.produit,
            quantity=10,
            price=200,
            price_cost=100,
        )
        return commande

    def test_paiement_auto_cree_un_seul_paiement(self):
        """La clôture d'un achat au comptant crée exactement un PaiementFournisseur du montant total."""
        commande = self._create_mise_en_place_commande(paye_a_la_cloture=True)
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        paiements = PaiementFournisseur.objects.filter(fournisseur=self.fournisseur)
        self.assertEqual(paiements.count(), 1)
        paiement = paiements.first()
        self.assertIsNotNone(paiement)
        # Montant total = 10 × 100 (price_cost) = 1000
        self.assertEqual(paiement.montant, Decimal('1000'))
        self.assertIn(commande, paiement.commandes.all())

    def test_pas_de_paiement_auto_si_pas_paye_a_la_cloture(self):
        """Une mise en place classique (crédit) ne crée pas de paiement automatique."""
        commande = self._create_mise_en_place_commande(
            paye_a_la_cloture=False, delai_negocie=30
        )
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.assertEqual(PaiementFournisseur.objects.filter(fournisseur=self.fournisseur).count(), 0)

    def test_idempotence_pas_de_doublon(self):
        """Re-clôturer après annulation de réception ne crée pas un second paiement."""
        commande = self._create_mise_en_place_commande(paye_a_la_cloture=True)
        url_close = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url_close)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(PaiementFournisseur.objects.filter(fournisseur=self.fournisseur).count(), 1)

        # Annuler la réception
        url_cancel = reverse('commande-annuler-reception', kwargs={'pk': commande.pk})
        response = self.client.post(url_cancel)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        # Le paiement automatique doit être supprimé
        self.assertEqual(PaiementFournisseur.objects.filter(fournisseur=self.fournisseur).count(), 0)

        # Re-clôturer
        response = self.client.post(url_close)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        # Un seul paiement à nouveau, pas de doublon
        self.assertEqual(PaiementFournisseur.objects.filter(fournisseur=self.fournisseur).count(), 1)

    def test_achat_comptant_absent_des_dettes(self):
        """Un achat au comptant n'apparaît pas dans les dettes fournisseurs."""
        commande = self._create_mise_en_place_commande(paye_a_la_cloture=True)
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        self.client.post(url)

        # Le schedule ne doit contenir aucune échéance pour ce fournisseur
        schedule = build_supplier_detailed_schedule(self.fournisseur)
        mise_en_place_items = [d for d in schedule if d.get('type_reglement') == 'MISE_EN_PLACE']
        self.assertEqual(len(mise_en_place_items), 0)

    def test_achat_comptant_absent_dashboard(self):
        """Un achat au comptant n'apparaît pas dans l'endpoint supplier_debts."""
        commande = self._create_mise_en_place_commande(paye_a_la_cloture=True)
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        self.client.post(url)

        url_debts = reverse('dashboard-supplier-debts')
        response = self.client.get(url_debts)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [s['name'] for s in response.data['suppliers']]
        self.assertNotIn('Grossiste Comptant', names)

    def test_achat_credit_present_dashboard(self):
        """Une mise en place à crédit apparaît bien dans les dettes."""
        commande = self._create_mise_en_place_commande(
            paye_a_la_cloture=False, delai_negocie=30
        )
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        self.client.post(url)

        url_debts = reverse('dashboard-supplier-debts')
        response = self.client.get(url_debts)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [s['name'] for s in response.data['suppliers']]
        self.assertIn('Grossiste Comptant', names)


class MiseEnPlaceScheduleTestCase(APITestCase):
    """Tests du schedule supplier_finance pour les achats de mise en place."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Grossiste Schedule',
            type_reglement='RELEVE',
            delai_paiement_jours=15,
            periode_releve_jours=10,
        )
        self.rayon = TestDataFactory.create_rayon(name='Rayon Schedule')
        self.produit = TestDataFactory.create_produit(
            name='Produit Schedule',
            stock=5,
            cost_price=100,
            selling_price=200,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
        )

    def _close_commande(self, commande):
        url = reverse('commande-cloturer', kwargs={'pk': commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_schedule_isole_mise_en_place_du_releve(self):
        """Le schedule traite la mise en place individuellement, pas dans une tranche relevé."""
        today = date.today()

        # Commande mise en place (délai négocié 45j)
        commande_mep = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='PREP',
            is_mise_en_place=True,
            delai_paiement_negocie_jours=45,
        )
        TestDataFactory.create_commande_produit(
            commande=commande_mep, produit=self.produit,
            quantity=5, price=200, price_cost=100,
        )
        self._close_commande(commande_mep)
        commande_mep.refresh_from_db()

        # Commande relevé classique
        commande_rel = TestDataFactory.create_commande(
            fournisseur=self.fournisseur,
            status='PREP',
        )
        TestDataFactory.create_commande_produit(
            commande=commande_rel, produit=self.produit,
            quantity=5, price=200, price_cost=100,
        )
        self._close_commande(commande_rel)
        commande_rel.refresh_from_db()

        schedule = build_supplier_detailed_schedule(self.fournisseur)
        mep_items = [d for d in schedule if d.get('type_reglement') == 'MISE_EN_PLACE']
        releve_items = [d for d in schedule if d.get('type_reglement') == 'RELEVE']

        self.assertEqual(len(mep_items), 1)
        self.assertEqual(mep_items[0]['commande_id'], commande_mep.id)
        # L'échéance de la mise en place = date_cloture + 45j
        expected = commande_mep.date_cloture.date() + timedelta(days=45)
        self.assertEqual(mep_items[0]['date_echeance'], expected.isoformat())

        # La commande relevé classique est bien dans une tranche RELEVE
        self.assertEqual(len(releve_items), 1)
