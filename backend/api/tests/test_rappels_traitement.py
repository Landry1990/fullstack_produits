"""
Tests pour TreatmentReminderViewSet — rappels internes de traitement.

Couvre :
- Création (durée directe ou dérivée quantité/doses)
- Calcul date_fin_prevue
- Endpoint `due` (fenêtre réglable via PharmacySettings)
- Actions traiter / ignorer
- Permissions (non-admin refusé en écriture)
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import PharmacySettings, Promis, TreatmentReminder
from api.services.realtime import notify_stock_changed
from api.tests.factories import TestDataFactory


class RappelsTraitementTestCase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.factory = TestDataFactory()
        self.admin = self.factory.create_superuser(username='admin_rappels')
        self.api.force_authenticate(user=self.admin)
        self.client_a = self.factory.create_client(name='Patient A')
        self.produit = self.factory.create_produit(name='Metformine 500', stock=42)
        self.url = '/api/rappels-traitement/'
        self.today = timezone.now().date()

    def _create(self, **overrides):
        payload = {
            'client': self.client_a.id,
            'produit': self.produit.id,
            'date_debut': str(self.today),
            'duree_jours': 30,
        }
        payload.update(overrides)
        return self.api.post(self.url, payload, format='json')

    # ------------------------------------------------------------------
    # Création

    def test_creation_duree_directe(self):
        r = self._create()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        rappel = TreatmentReminder.objects.get()
        self.assertEqual(rappel.date_fin_prevue, self.today + timedelta(days=30))
        self.assertEqual(rappel.produit_nom, 'Metformine 500')
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.EN_ATTENTE)
        self.assertEqual(rappel.created_by, self.admin)

    def test_creation_duree_derivee_doses(self):
        """60 comprimés à 2/jour -> 30 jours."""
        r = self._create(duree_jours=None, quantite=60, doses_par_jour='2.0')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        rappel = TreatmentReminder.objects.get()
        self.assertEqual(rappel.duree_jours, 30)
        self.assertEqual(rappel.date_fin_prevue, self.today + timedelta(days=30))

    def test_creation_sans_duree_refusee(self):
        r = self._create(duree_jours=None)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Endpoint `due`

    def test_due_dans_la_fenetre(self):
        PharmacySettings.objects.update_or_create(pk=1, defaults={
            'rappel_traitement_actif': True,
            'rappel_traitement_jours_avant': 7,
        })
        # Fin dans 5 jours -> visible ; fin dans 30 jours -> pas encore.
        self._create(duree_jours=5)
        self._create(duree_jours=30)
        r = self.api.get(f'{self.url}due/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['actif'])
        self.assertEqual(len(r.data['rappels']), 1)
        self.assertEqual(r.data['rappels'][0]['jours_restants'], 5)
        self.assertEqual(r.data['rappels'][0]['produit_stock'], 42)

    def test_due_desactive_retourne_vide(self):
        PharmacySettings.objects.update_or_create(pk=1, defaults={
            'rappel_traitement_actif': False,
        })
        self._create(duree_jours=1)
        r = self.api.get(f'{self.url}due/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['actif'])
        self.assertEqual(r.data['rappels'], [])

    def test_due_inclut_traites_a_informer(self):
        """Un rappel TRAITE (médicament arrivé) reste dans `due` : patient à informer."""
        PharmacySettings.objects.update_or_create(pk=1, defaults={
            'rappel_traitement_actif': True,
            'rappel_traitement_jours_avant': 30,
        })
        self._create(duree_jours=5)
        rappel = TreatmentReminder.objects.get()
        rappel.statut = TreatmentReminder.Statut.TRAITE
        rappel.save()
        r = self.api.get(f'{self.url}due/')
        self.assertEqual(len(r.data['rappels']), 1)
        self.assertEqual(r.data['rappels'][0]['statut'], 'TRAITE')

    def test_due_exclut_patient_informe(self):
        PharmacySettings.objects.update_or_create(pk=1, defaults={
            'rappel_traitement_actif': True,
            'rappel_traitement_jours_avant': 30,
        })
        self._create(duree_jours=5)
        rappel = TreatmentReminder.objects.get()
        rappel.statut = TreatmentReminder.Statut.PATIENT_INFORME
        rappel.save()
        r = self.api.get(f'{self.url}due/')
        self.assertEqual(len(r.data['rappels']), 0)

    # ------------------------------------------------------------------
    # Modification

    def test_modification_produit_synchronise_nom(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        autre = self.factory.create_produit(name='Amlodipine 5')
        r = self.api.patch(f'{self.url}{rappel.id}/', {'produit': autre.id, 'duree_jours': 15}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rappel.refresh_from_db()
        self.assertEqual(rappel.produit, autre)
        self.assertEqual(rappel.produit_nom, 'Amlodipine 5')
        self.assertEqual(rappel.duree_jours, 15)
        self.assertEqual(rappel.date_fin_prevue, self.today + timedelta(days=15))

    # ------------------------------------------------------------------
    # Actions

    def test_traiter(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        r = self.api.post(f'{self.url}{rappel.id}/traiter/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.TRAITE)
        self.assertEqual(rappel.traite_par, self.admin)
        self.assertIsNotNone(rappel.traite_le)

    def test_ignorer(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        r = self.api.post(f'{self.url}{rappel.id}/ignorer/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.IGNORE)

    def test_traiter_deja_traite_refuse(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        rappel.statut = TreatmentReminder.Statut.TRAITE
        rappel.save()
        r = self.api.post(f'{self.url}{rappel.id}/traiter/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patient_informe(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        rappel.statut = TreatmentReminder.Statut.TRAITE
        rappel.save()
        r = self.api.post(f'{self.url}{rappel.id}/patient_informe/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.PATIENT_INFORME)
        self.assertEqual(rappel.informe_par, self.admin)
        self.assertIsNotNone(rappel.informe_le)

    def test_patient_informe_refuse_si_non_traite(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        r = self.api.post(f'{self.url}{rappel.id}/patient_informe/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ignorer_depuis_traite(self):
        self._create()
        rappel = TreatmentReminder.objects.get()
        rappel.statut = TreatmentReminder.Statut.TRAITE
        rappel.save()
        r = self.api.post(f'{self.url}{rappel.id}/ignorer/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.IGNORE)

    # ------------------------------------------------------------------
    # Promis dans `due` + auto-flip à l'entrée en stock

    def _create_promis_pret(self, informe=False):
        p = Promis.objects.create(
            client=self.client_a,
            produit=self.produit,
            produit_nom=self.produit.name,
            quantite=2,
            status=Promis.Status.PRET,
        )
        if informe:
            p.client_informe_le = timezone.now()
            p.client_informe_par = self.admin
            p.save()
        return p

    def test_due_inclut_promis_pret_non_informe(self):
        PharmacySettings.objects.update_or_create(pk=1, defaults={'rappel_traitement_actif': True})
        self._create_promis_pret()
        r = self.api.get(f'{self.url}due/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data['promis']), 1)
        self.assertEqual(r.data['promis'][0]['produit_nom'], 'Metformine 500')

    def test_due_exclut_promis_informe(self):
        PharmacySettings.objects.update_or_create(pk=1, defaults={'rappel_traitement_actif': True})
        self._create_promis_pret(informe=True)
        r = self.api.get(f'{self.url}due/')
        self.assertEqual(len(r.data['promis']), 0)

    def test_promis_client_informe(self):
        promis = self._create_promis_pret()
        r = self.api.post(f'/api/promis/{promis.id}/client_informe/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        promis.refresh_from_db()
        # Traçabilité posée mais le promis reste PRET (retrait → DELIVRE)
        self.assertEqual(promis.status, Promis.Status.PRET)
        self.assertEqual(promis.client_informe_par, self.admin)
        self.assertIsNotNone(promis.client_informe_le)

    def test_promis_client_informe_refuse_si_non_pret(self):
        promis = Promis.objects.create(
            client=self.client_a, produit=self.produit,
            produit_nom=self.produit.name, quantite=2,
        )
        r = self.api.post(f'/api/promis/{promis.id}/client_informe/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_entree_stock_flip_rappel_en_traite(self):
        """L'entrée en stock (canal notify_stock_changed) passe le rappel
        EN_ATTENTE → TRAITE automatiquement si le produit est disponible."""
        self.produit.stock = 0
        self.produit.save(update_fields=['stock'])
        self._create()
        rappel = TreatmentReminder.objects.get()
        # Simule une entrée en stock
        self.produit.stock = 10
        self.produit.save(update_fields=['stock'])
        with self.captureOnCommitCallbacks(execute=True):
            notify_stock_changed([self.produit.id])
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.TRAITE)

    def test_entree_stock_pas_de_flip_si_stock_zero(self):
        self.produit.stock = 0
        self.produit.save(update_fields=['stock'])
        self._create()
        rappel = TreatmentReminder.objects.get()
        with self.captureOnCommitCallbacks(execute=True):
            notify_stock_changed([self.produit.id])
        rappel.refresh_from_db()
        self.assertEqual(rappel.statut, TreatmentReminder.Statut.EN_ATTENTE)

    # ------------------------------------------------------------------
    # Permissions

    def test_non_admin_refuse_en_ecriture(self):
        vendeur = self.factory.create_user(username='vendeur_rappels')
        self.api.force_authenticate(user=vendeur)
        r = self._create()
        self.assertIn(r.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED))

    def test_anonyme_refuse(self):
        self.api.force_authenticate(user=None)
        r = self.api.get(self.url)
        self.assertIn(r.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
