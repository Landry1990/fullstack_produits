from datetime import date
from decimal import Decimal
from importlib import import_module
from io import StringIO
from unittest.mock import patch

from django.apps import apps
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase

from api.models import (
    AuditLog, CompteComptable, EcritureComptable, ExerciceComptable,
    JournalComptable, LigneEcriture,
)
from api.services.compta_liasse import compute_ebe


class ReclassementChargesTests(TestCase):
    def setUp(self):
        self.exercice = ExerciceComptable.objects.create(
            nom='EX2026', date_debut=date(2026, 1, 1), date_fin=date(2026, 12, 31))
        self.journal, _ = JournalComptable.objects.get_or_create(code='CA', defaults={'nom': 'Caisse'})
        self.caisse, _ = CompteComptable.objects.get_or_create(
            numero='571100', defaults={'libelle': 'Caisse', 'type': 'ACTIF'})
        self.loyer = self.charge('613000', 'Loyer', '250000')
        self.internet = self.charge('622000', 'Internet & Téléphone', '15000')

    def charge(self, numero, libelle, montant):
        compte, _ = CompteComptable.objects.update_or_create(
            numero=numero, defaults={'libelle': libelle, 'type': 'CHARGE', 'is_active': True})
        piece = EcritureComptable.objects.create(
            date=date(2026, 7, 18), exercice=self.exercice, journal=self.journal,
            reference=f'TEST-{numero}', libelle=libelle)
        ligne = LigneEcriture.objects.create(ecriture=piece, compte=compte, debit=Decimal(montant))
        LigneEcriture.objects.create(ecriture=piece, compte=self.caisse, credit=Decimal(montant))
        return ligne

    def run_command(self, ids=None, apply=False):
        output = StringIO()
        arguments = [arg for pk in (ids or [self.loyer.pk, self.internet.pk]) for arg in ('--ligne', str(pk))]
        call_command('reclasser_charges_syscohada', *arguments, apply_changes=apply, stdout=output)
        return output.getvalue()

    def report(self):
        return {row['ref']: row['montant'] for row in compute_ebe(date(2026, 1, 1), date(2026, 12, 31))['lignes']}

    def test_dry_run_does_not_write(self):
        count = EcritureComptable.objects.count()
        audits = AuditLog.objects.count()
        self.assertIn('Simulation uniquement', self.run_command())
        self.assertEqual(EcritureComptable.objects.count(), count)
        self.assertEqual(AuditLog.objects.count(), audits)
        self.assertFalse(JournalComptable.objects.filter(code='OD').exists())

    def test_reclassification_preserves_originals_cash_dates_and_ebe(self):
        before = self.report()
        original = list(LigneEcriture.objects.values('id', 'ecriture_id', 'compte_id', 'debit', 'credit'))
        cash = list(self.caisse.lignes.values_list('pk', 'debit', 'credit'))
        self.run_command(apply=True)
        after = self.report()
        self.assertEqual(before['XD'], after['XD'])
        self.assertEqual(after['RG'], Decimal('0'))
        self.assertEqual(after['RH'], Decimal('-265000'))
        self.assertEqual(original, list(LigneEcriture.objects.filter(pk__in=[r['id'] for r in original]).values(
            'id', 'ecriture_id', 'compte_id', 'debit', 'credit')))
        self.assertEqual(cash, list(self.caisse.lignes.values_list('pk', 'debit', 'credit')))
        corrections = EcritureComptable.objects.filter(reference__startswith='RECL-CHARGE-')
        self.assertEqual(corrections.count(), 2)
        for correction in corrections:
            self.assertTrue(correction.is_balanced())
            self.assertTrue(correction.est_liee)
            self.assertEqual(correction.date, self.loyer.ecriture.date)
            self.assertEqual(correction.exercice_id, self.exercice.pk)
            self.assertTrue(AuditLog.objects.filter(model_name='EcritureComptable', object_id=str(correction.pk)).exists())
        self.loyer.compte.refresh_from_db()
        self.internet.compte.refresh_from_db()
        self.assertFalse(self.loyer.compte.is_active)
        self.assertFalse(self.internet.compte.is_active)

    def test_repeated_application_is_idempotent(self):
        self.run_command(apply=True)
        count = EcritureComptable.objects.count()
        self.assertIn('déjà reclassée', self.run_command(apply=True))
        self.assertEqual(EcritureComptable.objects.count(), count)

    def test_closed_exercise_refused(self):
        self.exercice.est_cloture = True
        self.exercice.save(update_fields=['est_cloture'])
        with self.assertRaises(CommandError):
            self.run_command(apply=True)
        self.assertFalse(EcritureComptable.objects.filter(reference__startswith='RECL-CHARGE-').exists())

    def test_unknown_line_refused(self):
        with self.assertRaises(CommandError):
            self.run_command(ids=[self.loyer.pk, 99999999], apply=True)

    def test_ambiguous_charge_refused(self):
        self.loyer.ecriture.libelle = 'Dépense à vérifier'
        self.loyer.ecriture.save(update_fields=['libelle'])
        with self.assertRaises(CommandError):
            self.run_command(apply=True)

    def test_invalid_target_refused(self):
        CompteComptable.objects.update_or_create(numero='622200', defaults={'libelle': 'Test', 'type': 'ACTIF'})
        with self.assertRaises(CommandError):
            self.run_command(apply=True)

    def test_audit_failure_rolls_back_all_corrections(self):
        count = EcritureComptable.objects.count()
        with patch('api.management.commands.reclasser_charges_syscohada.log_audit', return_value=None):
            with self.assertRaises(CommandError):
                self.run_command(apply=True)
        self.assertEqual(EcritureComptable.objects.count(), count)
        self.assertFalse(JournalComptable.objects.filter(code='OD').exists())

    def test_seed_is_idempotent_and_preserves_used_and_custom_accounts(self):
        migration = import_module('api.migrations.0302_seed_charge_accounts_syscohada')
        cible, _ = CompteComptable.objects.update_or_create(
            numero='628000', defaults={'libelle': 'Télécom personnalisé', 'type': 'CHARGE'})
        with connection.schema_editor() as editor:
            migration.seed_charges(apps, editor)
            count = CompteComptable.objects.count()
            migration.seed_charges(apps, editor)
        cible.refresh_from_db()
        self.internet.compte.refresh_from_db()
        self.assertEqual(cible.libelle, 'Télécom personnalisé')
        self.assertEqual(self.internet.compte.libelle, 'Internet & Téléphone')
        self.assertEqual(CompteComptable.objects.count(), count)
        self.assertTrue(CompteComptable.objects.filter(numero='605500', type='CHARGE').exists())
