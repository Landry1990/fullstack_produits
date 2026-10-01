"""
Tests pour CreanceViewSet — gestion des créances (ventes en compte).

Couvre :
- Liste des créances en cours (remainder > 0)
- Historique (factures soldées ayant eu un paiement 'en_compte')
- Filtres client_id / date_debut / date_fin
- Actions : totals, synthese_clients, export_excel, imprimer_recu
- Permissions (non authentifié refusé)
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Caisse, Facture
from api.tests.factories import TestDataFactory


class CreancesTestCase(TestCase):
    """Base : admin authentifié + client + factures de test."""

    def setUp(self):
        self.api = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_creances')
        self.api.force_authenticate(user=self.user)
        self.client_a = self.factory.create_client(name='Assurance A')
        self.client_b = self.factory.create_client(name='Client B')

    # ------------------------------------------------------------------
    # Helpers

    def _creance(self, client=None, total=10000, status_=Facture.Status.VALIDEE):
        """Facture validée non payée -> créance."""
        return self.factory.create_facture(client=client, status=status_, total_ttc=Decimal(total))

    def _pay(self, facture, montant, mode='especes'):
        return self.factory.create_caisse(facture=facture, montant=montant, mode_paiement=mode)

    def _list_ids(self, response):
        payload = response.data
        results = payload.get('results', payload) if isinstance(payload, dict) else payload
        return {item['id'] for item in results}

    # ------------------------------------------------------------------
    # Liste

    def test_list_retourne_facture_impayee(self):
        f = self._creance(client=self.client_a, total=10000)
        response = self.api.get('/api/creances/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(f.id, self._list_ids(response))

    def test_list_exclut_facture_soldee(self):
        f = self._creance(client=self.client_a, total=10000)
        self._pay(f, 10000)
        response = self.api.get('/api/creances/')
        self.assertNotIn(f.id, self._list_ids(response))

    def test_list_paiement_partiel(self):
        f = self._creance(client=self.client_a, total=10000)
        self._pay(f, 4000)
        response = self.api.get('/api/creances/')
        self.assertIn(f.id, self._list_ids(response))

    def test_paiement_en_compte_ne_solde_pas_la_creance(self):
        """Un paiement 'en_compte' enregistre la dette — il ne la règle pas."""
        f = self._creance(client=self.client_a, total=10000)
        self._pay(f, 10000, mode='en_compte')
        response = self.api.get('/api/creances/')
        self.assertIn(f.id, self._list_ids(response))

    def test_list_exclut_brouillons_et_annulees(self):
        brouillon = self._creance(client=self.client_a, status_=Facture.Status.BROUILLON)
        annulee = self._creance(client=self.client_a, status_=Facture.Status.ANNULEE)
        response = self.api.get('/api/creances/')
        ids = self._list_ids(response)
        self.assertNotIn(brouillon.id, ids)
        self.assertNotIn(annulee.id, ids)

    # ------------------------------------------------------------------
    # Historique

    def test_history_retourne_factures_soldees_ex_en_compte(self):
        """Historique = factures soldées qui avaient été mises en compte."""
        f = self._creance(client=self.client_a, total=10000)
        self._pay(f, 10000, mode='en_compte')   # mise en compte
        self._pay(f, 10000)                     # règlement réel
        response = self.api.get('/api/creances/?history=true')
        self.assertIn(f.id, self._list_ids(response))
        # …et absente de la liste courante
        self.assertNotIn(f.id, self._list_ids(self.api.get('/api/creances/')))

    # ------------------------------------------------------------------
    # Filtres

    def test_filtre_client_id(self):
        fa = self._creance(client=self.client_a)
        fb = self._creance(client=self.client_b)
        response = self.api.get(f'/api/creances/?client_id={self.client_a.id}')
        ids = self._list_ids(response)
        self.assertIn(fa.id, ids)
        self.assertNotIn(fb.id, ids)

    def test_filtre_dates(self):
        vieille = self._creance(client=self.client_a)
        recente = self._creance(client=self.client_a)
        # Backdater une facture (auto_now_add → update direct)
        Facture.objects.filter(pk=vieille.pk).update(
            date=timezone.now() - timedelta(days=60)
        )
        debut = (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        response = self.api.get(f'/api/creances/?date_debut={debut}')
        ids = self._list_ids(response)
        self.assertIn(recente.id, ids)
        self.assertNotIn(vieille.id, ids)

    def test_filtre_dates_invalides_rejetees(self):
        """Dates de filtre invalides → 400 (P2) au lieu d'être ignorées
        silencieusement (résultats non filtrés trompeurs)."""
        self._creance(client=self.client_a)
        response = self.api.get('/api/creances/?date_debut=pas-une-date&date_fin=xx')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Actions

    def test_totals(self):
        self._creance(client=self.client_a, total=10000)
        f2 = self._creance(client=self.client_b, total=5000)
        self._pay(f2, 2000)  # reste 3000
        response = self.api.get('/api/creances/totals/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(Decimal(str(response.data['total_reste'])), Decimal('13000'))

    def test_totals_vide(self):
        response = self.api.get('/api/creances/totals/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(Decimal(str(response.data['total_reste'])), Decimal('0'))

    def test_synthese_clients_regroupe_par_client(self):
        self._creance(client=self.client_a, total=10000)
        f2 = self._creance(client=self.client_a, total=6000)
        self._pay(f2, 1000)  # reste 5000 pour A
        self._creance(client=self.client_b, total=3000)

        response = self.api.get('/api/creances/synthese_clients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_client = {item['client']: item for item in response.data}
        self.assertEqual(Decimal(str(by_client['Assurance A']['solde_du'])), Decimal('15000'))
        self.assertEqual(by_client['Assurance A']['nb_factures'], 2)
        self.assertEqual(Decimal(str(by_client['Client B']['solde_du'])), Decimal('3000'))
        # Tri décroissant par solde dû
        self.assertEqual(response.data[0]['client'], 'Assurance A')

    def test_synthese_exclut_factures_sans_client(self):
        # La factory crée un client si None — on crée la facture directement
        Facture.objects.create(status=Facture.Status.VALIDEE, total_ttc=Decimal('9000'), client=None)
        self._creance(client=self.client_a, total=5000)
        response = self.api.get('/api/creances/synthese_clients/')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['client'], 'Assurance A')

    def test_export_excel(self):
        self._creance(client=self.client_a, total=10000)
        response = self.api.get('/api/creances/export_excel/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertIn('creances_', response['Content-Disposition'])
        self.assertTrue(response.content[:2] == b'PK')  # xlsx = zip

    def test_imprimer_recu(self):
        f = self._creance(client=self.client_a, total=10000)
        self._pay(f, 4000)
        response = self.api.get(f'/api/creances/{f.id}/imprimer_recu/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_imprimer_recu_sans_paiement(self):
        f = self._creance(client=self.client_a, total=10000)
        response = self.api.get(f'/api/creances/{f.id}/imprimer_recu/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_imprimer_recu_paiement_invalide(self):
        f = self._creance(client=self.client_a, total=10000)
        self._pay(f, 4000)
        response = self.api.get(f'/api/creances/{f.id}/imprimer_recu/?paiement_id=99999')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_detail(self):
        f = self._creance(client=self.client_a, total=7000)
        self._pay(f, 2000)
        response = self.api.get(f'/api/creances/{f.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], f.id)

    # ------------------------------------------------------------------
    # Permissions

    def test_non_authentifie_refuse(self):
        api = APIClient()
        response = api.get('/api/creances/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
