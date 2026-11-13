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

from api.models import Caisse, Facture, SmsLog
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

    def test_synthese_clients_champs_pilotage(self):
        """plafond, delai, date de dette la plus ancienne et dernier règlement."""
        self.client_a.plafond = Decimal('20000')
        self.client_a.delai_paiement_jours = 30
        self.client_a.save()

        f_old = self._creance(client=self.client_a, total=10000)
        old_date = timezone.now() - timedelta(days=90)
        Facture.objects.filter(pk=f_old.pk).update(date=old_date)

        f_recent = self._creance(client=self.client_a, total=6000)
        paiement = self._pay(f_recent, 1000)
        pay_date = timezone.now() - timedelta(days=10)
        Caisse.objects.filter(pk=paiement.pk).update(date_paiement=pay_date)

        # Le débit 'en_compte' ne doit pas compter comme dernier règlement
        self._pay(f_recent, 0, mode='en_compte')

        self._creance(client=self.client_b, total=3000)  # aucun règlement

        response = self.api.get('/api/creances/synthese_clients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_client = {item['client']: item for item in response.data}

        item_a = by_client['Assurance A']
        self.assertEqual(Decimal(str(item_a['plafond'])), Decimal('20000'))
        self.assertEqual(item_a['delai_paiement_jours'], 30)
        self.assertAlmostEqual((timezone.now() - item_a['plus_ancienne']).days, 90, delta=1)
        self.assertEqual(item_a['dernier_paiement'], pay_date)

        item_b = by_client['Client B']
        self.assertIsNone(item_b['dernier_paiement'])

    def test_aging_buckets(self):
        """Répartition des impayés par tranche d'ancienneté (jours)."""
        now = timezone.now()
        f_old = self._creance(client=self.client_a, total=10000)
        Facture.objects.filter(pk=f_old.pk).update(date=now - timedelta(days=95))
        f_mid = self._creance(client=self.client_a, total=5000)
        Facture.objects.filter(pk=f_mid.pk).update(date=now - timedelta(days=45))
        self._creance(client=self.client_b, total=3000)  # récente -> 0-30
        # Une facture soldée ne doit pas apparaître dans l'aging
        f_paid = self._creance(client=self.client_a, total=2000)
        self._pay(f_paid, 2000)

        response = self.api.get('/api/creances/aging/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(Decimal(str(data['b_90_plus']['montant'])), Decimal('10000'))
        self.assertEqual(data['b_90_plus']['nb'], 1)
        self.assertEqual(Decimal(str(data['b_30_60']['montant'])), Decimal('5000'))
        self.assertEqual(Decimal(str(data['b_0_30']['montant'])), Decimal('3000'))
        self.assertEqual(data['total']['nb'], 3)

    def test_relance_preview_et_envoi_sms(self):
        """Preview de relance + envoi SMS → marqueur SmsLog RELANCE + derniere_relance."""
        self.client_a.phone = '612345678'
        self.client_a.save()
        self._creance(client=self.client_a, total=8000)

        r = self.api.get(f'/api/creances/relance_preview/?client_id={self.client_a.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['nb_factures'], 1)
        self.assertEqual(Decimal(str(r.data['solde_du'])), Decimal('8000'))
        self.assertIn('8 000', r.data['message'])
        self.assertEqual(r.data['phone_wa'], '237612345678')

        r = self.api.post('/api/creances/relancer/', {
            'client_id': self.client_a.id,
            'channel': 'sms',
            'message': 'Merci de régler votre solde.'
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['success'])
        log = SmsLog.objects.get(client=self.client_a, type='RELANCE')
        self.assertEqual(log.recipient_number, '612345678')

        r = self.api.get('/api/creances/synthese_clients/')
        item = {i['client']: i for i in r.data}['Assurance A']
        self.assertIsNotNone(item['derniere_relance'])
        self.assertEqual(item['phone'], '612345678')

    def test_relance_sans_telephone_refusee(self):
        self.client_a.phone = None
        self.client_a.save()
        r = self.api.post('/api/creances/relancer/', {
            'client_id': self.client_a.id,
            'channel': 'sms',
            'message': 'Test'
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_relance_email(self):
        """Relance email : send_mail réel (locmem) + marqueur SmsLog."""
        from django.core import mail
        from django.test import override_settings

        self.client_a.email = 'assurance.a@test.cm'
        self.client_a.save()
        self._creance(client=self.client_a, total=5000)

        with override_settings(
            EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
            EMAIL_HOST_USER='pharma@test.cm',
            DEFAULT_FROM_EMAIL='pharma@test.cm',
        ):
            r = self.api.post('/api/creances/relancer/', {
                'client_id': self.client_a.id,
                'channel': 'email',
                'message': 'Merci de régler votre solde de 5000 F.'
            })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['success'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['assurance.a@test.cm'])
        log = SmsLog.objects.get(client=self.client_a, type='RELANCE')
        self.assertEqual(log.recipient_number, 'assurance.a@test.cm')

    def test_relance_email_sans_adresse_refusee(self):
        self.client_a.email = None
        self.client_a.save()
        r = self.api.post('/api/creances/relancer/', {
            'client_id': self.client_a.id,
            'channel': 'email',
            'message': 'Test'
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

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
