from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from api.models import (
    AuditLog, CompteComptable, DotationAmortissement, EcritureComptable,
    ExerciceComptable, Immobilisation,
)
from api.views.comptabilite import ImmobilisationViewSet
from .factories import TestDataFactory


class ImmobilisationsTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = TestDataFactory.create_superuser()
        self.reader = TestDataFactory.create_user()
        self.year = timezone.localdate().year
        self.exercice = ExerciceComptable.objects.create(
            nom=f'IM{self.year}', date_debut=date(self.year, 1, 1), date_fin=date(self.year, 12, 31))
        self.asset, _ = CompteComptable.objects.get_or_create(
            numero='244000', defaults={'libelle': 'Matériel et mobilier', 'type': 'ACTIF'})
        self.amort, _ = CompteComptable.objects.get_or_create(
            numero='284000', defaults={'libelle': 'Amortissements du matériel', 'type': 'PASSIF'})
        self.payload = {
            'nom': 'Ordinateur', 'compte_immo': self.asset.pk, 'compte_amortissement': self.amort.pk,
            'date_acquisition': date(self.year, 1, 1).isoformat(), 'valeur_acquisition': '600000.00',
            'duree_annees': 5, 'valeur_residuelle': '0.00', 'mode_paiement': 'banque',
        }

    def request(self, method, action, data=None, pk=None, user=None):
        request = getattr(self.factory, method)('/', data=data or {}, format='json')
        force_authenticate(request, user=user or self.admin)
        return ImmobilisationViewSet.as_view({method: action})(request, **({'pk': pk} if pk else {}))

    def create_asset(self, **changes):
        response = self.request('post', 'create', {**self.payload, **changes})
        self.assertEqual(response.status_code, 201, response.data)
        return Immobilisation.objects.get(pk=response.data['id'])

    def test_creation_is_comptabilisee_and_audited(self):
        immo = self.create_asset()
        piece = EcritureComptable.objects.get(reference=f'IMMO-{immo.pk}')
        self.assertTrue(piece.is_balanced())
        self.assertEqual(piece.total_debit, Decimal('600000'))
        self.assertEqual(piece.exercice_id, self.exercice.pk)
        self.assertTrue(self.request('get', 'retrieve', pk=immo.pk).data['comptabilisee'])
        self.assertTrue(AuditLog.objects.filter(model_name='Immobilisation', object_id=str(immo.pk)).exists())

    def test_historical_acquisition_uses_matching_open_exercise(self):
        past = ExerciceComptable.objects.create(
            nom='IMPAST', date_debut=date(self.year - 1, 1, 1), date_fin=date(self.year - 1, 12, 31))
        immo = self.create_asset(date_acquisition=date(self.year - 1, 10, 1).isoformat())
        self.assertEqual(EcritureComptable.objects.get(reference=f'IMMO-{immo.pk}').exercice_id, past.pk)

    def test_creation_requires_open_exercise_without_creating_one(self):
        self.exercice.est_cloture = True
        self.exercice.save()
        before = ExerciceComptable.objects.count()
        response = self.request('post', 'create', self.payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ExerciceComptable.objects.count(), before)
        self.assertFalse(Immobilisation.objects.exists())

    def test_invalid_financial_parameters_refused(self):
        for changes in ({'duree_annees': 0}, {'valeur_residuelle': '600001'},
                        {'valeur_acquisition': '0'}, {'date_acquisition': (timezone.localdate() + timedelta(days=1)).isoformat()},
                        {'compte_immo': self.amort.pk}, {'compte_amortissement': self.asset.pk}):
            with self.subTest(changes=changes):
                response = self.request('post', 'create', {**self.payload, **changes})
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Immobilisation.objects.exists())

    def test_inactive_and_mismatched_accounts_refused(self):
        self.asset.is_active = False
        self.asset.save()
        self.assertEqual(self.request('post', 'create', self.payload).status_code, 400)
        self.asset.is_active = True
        self.asset.save()
        incorrect, _ = CompteComptable.objects.get_or_create(
            numero='281000', defaults={'libelle': 'Amortissements incorporels', 'type': 'PASSIF'})
        self.assertEqual(self.request('post', 'create', {**self.payload, 'compte_amortissement': incorrect.pk}).status_code, 400)

    def test_acquisition_failure_rolls_back_asset(self):
        before = EcritureComptable.objects.count()
        with patch('api.signals_comptabilite.LigneEcriture.objects.create', side_effect=RuntimeError('test écriture')):
            response = self.request('post', 'create', self.payload)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Immobilisation.objects.exists())
        self.assertEqual(EcritureComptable.objects.count(), before)

    def test_only_name_and_archiving_can_change_after_posting(self):
        immo = self.create_asset()
        piece = EcritureComptable.objects.get(reference=f'IMMO-{immo.pk}')
        before = list(piece.lignes.values_list('compte_id', 'debit', 'credit'))
        response = self.request('patch', 'partial_update', {'nom': 'Ordinateur bureau'}, pk=immo.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(piece.lignes.values_list('compte_id', 'debit', 'credit')), before)
        for changes in ({'valeur_acquisition': '700000'}, {'duree_annees': 10}, {'mode_paiement': 'especes'}):
            self.assertEqual(self.request('patch', 'partial_update', changes, pk=immo.pk).status_code, 400)
        self.assertEqual(self.request('patch', 'partial_update', {'is_active': False}, pk=immo.pk).status_code, 200)
        self.assertEqual(self.request('delete', 'destroy', pk=immo.pk).status_code, 400)
        self.assertTrue(Immobilisation.objects.filter(pk=immo.pk, is_active=False).exists())
        self.assertTrue(EcritureComptable.objects.filter(pk=piece.pk).exists())

    def test_regular_reader_cannot_create_edit_archive_or_delete(self):
        immo = self.create_asset()
        self.assertEqual(self.request('get', 'list', user=self.reader).status_code, 200)
        for method, action, data in [('post', 'create', self.payload), ('patch', 'partial_update', {'nom': 'Non'}),
                                     ('patch', 'partial_update', {'is_active': False}), ('delete', 'destroy', {})]:
            self.assertEqual(self.request(method, action, data, pk=immo.pk if method != 'post' else None,
                                          user=self.reader).status_code, 403)

    def test_archived_asset_cannot_be_depreciated(self):
        immo = self.create_asset()
        self.request('patch', 'partial_update', {'is_active': False}, pk=immo.pk)
        response = self.request('post', 'generer_dotation', {'annee': self.year}, pk=immo.pk)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(DotationAmortissement.objects.exists())

    def test_depreciation_is_unique_and_uses_year_end(self):
        immo = self.create_asset()
        response = self.request('post', 'generer_dotation', {'annee': self.year}, pk=immo.pk)
        self.assertEqual(response.status_code, 200, response.data)
        dotation = immo.dotations.get()
        self.assertEqual(dotation.ecriture.date, date(self.year, 12, 31))
        self.assertEqual(dotation.montant, Decimal('120000'))
        self.assertEqual(self.request('post', 'generer_dotation', {'annee': self.year}, pk=immo.pk).status_code, 400)

    def test_batch_skips_archived_assets_and_already_posted_year(self):
        active = self.create_asset()
        archived = self.create_asset(nom='Archivée')
        self.request('patch', 'partial_update', {'is_active': False}, pk=archived.pk)
        response = self.request('post', 'generer_dotations_annee', {'annee': self.year})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row['id'] for row in response.data['generees']], [active.pk])
        self.assertFalse(archived.dotations.exists())
        again = self.request('post', 'generer_dotations_annee', {'annee': self.year})
        self.assertEqual(len(again.data['generees']), 0)
        self.assertEqual(len(again.data['ignorees']), 1)

    def test_invalid_and_future_years_refused(self):
        immo = self.create_asset()
        for year in ('abc', self.year + 1, None, True, 2026.5):
            self.assertEqual(self.request('post', 'generer_dotation', {'annee': year}, pk=immo.pk).status_code, 400)

    def test_schedule_prorates_final_year_and_never_exceeds_base(self):
        immo = Immobilisation(date_acquisition=date(2020, 10, 1), valeur_acquisition=Decimal('1000.01'),
                              valeur_residuelle=Decimal('100'), duree_annees=2)
        amounts = [immo.montant_dotation(year) for year in range(2019, 2024)]
        self.assertEqual(amounts[0], 0)
        self.assertEqual(amounts[-1], 0)
        self.assertEqual(sum(amounts), Decimal('900.01'))
        self.assertLess(immo.montant_dotation(2022), immo.dotation_annuelle)
