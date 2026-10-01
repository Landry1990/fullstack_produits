"""
Tests pour api/views/planning.py — planning des opérateurs.

Couvre :
- ShiftConfigViewSet : singleton (list/get_or_create, create=upsert),
  permissions IsAuthenticated/IsAdminUser, auto-régénération du mois courant.
- ShiftScheduleViewSet : CRUD, filtres (month, is_published), action generate
  (rotation travail/repos, gardes pharmaciens, repos post-garde, congés
  approuvés, modes équipe FIXED/ROTATING, paramètre from_day), publish,
  update_assignment, stats, send_to_operators.
- LeaveRequestViewSet : CRUD, visibilité (propres demandes vs admin),
  filtres status/leave_type, approve/reject, my_leaves, balance.
"""
import datetime

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import (
    InternalMessage,
    LeaveRequest,
    ShiftAssignment,
    ShiftConfig,
    ShiftSchedule,
    Team,
)
from .factories import TestDataFactory as F

# Mois passé fixe → génération complète déterministe (juin 2020 = 30 jours)
PAST_MONTH = datetime.date(2020, 6, 1)
PAST_MONTH_DAYS = 30


class PlanningBase(TestCase):
    """Base : client API authentifié en superuser + helpers."""

    def setUp(self):
        self.api = APIClient()
        self.admin = F.create_superuser()
        self.api.force_authenticate(user=self.admin)
        self.anon = APIClient()

    def as_user(self, user):
        """Retourne un APIClient authentifié comme `user`."""
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def make_operator(self, role='VENDEUR'):
        """Crée un opérateur actif non-superuser (éligible au planning)."""
        user = F.create_user()
        if role != 'VENDEUR':
            user.profile.role = role
            user.profile.save()
        return user


# ── ShiftConfigViewSet ────────────────────────────────────────────────────────

class ShiftConfigTests(PlanningBase):
    """Configuration singleton des règles de rotation."""

    def test_list_anonyme_401(self):
        resp = self.anon.get(reverse('shift-config-list'))
        self.assertIn(resp.status_code, (401, 403))

    def test_list_cree_le_singleton(self):
        resp = self.api.get(reverse('shift-config-list'))
        self.assertEqual(resp.status_code, 200)
        # list retourne un objet unique (pas une liste paginée)
        self.assertIsInstance(resp.data, dict)
        self.assertEqual(ShiftConfig.objects.count(), 1)
        self.assertEqual(resp.data['id'], 1)

    def test_list_idempotent(self):
        self.api.get(reverse('shift-config-list'))
        resp = self.api.get(reverse('shift-config-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ShiftConfig.objects.count(), 1)

    def test_list_accessible_non_admin(self):
        user = F.create_user()
        resp = self.as_user(user).get(reverse('shift-config-list'))
        self.assertEqual(resp.status_code, 200)

    def test_detail_non_admin_403(self):
        ShiftConfig.objects.get_or_create(pk=1)
        user = F.create_user()
        resp = self.as_user(user).get(reverse('shift-config-detail', args=[1]))
        self.assertEqual(resp.status_code, 403)

    def test_detail_admin_200(self):
        ShiftConfig.objects.get_or_create(pk=1)
        resp = self.api.get(reverse('shift-config-detail', args=[1]))
        self.assertEqual(resp.status_code, 200)

    def test_create_non_admin_403(self):
        user = F.create_user()
        resp = self.as_user(user).post(
            reverse('shift-config-list'), {'rest_days': 3}, format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_create_upsert_singleton(self):
        resp = self.api.post(reverse('shift-config-list'), {
            'work_days_before_rest': 4,
            'rest_days': 1,
            'rotate_shifts': False,
            'guard_frequency_days': 0,
            'annual_leave_days': 30,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ShiftConfig.objects.count(), 1)
        config = ShiftConfig.objects.get()
        self.assertEqual(config.work_days_before_rest, 4)
        self.assertEqual(config.rest_days, 1)
        self.assertFalse(config.rotate_shifts)
        self.assertEqual(config.annual_leave_days, 30)

    def test_create_repete_met_a_jour_la_meme_ligne(self):
        self.api.post(reverse('shift-config-list'), {
            'work_days_before_rest': 4,
        }, format='json')
        resp = self.api.post(reverse('shift-config-list'), {
            'work_days_before_rest': 6,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ShiftConfig.objects.count(), 1)
        self.assertEqual(ShiftConfig.objects.get().work_days_before_rest, 6)

    def test_partial_update_admin(self):
        ShiftConfig.objects.get_or_create(pk=1)
        resp = self.api.patch(
            reverse('shift-config-detail', args=[1]),
            {'rest_days': 5}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ShiftConfig.objects.get(pk=1).rest_days, 5)

    def test_delete_admin(self):
        ShiftConfig.objects.get_or_create(pk=1)
        resp = self.api.delete(reverse('shift-config-detail', args=[1]))
        self.assertEqual(resp.status_code, 204)
        # Le singleton est recréé au prochain list
        resp = self.api.get(reverse('shift-config-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ShiftConfig.objects.count(), 1)

    def test_create_regenere_planning_mois_courant(self):
        """POST shift-config régénère les affectations du mois en cours
        (du jour courant à la fin du mois) si un planning existe."""
        op = self.make_operator()
        today = datetime.date.today()
        schedule = ShiftSchedule.objects.create(
            month=today.replace(day=1), created_by=self.admin,
        )
        resp = self.api.post(reverse('shift-config-list'), {
            'guard_frequency_days': 0,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            schedule.assignments.filter(user=op, date=today).exists()
        )
        self.assertFalse(
            schedule.assignments.filter(date__lt=today).exists()
        )


# ── ShiftScheduleViewSet : CRUD ───────────────────────────────────────────────

class ShiftScheduleCRUDTests(PlanningBase):

    def test_list_anonyme_401(self):
        resp = self.anon.get(reverse('shift-schedule-list'))
        self.assertIn(resp.status_code, (401, 403))

    def test_list_retourne_plannings_tries(self):
        ShiftSchedule.objects.create(month=datetime.date(2020, 1, 1))
        ShiftSchedule.objects.create(month=datetime.date(2020, 3, 1))
        ShiftSchedule.objects.create(month=datetime.date(2020, 2, 1))
        resp = self.api.get(reverse('shift-schedule-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 3)
        months = [s['month'] for s in resp.data]
        self.assertEqual(months, ['2020-03-01', '2020-02-01', '2020-01-01'])

    def test_create_normalise_mois_et_created_by(self):
        resp = self.api.post(reverse('shift-schedule-list'), {
            'month': '2030-05-17',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['month'], '2030-05-01')
        schedule = ShiftSchedule.objects.get()
        self.assertEqual(schedule.month, datetime.date(2030, 5, 1))
        self.assertEqual(schedule.created_by, self.admin)
        self.assertEqual(resp.data['created_by_name'], self.admin.username)

    def test_create_doublon_mois_400(self):
        ShiftSchedule.objects.create(month=datetime.date(2030, 5, 1))
        resp = self.api.post(reverse('shift-schedule-list'), {
            'month': '2030-05-20',  # normalisé → même mois → unique_together
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(ShiftSchedule.objects.count(), 1)

    def test_create_non_admin_autorise(self):
        """Tout utilisateur authentifié peut créer un planning
        (permission_classes = IsAuthenticated)."""
        user = F.create_user()
        resp = self.as_user(user).post(reverse('shift-schedule-list'), {
            'month': '2031-01-01',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(ShiftSchedule.objects.get().created_by, user)

    def test_detail_inclut_assignments(self):
        op = self.make_operator()
        schedule = ShiftSchedule.objects.create(month=PAST_MONTH)
        ShiftAssignment.objects.create(
            schedule=schedule, user=op,
            date=datetime.date(2020, 6, 5), shift_type='MATIN',
        )
        resp = self.api.get(reverse('shift-schedule-detail', args=[schedule.pk]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['assignments']), 1)
        a = resp.data['assignments'][0]
        self.assertEqual(a['shift_type'], 'MATIN')
        self.assertEqual(a['user_detail']['id'], op.id)
        self.assertEqual(a['user_detail']['username'], op.username)

    def test_filtre_par_month(self):
        ShiftSchedule.objects.create(month=datetime.date(2020, 6, 1))
        ShiftSchedule.objects.create(month=datetime.date(2020, 7, 1))
        resp = self.api.get(reverse('shift-schedule-list'), {'month': '2020-06-01'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['month'], '2020-06-01')

    def test_filtre_par_is_published(self):
        ShiftSchedule.objects.create(month=datetime.date(2020, 6, 1))
        ShiftSchedule.objects.create(
            month=datetime.date(2020, 7, 1), is_published=True,
        )
        resp = self.api.get(
            reverse('shift-schedule-list'), {'is_published': 'true'},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertTrue(resp.data[0]['is_published'])

    def test_patch_is_published(self):
        schedule = ShiftSchedule.objects.create(month=PAST_MONTH)
        resp = self.api.patch(
            reverse('shift-schedule-detail', args=[schedule.pk]),
            {'is_published': True}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_published)

    def test_delete_cascade_assignments(self):
        op = self.make_operator()
        schedule = ShiftSchedule.objects.create(month=PAST_MONTH)
        ShiftAssignment.objects.create(
            schedule=schedule, user=op,
            date=datetime.date(2020, 6, 1), shift_type='MATIN',
        )
        resp = self.api.delete(
            reverse('shift-schedule-detail', args=[schedule.pk]),
        )
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(ShiftSchedule.objects.count(), 0)
        self.assertEqual(ShiftAssignment.objects.count(), 0)


# ── ShiftScheduleViewSet : action generate ────────────────────────────────────

class ShiftScheduleGenerateTests(PlanningBase):
    """Algorithme de génération automatique (_build_assignments)."""

    def setUp(self):
        super().setUp()
        # Ordre de création = ordre des opérateurs (order_by id) : op1 idx 0
        self.op1 = self.make_operator()
        self.op2 = self.make_operator()
        self.schedule = ShiftSchedule.objects.create(
            month=PAST_MONTH, created_by=self.admin,
        )
        self.config = ShiftConfig.objects.create(
            pk=1,
            work_days_before_rest=3,
            rest_days=1,
            rotate_shifts=False,
            guard_frequency_days=0,
            team_mode='INDIVIDUAL',
        )

    def _generate(self, data=None):
        return self.api.post(
            reverse('shift-schedule-generate', args=[self.schedule.pk]),
            data or {}, format='json',
        )

    def test_generate_anonyme_401(self):
        resp = self.anon.post(
            reverse('shift-schedule-generate', args=[self.schedule.pk]),
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_generate_non_admin_403(self):
        user = F.create_user()
        resp = self.as_user(user).post(
            reverse('shift-schedule-generate', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 403)

    def test_generate_sans_operateur_400(self):
        User.objects.filter(is_superuser=False).update(is_active=False)
        resp = self._generate()
        self.assertEqual(resp.status_code, 400)
        self.assertIn('opérateur', resp.data['error'])

    def test_generate_cree_config_si_absente(self):
        self.config.delete()
        resp = self._generate()
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(ShiftConfig.objects.exists())

    def test_genere_tout_le_mois_passe(self):
        resp = self._generate()
        self.assertEqual(resp.status_code, 200)
        # 2 opérateurs × 30 jours
        self.assertEqual(self.schedule.assignments.count(), 2 * PAST_MONTH_DAYS)
        self.assertEqual(len(resp.data['assignments']), 2 * PAST_MONTH_DAYS)
        # Chaque opérateur a exactement 1 affectation par jour
        for op in (self.op1, self.op2):
            for day in range(1, PAST_MONTH_DAYS + 1):
                self.assertEqual(
                    self.schedule.assignments.filter(
                        user=op, date=datetime.date(2020, 6, day),
                    ).count(),
                    1, f'{op.username} jour {day}',
                )

    def test_cycle_travail_repos(self):
        """work=3 rest=1 → cycle 4. op1 (idx 0, offset 0) : repos jour 4.
        op2 (idx 1, offset 4//2=2) : repos jour 2."""
        self._generate()
        a = self.schedule.assignments.get(
            user=self.op1, date=datetime.date(2020, 6, 4),
        )
        self.assertEqual(a.shift_type, 'REPOS')
        a = self.schedule.assignments.get(
            user=self.op2, date=datetime.date(2020, 6, 2),
        )
        self.assertEqual(a.shift_type, 'REPOS')
        # op1 travaille les jours 1-3
        for day in (1, 2, 3):
            self.assertNotEqual(
                self.schedule.assignments.get(
                    user=self.op1, date=datetime.date(2020, 6, day),
                ).shift_type,
                'REPOS',
            )

    def test_sans_rotation_tout_matin(self):
        self._generate()
        types = set(
            self.schedule.assignments.values_list('shift_type', flat=True),
        )
        self.assertNotIn('NUIT', types)
        self.assertIn('MATIN', types)
        self.assertIn('REPOS', types)

    def test_avec_rotation_contient_nuits(self):
        self.config.rotate_shifts = True
        self.config.save()
        self._generate()
        self.assertTrue(
            self.schedule.assignments.filter(shift_type='NUIT').exists(),
        )
        self.assertTrue(
            self.schedule.assignments.filter(shift_type='MATIN').exists(),
        )

    def test_operateur_seul_jamais_repos(self):
        """Règle de couverture : si personne ne travaille un jour, un REPOS
        est requalifié en MATIN → un opérateur seul travaille tous les jours."""
        self.op2.delete()
        self._generate()
        types = set(
            self.schedule.assignments.values_list('shift_type', flat=True),
        )
        self.assertEqual(types, {'MATIN'})

    def test_conges_approuves_respectes(self):
        LeaveRequest.objects.create(
            user=self.op1, start_date=datetime.date(2020, 6, 10),
            end_date=datetime.date(2020, 6, 12), status='APPROVED',
        )
        # Une demande PENDING ne doit PAS bloquer
        LeaveRequest.objects.create(
            user=self.op2, start_date=datetime.date(2020, 6, 10),
            end_date=datetime.date(2020, 6, 12), status='PENDING',
        )
        self._generate()
        for day in (10, 11, 12):
            self.assertEqual(
                self.schedule.assignments.get(
                    user=self.op1, date=datetime.date(2020, 6, day),
                ).shift_type,
                'CONGE',
            )
            self.assertNotEqual(
                self.schedule.assignments.get(
                    user=self.op2, date=datetime.date(2020, 6, day),
                ).shift_type,
                'CONGE',
            )

    def test_gardes_reservees_aux_pharmaciens(self):
        self.config.guard_frequency_days = 10
        self.config.save()
        self.op1.profile.role = 'PHARMACIEN'
        self.op1.profile.save()
        self._generate()
        gardes = self.schedule.assignments.filter(shift_type='GARDE')
        # Jours multiples de 10 : 10, 20, 30
        self.assertEqual(gardes.count(), 3)
        self.assertEqual(
            {g.date.day for g in gardes}, {10, 20, 30},
        )
        # Seul le pharmacien peut prendre les gardes
        self.assertEqual({g.user_id for g in gardes}, {self.op1.id})

    def test_repos_obligatoire_apres_garde(self):
        """Le pharmacien est en REPOS le lendemain de chaque garde.
        Fréquence 10j → gardes 10/20/30 → repos 11/21 (op2 travaille ces
        jours-là, donc la règle de couverture minimale ne requalifie pas)."""
        self.config.guard_frequency_days = 10
        self.config.save()
        self.op1.profile.role = 'PHARMACIEN'
        self.op1.profile.save()
        self._generate()
        for repos_day in (11, 21):
            self.assertEqual(
                self.schedule.assignments.get(
                    user=self.op1, date=datetime.date(2020, 6, repos_day),
                ).shift_type,
                'REPOS', f'repos post-garde jour {repos_day}',
            )

    def test_from_day_1_regenere_tout_le_mois_courant(self):
        today = datetime.date.today()
        schedule = ShiftSchedule.objects.create(month=today.replace(day=1))
        resp = self.api.post(
            reverse('shift-schedule-generate', args=[schedule.pk]),
            {'from_day': 1}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            schedule.assignments.filter(date=today.replace(day=1)).exists(),
        )

    def test_from_day_invalide_rejete(self):
        """from_day non numérique → 400 (P2) au lieu d'être ignoré."""
        resp = self._generate({'from_day': 'abc'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(self.schedule.assignments.count(), 0)

    def test_from_day_hors_limites_clampe(self):
        """from_day > nb de jours du mois → clampé au dernier jour
        (avant le fix : ValueError → 500)."""
        resp = self._generate({'from_day': 45})
        self.assertEqual(resp.status_code, 200)
        days = set(
            self.schedule.assignments.values_list('date', flat=True),
        )
        self.assertEqual(days, {datetime.date(2020, 6, 30)})

    def test_regeneration_partielle_preserve_jours_passes(self):
        """Sans from_day, la régénération du mois courant démarre à
        aujourd'hui et ne touche pas aux jours passés."""
        today = datetime.date.today()
        if today.day == 1:
            self.skipTest('Le 1er du mois ne permet pas de tester la préservation')
        schedule = ShiftSchedule.objects.create(month=today.replace(day=1))
        jour_passe = today.replace(day=1)
        ShiftAssignment.objects.create(
            schedule=schedule, user=self.op1, date=jour_passe,
            shift_type='REPOS', notes='MANUEL',
        )
        resp = self.api.post(
            reverse('shift-schedule-generate', args=[schedule.pk]),
            {}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        # L'affectation manuelle du jour 1 est intacte
        self.assertTrue(
            schedule.assignments.filter(
                user=self.op1, date=jour_passe, notes='MANUEL',
            ).exists(),
        )
        # Rien de généré avant aujourd'hui
        self.assertFalse(
            schedule.assignments.filter(
                date__lt=today,
            ).exclude(notes='MANUEL').exists(),
        )

    def test_regeneration_mois_courant_remplace_jour_courant(self):
        """Les affectations à partir d'aujourd'hui sont supprimées puis
        régénérées (notes manuelles perdues)."""
        today = datetime.date.today()
        schedule = ShiftSchedule.objects.create(month=today.replace(day=1))
        ShiftAssignment.objects.create(
            schedule=schedule, user=self.op1, date=today,
            shift_type='REPOS', notes='MANUEL',
        )
        resp = self.api.post(
            reverse('shift-schedule-generate', args=[schedule.pk]),
            {}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(
            schedule.assignments.filter(notes='MANUEL').exists(),
        )
        self.assertTrue(
            schedule.assignments.filter(user=self.op1, date=today).exists(),
        )

    def test_equipe_fixe_impose_son_shift(self):
        """Mode FIXED : les membres de l'équipe prennent le default_shift
        chaque jour (pas de REPOS automatique pour eux)."""
        self.config.team_mode = 'FIXED'
        self.config.save()
        team = Team.objects.create(name='Nuit', default_shift='NUIT')
        team.members.add(self.op2)
        self._generate()
        types = set(
            self.schedule.assignments.filter(
                user=self.op2,
            ).values_list('shift_type', flat=True),
        )
        self.assertEqual(types, {'NUIT'})
        # op1 (hors équipe) suit le cycle individuel → a des REPOS
        self.assertTrue(
            self.schedule.assignments.filter(
                user=self.op1, shift_type='REPOS',
            ).exists(),
        )

    def test_equipe_tournante_cycle(self):
        """Mode ROTATING, bloc=2 jours : équipe idx 0 →
        jours 1-2 MATIN, 3-4 NUIT, 5-6 REPOS, 7-8 MATIN."""
        self.config.team_mode = 'ROTATING'
        self.config.team_rotation_days = 2
        self.config.save()
        team = Team.objects.create(name='Equipe A')
        team.members.add(self.op1)
        self._generate()
        expected = {1: 'MATIN', 3: 'NUIT', 5: 'REPOS', 7: 'MATIN'}
        for day, shift in expected.items():
            self.assertEqual(
                self.schedule.assignments.get(
                    user=self.op1, date=datetime.date(2020, 6, day),
                ).shift_type,
                shift, f'jour {day}',
            )


# ── ShiftScheduleViewSet : publish / update_assignment / stats / envoi ───────

class ShiftScheduleActionsTests(PlanningBase):

    def setUp(self):
        super().setUp()
        self.op1 = self.make_operator()
        self.op2 = self.make_operator()
        self.schedule = ShiftSchedule.objects.create(
            month=PAST_MONTH, created_by=self.admin,
        )

    # ── publish ──

    def test_publish(self):
        resp = self.api.patch(
            reverse('shift-schedule-publish', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['is_published'])
        self.schedule.refresh_from_db()
        self.assertTrue(self.schedule.is_published)

    def test_publish_non_admin_403(self):
        user = F.create_user()
        resp = self.as_user(user).patch(
            reverse('shift-schedule-publish', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 403)
        self.schedule.refresh_from_db()
        self.assertFalse(self.schedule.is_published)

    def test_publish_anonyme_401(self):
        resp = self.anon.patch(
            reverse('shift-schedule-publish', args=[self.schedule.pk]),
        )
        self.assertIn(resp.status_code, (401, 403))

    # ── update_assignment ──

    def _update_assignment(self, data):
        return self.api.post(
            reverse('shift-schedule-update-assignment', args=[self.schedule.pk]),
            data, format='json',
        )

    def test_update_assignment_cree_201(self):
        resp = self._update_assignment({
            'user_id': self.op1.id,
            'date': '2020-06-10',
            'shift_type': 'NUIT',
            'notes': 'remplacement',
        })
        self.assertEqual(resp.status_code, 201)
        a = ShiftAssignment.objects.get()
        self.assertEqual(a.user, self.op1)
        self.assertEqual(a.shift_type, 'NUIT')
        self.assertEqual(a.notes, 'remplacement')
        self.assertEqual(resp.data['user_detail']['id'], self.op1.id)

    def test_update_assignment_maj_200(self):
        ShiftAssignment.objects.create(
            schedule=self.schedule, user=self.op1,
            date=datetime.date(2020, 6, 10), shift_type='MATIN',
        )
        resp = self._update_assignment({
            'user_id': self.op1.id,
            'date': '2020-06-10',
            'shift_type': 'NUIT',
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ShiftAssignment.objects.count(), 1)
        self.assertEqual(ShiftAssignment.objects.get().shift_type, 'NUIT')

    def test_update_assignment_champs_manquants_400(self):
        for data in (
            {},
            {'user_id': self.op1.id},
            {'user_id': self.op1.id, 'date': '2020-06-10'},
            {'date': '2020-06-10', 'shift_type': 'MATIN'},
        ):
            resp = self._update_assignment(data)
            self.assertEqual(resp.status_code, 400, data)

    def test_update_assignment_date_invalide_400(self):
        resp = self._update_assignment({
            'user_id': self.op1.id,
            'date': 'pas-une-date',
            'shift_type': 'MATIN',
        })
        self.assertEqual(resp.status_code, 400)

    def test_update_assignment_user_inexistant_400(self):
        resp = self._update_assignment({
            'user_id': 999999,
            'date': '2020-06-10',
            'shift_type': 'MATIN',
        })
        self.assertEqual(resp.status_code, 400)

    def test_update_assignment_non_admin_403(self):
        user = F.create_user()
        resp = self.as_user(user).post(
            reverse('shift-schedule-update-assignment', args=[self.schedule.pk]),
            {'user_id': self.op1.id, 'date': '2020-06-10', 'shift_type': 'NUIT'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    # ── stats ──

    def test_stats_par_operateur(self):
        for day, shift in ((1, 'MATIN'), (2, 'MATIN'), (3, 'NUIT')):
            ShiftAssignment.objects.create(
                schedule=self.schedule, user=self.op1,
                date=datetime.date(2020, 6, day), shift_type=shift,
            )
        ShiftAssignment.objects.create(
            schedule=self.schedule, user=self.op2,
            date=datetime.date(2020, 6, 1), shift_type='REPOS',
        )
        resp = self.api.get(
            reverse('shift-schedule-stats', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        stats = {row['user_id']: row for row in resp.data}
        s1 = stats[self.op1.id]
        self.assertEqual(s1['MATIN'], 2)
        self.assertEqual(s1['NUIT'], 1)
        self.assertEqual(s1['total_work'], 3)
        self.assertEqual(s1['username'], self.op1.username)
        s2 = stats[self.op2.id]
        self.assertEqual(s2['REPOS'], 1)
        self.assertEqual(s2['total_work'], 0)  # REPOS ne compte pas

    def test_stats_planning_vide(self):
        resp = self.api.get(
            reverse('shift-schedule-stats', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_stats_accessible_non_admin(self):
        user = F.create_user()
        resp = self.as_user(user).get(
            reverse('shift-schedule-stats', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 200)

    # ── send_to_operators ──

    def test_send_to_operators(self):
        for user, day, shift in (
            (self.op1, 1, 'MATIN'), (self.op1, 2, 'NUIT'),
            (self.op2, 1, 'MATIN'),
        ):
            ShiftAssignment.objects.create(
                schedule=self.schedule, user=user,
                date=datetime.date(2020, 6, day), shift_type=shift,
            )
        resp = self.api.post(
            reverse('shift-schedule-send-to-operators', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['sent'], 2)
        self.assertEqual(resp.data['month'], '06/2020')
        # Un message par opérateur, envoyé par l'admin
        self.assertEqual(InternalMessage.objects.count(), 2)
        msg = InternalMessage.objects.get(recipient=self.op1)
        self.assertEqual(msg.sender, self.admin)
        self.assertIn('Planning 06/2020', msg.content)
        self.assertIn('01/06', msg.content)
        self.assertIn('02/06', msg.content)

    def test_send_to_operators_planning_vide(self):
        resp = self.api.post(
            reverse('shift-schedule-send-to-operators', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['sent'], 0)
        self.assertEqual(InternalMessage.objects.count(), 0)

    def test_send_to_operators_non_admin_403(self):
        user = F.create_user()
        resp = self.as_user(user).post(
            reverse('shift-schedule-send-to-operators', args=[self.schedule.pk]),
        )
        self.assertEqual(resp.status_code, 403)


# ── LeaveRequestViewSet ───────────────────────────────────────────────────────

class LeaveRequestTests(PlanningBase):

    def setUp(self):
        super().setUp()
        self.user = F.create_user()
        self.other = F.create_user()
        self.user_api = self.as_user(self.user)

    def _make_leave(self, user, start='2024-01-01', end='2024-01-05',
                    status_='PENDING', leave_type='CONGE', **kwargs):
        return LeaveRequest.objects.create(
            user=user,
            start_date=datetime.date.fromisoformat(start),
            end_date=datetime.date.fromisoformat(end),
            status=status_, leave_type=leave_type, **kwargs,
        )

    def test_list_anonyme_401(self):
        resp = self.anon.get(reverse('leave-request-list'))
        self.assertIn(resp.status_code, (401, 403))

    def test_create_attribue_user_connecte(self):
        resp = self.user_api.post(reverse('leave-request-list'), {
            'start_date': '2024-03-01',
            'end_date': '2024-03-03',
            'leave_type': 'CONGE',
            'notes': 'vacances famille',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        leave = LeaveRequest.objects.get()
        self.assertEqual(leave.user, self.user)
        self.assertEqual(leave.status, 'PENDING')
        # UppercaseSerializerMixin : notes passées en majuscules
        self.assertEqual(leave.notes, 'VACANCES FAMILLE')
        self.assertEqual(resp.data['days_count'], 3)

    def test_create_ignore_le_user_poste(self):
        """perform_create force user=request.user même si un autre
        user_id est envoyé."""
        resp = self.user_api.post(reverse('leave-request-list'), {
            'user': self.other.id,
            'start_date': '2024-03-01',
            'end_date': '2024-03-02',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(LeaveRequest.objects.get().user, self.user)

    def test_create_sans_dates_400(self):
        resp = self.user_api.post(
            reverse('leave-request-list'), {'leave_type': 'CONGE'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_list_non_admin_ne_voit_que_ses_demandes(self):
        self._make_leave(self.user)
        self._make_leave(self.other)
        resp = self.user_api.get(reverse('leave-request-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['user'], self.user.id)

    def test_list_admin_voit_tout(self):
        self._make_leave(self.user)
        self._make_leave(self.other)
        resp = self.api.get(reverse('leave-request-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_detail_autre_utilisateur_404(self):
        leave = self._make_leave(self.other)
        resp = self.user_api.get(
            reverse('leave-request-detail', args=[leave.pk]),
        )
        self.assertEqual(resp.status_code, 404)

    def test_filtre_par_status(self):
        self._make_leave(self.user, status_='APPROVED')
        self._make_leave(self.user, status_='REJECTED', start='2024-02-01',
                         end='2024-02-02')
        resp = self.api.get(
            reverse('leave-request-list'), {'status': 'APPROVED'},
        )
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['status'], 'APPROVED')

    def test_filtre_par_leave_type(self):
        self._make_leave(self.user, leave_type='MALADIE')
        self._make_leave(self.user, leave_type='CONGE',
                         start='2024-02-01', end='2024-02-02')
        resp = self.api.get(
            reverse('leave-request-list'), {'leave_type': 'MALADIE'},
        )
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['leave_type'], 'MALADIE')

    def test_delete_sa_propre_demande(self):
        leave = self._make_leave(self.user)
        resp = self.user_api.delete(
            reverse('leave-request-detail', args=[leave.pk]),
        )
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(LeaveRequest.objects.count(), 0)

    # ── approve / reject ──

    def test_approve_admin(self):
        leave = self._make_leave(self.user)
        resp = self.api.patch(
            reverse('leave-request-approve', args=[leave.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        leave.refresh_from_db()
        self.assertEqual(leave.status, 'APPROVED')
        self.assertEqual(leave.approved_by, self.admin)
        self.assertIsNotNone(leave.approved_at)
        self.assertEqual(resp.data['approved_by_name'], self.admin.username)

    def test_reject_admin(self):
        leave = self._make_leave(self.user)
        resp = self.api.patch(
            reverse('leave-request-reject', args=[leave.pk]),
        )
        self.assertEqual(resp.status_code, 200)
        leave.refresh_from_db()
        self.assertEqual(leave.status, 'REJECTED')
        self.assertEqual(leave.approved_by, self.admin)

    def test_approve_non_admin_403(self):
        leave = self._make_leave(self.user)
        resp = self.user_api.patch(
            reverse('leave-request-approve', args=[leave.pk]),
        )
        self.assertEqual(resp.status_code, 403)
        leave.refresh_from_db()
        self.assertEqual(leave.status, 'PENDING')

    def test_reject_non_admin_403(self):
        leave = self._make_leave(self.user)
        resp = self.user_api.patch(
            reverse('leave-request-reject', args=[leave.pk]),
        )
        self.assertEqual(resp.status_code, 403)

    def test_approve_anonyme_401(self):
        leave = self._make_leave(self.user)
        resp = self.anon.patch(
            reverse('leave-request-approve', args=[leave.pk]),
        )
        self.assertIn(resp.status_code, (401, 403))

    # ── my_leaves / balance ──

    def test_my_leaves(self):
        self._make_leave(self.user)
        self._make_leave(self.other)
        resp = self.user_api.get(reverse('leave-request-my-leaves'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['user_detail']['id'], self.user.id)

    def test_balance_defaut_26_jours(self):
        resp = self.user_api.get(reverse('leave-request-balance'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['annual_days'], 26)
        self.assertEqual(resp.data['used_days'], 0)
        self.assertEqual(resp.data['pending_days'], 0)
        self.assertEqual(resp.data['remaining_days'], 26)

    def test_balance_calculee(self):
        ShiftConfig.objects.create(pk=1, annual_leave_days=10)
        self._make_leave(self.user, status_='APPROVED',
                         start='2024-01-01', end='2024-01-05')   # 5 j
        self._make_leave(self.user, status_='PENDING',
                         start='2024-02-01', end='2024-02-03')   # 3 j
        # Non comptabilisés : REJECTED et type != CONGE
        self._make_leave(self.user, status_='REJECTED',
                         start='2024-03-01', end='2024-03-10')
        self._make_leave(self.user, status_='APPROVED', leave_type='MALADIE',
                         start='2024-04-01', end='2024-04-05')
        resp = self.user_api.get(reverse('leave-request-balance'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['annual_days'], 10)
        self.assertEqual(resp.data['used_days'], 5)
        self.assertEqual(resp.data['pending_days'], 3)
        self.assertEqual(resp.data['remaining_days'], 5)

    def test_balance_ne_compte_que_ses_conges(self):
        self._make_leave(self.other, status_='APPROVED',
                         start='2024-01-01', end='2024-01-10')  # 10 j autre user
        resp = self.user_api.get(reverse('leave-request-balance'))
        self.assertEqual(resp.data['used_days'], 0)
