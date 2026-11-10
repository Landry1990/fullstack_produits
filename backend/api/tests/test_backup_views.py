"""
Tests pour api/views/backup_views.py (API backups web).

Couvre : BackupListView (listage incrémental/complet/groupé),
CreateBackupView, RestoreBackupView (validation + existence fichier),
DeleteBackupView.
"""
import gzip
import hashlib
import os
import tempfile
from datetime import datetime, time
from io import StringIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from api.management.commands.auto_backup import Command as AutoBackupCommand
from api.management.commands.backup_database import Command as BackupCommand
from api.management.commands.base_backup import Command as BaseBackupCommand

from .factories import TestDataFactory as F


class BackupBase(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.admin = F.create_superuser()
        self.client_api.force_authenticate(user=self.admin)


# ── Accès ─────────────────────────────────────────────────────────────────────

class BackupAccessTest(BackupBase):
    def test_non_admin_refuse(self):
        user = F.create_user()
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get(reverse('backup-list'))
        self.assertEqual(resp.status_code, 403)

    def test_anonyme_refuse(self):
        resp = APIClient().get(reverse('backup-list'))
        self.assertIn(resp.status_code, (401, 403))


# ── Listage ───────────────────────────────────────────────────────────────────

class BackupListTest(BackupBase):
    def test_liste_vide_quand_dirs_absents(self):
        with tempfile.TemporaryDirectory() as inc, \
             tempfile.TemporaryDirectory() as full:
            with patch('api.views.backup_views.BACKUP_DIR', inc + '/absent'), \
                 patch('api.views.backup_views.FULL_BACKUP_DIR', full + '/absent'):
                resp = self.client_api.get(reverse('backup-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['backups'], [])
        self.assertEqual(resp.data['count'], 0)

    def test_liste_incremental_et_full(self):
        with tempfile.TemporaryDirectory() as inc, \
             tempfile.TemporaryDirectory() as full:
            # Fichier incrémental : <date>_<heure>_<table>.sql.gz
            with gzip.open(os.path.join(inc, '20240609_143000_api_facture.sql.gz'), 'wb') as f:
                f.write(b'INSERT INTO api_facture VALUES (1);')
            # 2 fichiers même timestamp → groupés
            with gzip.open(os.path.join(inc, '20240609_143000_api_client.sql.gz'), 'wb') as f:
                f.write(b'INSERT INTO api_client VALUES (1);')
            # Fichier complet : full_<date>_<heure>.sql.gz
            with gzip.open(os.path.join(full, 'full_20240610_080000.sql.gz'), 'wb') as f:
                f.write(b'CREATE TABLE x;')

            with patch('api.views.backup_views.BACKUP_DIR', inc), \
                 patch('api.views.backup_views.FULL_BACKUP_DIR', full):
                resp = self.client_api.get(reverse('backup-list'))

        self.assertEqual(resp.status_code, 200)
        backups = resp.data['backups']
        self.assertEqual(resp.data['count'], 2)  # 1 groupe + 1 full

        groupe = next(b for b in backups if b['type'] == 'incremental')
        self.assertEqual(sorted(groupe['tables']),
                         ['api_client', 'api_facture'])
        self.assertTrue(groupe['filename'].startswith('group_'))

        complet = next(b for b in backups if b['type'] == 'full')
        self.assertIn('Complet', complet['date_formatted'])

    def test_tailles_formatees(self):
        with tempfile.TemporaryDirectory() as inc:
            # Données incompressibles > 1 Ko → taille gz > 1 Ko → format KB
            with gzip.open(os.path.join(inc, '20240101_000000_api_x.sql.gz'), 'wb') as f:
                f.write(os.urandom(4096))
            with patch('api.views.backup_views.BACKUP_DIR', inc), \
                 patch('api.views.backup_views.FULL_BACKUP_DIR', inc + '/none'):
                resp = self.client_api.get(reverse('backup-list'))
        self.assertIn('KB', resp.data['backups'][0]['size_formatted'])


# ── Création ──────────────────────────────────────────────────────────────────

class BackupCreateTest(BackupBase):
    def test_create_backup(self):
        """Crée un backup réel (docker exec pg_dump) dans un répertoire temporaire."""
        with tempfile.TemporaryDirectory() as inc:
            with patch('api.views.backup_views.BACKUP_DIR', inc):
                resp = self.client_api.post(reverse('backup-create'))
            fichiers = os.listdir(inc)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])
        self.assertIn('tables_backed_up', resp.data)
        # Si docker/pg_dump dispo dans le conteneur : des .sql.gz ont été créés
        if fichiers:
            self.assertTrue(all(f.endswith('.sql.gz') for f in fichiers))
            self.assertEqual(resp.data['tables_backed_up'], 16)
            self.assertEqual(len(fichiers), 16)


# ── Restauration ──────────────────────────────────────────────────────────────

class BackupRestoreTest(BackupBase):
    def test_sans_filename_400(self):
        resp = self.client_api.post(reverse('backup-restore'), {})
        self.assertEqual(resp.status_code, 400)

    def test_full_inexistant_404(self):
        resp = self.client_api.post(reverse('backup-restore'), {
            'filename': 'full_29990101_000000.sql.gz',
            'type': 'full',
        })
        self.assertEqual(resp.status_code, 404)

    def test_incremental_inexistant_404(self):
        """Un fichier incrémental absent → 404 (ne doit pas réussir silencieusement)."""
        resp = self.client_api.post(reverse('backup-restore'), {
            'filename': '29990101_000000_api_facture.sql.gz',
            'type': 'incremental',
        })
        self.assertEqual(resp.status_code, 404)

    def test_groupe_inexistant_404(self):
        resp = self.client_api.post(reverse('backup-restore'), {
            'filename': 'group_2999-01-01 00:00:00',
            'type': 'incremental',
        })
        self.assertEqual(resp.status_code, 404)


# ── Suppression ───────────────────────────────────────────────────────────────

class BackupDeleteTest(BackupBase):
    def test_supprime_fichier_incremental(self):
        with tempfile.TemporaryDirectory() as inc:
            path = os.path.join(inc, '20240101_000000_api_facture.sql.gz')
            with gzip.open(path, 'wb') as f:
                f.write(b'data')
            with patch('api.views.backup_views.BACKUP_DIR', inc), \
                 patch('api.views.backup_views.FULL_BACKUP_DIR', inc + '/none'):
                resp = self.client_api.delete(
                    reverse('backup-delete',
                            kwargs={'filename': '20240101_000000_api_facture.sql.gz'})
                )
            self.assertEqual(resp.status_code, 200)
            self.assertFalse(os.path.exists(path))

    def test_supprime_groupe(self):
        with tempfile.TemporaryDirectory() as inc:
            for table in ('api_facture', 'api_client'):
                with gzip.open(
                    os.path.join(inc, f'20240101_000000_{table}.sql.gz'), 'wb'
                ) as f:
                    f.write(b'data')
            with patch('api.views.backup_views.BACKUP_DIR', inc), \
                 patch('api.views.backup_views.FULL_BACKUP_DIR', inc + '/none'):
                resp = self.client_api.delete(
                    reverse('backup-delete',
                            kwargs={'filename': 'group_2024-01-01 00:00:00'})
                )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(os.listdir(inc), [])


class BackupDestinationsTest(SimpleTestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / 'backup-test.sql'
        self.source.write_bytes(b'-- Synthetic backup fixture\nSELECT 1;\n')
        self.checksum = Path(str(self.source) + '.md5')
        self.checksum.write_text(hashlib.md5(self.source.read_bytes(), usedforsecurity=False).hexdigest())
        self.output = StringIO()
        self.command = BackupCommand(stdout=self.output, no_color=True)
        self.conf = SimpleNamespace(
            secondary_backup_path='', external_backup_path_1='',
            external_backup_path_2='', external_backup_path_3='',
            google_drive_backup_path='', cloud_backup_enabled=False,
            cloud_backup_endpoint='', cloud_backup_bucket='',
            cloud_backup_access_key='', cloud_backup_secret_key='',
            cloud_backup_region='', cloud_backup_path_prefix='',
            backup_retention_count=2,
        )
        manager = patch('api.models.settings.PharmacySettings.objects.get_or_create',
                        return_value=(self.conf, False))
        manager.start()
        self.addCleanup(manager.stop)

    def destination(self, name):
        path = self.root / name
        path.mkdir()
        return path

    def assert_copied(self, destination, checksum=True):
        self.assertEqual((destination / self.source.name).read_bytes(), self.source.read_bytes())
        if checksum:
            self.assertEqual((destination / self.checksum.name).read_bytes(), self.checksum.read_bytes())

    def test_secondary_copy_and_checksum(self):
        destination = self.destination('secondary')
        self.conf.secondary_backup_path = str(destination)
        self.command.copy_to_secondary(str(self.source), str(self.checksum))
        self.assert_copied(destination)

    def test_three_external_destinations(self):
        destinations = [self.destination(f'external-{number}') for number in range(1, 4)]
        for number, destination in enumerate(destinations, 1):
            setattr(self.conf, f'external_backup_path_{number}', str(destination))
        self.command.copy_to_external(str(self.source), str(self.checksum))
        for destination in destinations:
            self.assert_copied(destination)

    def test_missing_external_destination_does_not_block_next(self):
        self.conf.external_backup_path_1 = str(self.root / 'absent')
        destination = self.destination('available')
        self.conf.external_backup_path_2 = str(destination)
        self.command.copy_to_external(str(self.source), str(self.checksum))
        self.assert_copied(destination)
        self.assertIn('Destination inaccessible', self.output.getvalue())

    def test_external_permission_error_does_not_block_next(self):
        first = self.destination('denied')
        second = self.destination('available')
        self.conf.external_backup_path_1 = str(first)
        self.conf.external_backup_path_2 = str(second)
        from shutil import copy2

        def copy(source, target):
            if Path(target).parent == first:
                raise PermissionError('Synthetic permission denial')
            return copy2(source, target)

        with patch('api.management.commands.backup_database.shutil.copy2', side_effect=copy):
            self.command.copy_to_external(str(self.source), str(self.checksum))
        self.assert_copied(second)
        self.assertIn('Erreur copie', self.output.getvalue())

    def test_google_drive_local_folder(self):
        destination = self.destination('drive')
        self.conf.google_drive_backup_path = str(destination)
        self.command.copy_to_google_drive(str(self.source))
        self.assert_copied(destination / 'pharmacie-backups', checksum=False)

    def test_google_drive_missing_folder(self):
        self.conf.google_drive_backup_path = str(self.root / 'absent')
        self.command.copy_to_google_drive(str(self.source))
        self.assertIn('introuvable', self.output.getvalue())
        self.assertFalse((self.root / 'absent').exists())

    def configure_cloud(self):
        self.conf.cloud_backup_enabled = True
        self.conf.cloud_backup_endpoint = 's3.example.invalid'
        self.conf.cloud_backup_bucket = 'synthetic-test-bucket'
        self.conf.cloud_backup_access_key = 'synthetic-test-access'
        self.conf.cloud_backup_secret_key = 'synthetic-test-secret'
        self.conf.cloud_backup_path_prefix = 'tests'

    def test_cloud_upload_arguments_without_network(self):
        self.configure_cloud()
        with patch('boto3.client') as client:
            self.command.upload_to_cloud(str(self.source))
        client.return_value.upload_file.assert_called_once_with(
            str(self.source), 'synthetic-test-bucket', 'tests/backup-test.sql')
        self.assertEqual(client.call_args.kwargs['endpoint_url'], 'https://s3.example.invalid')

    def test_cloud_disabled_does_not_connect(self):
        with patch('boto3.client') as client:
            self.command.upload_to_cloud(str(self.source))
        client.assert_not_called()

    def test_cloud_incomplete_configuration_does_not_connect(self):
        self.conf.cloud_backup_enabled = True
        with patch('boto3.client') as client:
            self.command.upload_to_cloud(str(self.source))
        client.assert_not_called()
        self.assertIn('paramètres incomplets', self.output.getvalue())

    def test_cloud_outage_is_reported(self):
        self.configure_cloud()
        with patch('boto3.client') as client:
            client.return_value.upload_file.side_effect = ConnectionError('Synthetic network outage')
            self.command.upload_to_cloud(str(self.source))
        self.assertIn('Erreur upload', self.output.getvalue())
        self.assertNotIn('Upload OK', self.output.getvalue())

    def test_retention_removes_only_old_test_backups_and_checksums(self):
        destination = self.destination('retention')
        for number in range(4):
            backup = destination / f'backup-{number}.sql'
            backup.write_text('synthetic SQL')
            Path(str(backup) + '.md5').write_text('synthetic checksum')
            os.utime(backup, (1000 + number, 1000 + number))
        (destination / 'unrelated.txt').write_text('keep')
        self.command.cleanup_old_backups(str(destination), retention_count=2)
        self.assertEqual(sorted(path.name for path in destination.iterdir()), [
            'backup-2.sql', 'backup-2.sql.md5', 'backup-3.sql',
            'backup-3.sql.md5', 'unrelated.txt',
        ])

    def test_full_backup_pipeline_with_simulated_pg_dump(self):
        def dump(arguments, **kwargs):
            target = Path(arguments[arguments.index('-f') + 1])
            target.write_bytes(self.source.read_bytes())
            return SimpleNamespace(returncode=0, stdout='', stderr='')

        with override_settings(BASE_DIR=self.root / 'app'), \
             patch.object(self.command, 'find_pg_dump', return_value='pg_dump'), \
             patch('api.management.commands.backup_database.subprocess.run', side_effect=dump):
            self.command.handle()
        backups = list((self.root / 'backups').glob('backup-*.sql'))
        self.assertEqual(len(backups), 1)
        actual_checksum = Path(str(backups[0]) + '.md5').read_text().split()[0]
        self.assertEqual(actual_checksum, hashlib.md5(backups[0].read_bytes(), usedforsecurity=False).hexdigest())
        self.assertIn('Backup created successfully', self.output.getvalue())

    def test_pg_dump_failure_never_copies_or_prunes(self):
        with override_settings(BASE_DIR=self.root / 'app'), \
             patch.object(self.command, 'find_pg_dump', return_value='pg_dump'), \
             patch('api.management.commands.backup_database.subprocess.run',
                   return_value=SimpleNamespace(returncode=1, stderr='Synthetic dump failure')), \
             patch.object(self.command, 'copy_to_secondary') as secondary, \
             patch.object(self.command, 'copy_to_external') as external, \
             patch.object(self.command, 'cleanup_old_backups') as cleanup:
            with self.assertRaises(CommandError):
                self.command.handle()
        secondary.assert_not_called()
        external.assert_not_called()
        cleanup.assert_not_called()
        self.assertIn('Backup failed', self.output.getvalue())

    def run_automatic_backup(self, *, enabled=True, interval=60, recent=False, now=None):
        now = now or datetime(2026, 11, 9, 10, 0)
        self.conf.backup_enabled = enabled
        self.conf.backup_interval_minutes = interval
        self.conf.backup_time = time(10, 0)
        if recent:
            directory = self.destination('backups')
            backup = directory / 'backup-recent.sql'
            backup.write_text('synthetic SQL')
            os.utime(backup, (now.timestamp() - 60, now.timestamp() - 60))
        command = AutoBackupCommand(stdout=self.output, no_color=True)
        with override_settings(BASE_DIR=self.root / 'app'), \
             patch('api.management.commands.auto_backup.timezone.localtime', return_value=now), \
             patch('api.management.commands.auto_backup.call_command') as run:
            command.handle()
        return run

    def test_automatic_backup_disabled(self):
        self.run_automatic_backup(enabled=False).assert_not_called()

    def test_automatic_backup_interval_due(self):
        self.run_automatic_backup().assert_called_once_with('backup_database')

    def test_automatic_backup_recent_interval_skipped(self):
        self.run_automatic_backup(recent=True).assert_not_called()

    def test_daily_backup_inside_window(self):
        self.run_automatic_backup(interval=1440).assert_called_once_with('backup_database')

    def test_daily_backup_outside_window(self):
        self.run_automatic_backup(interval=1440, now=datetime(2026, 11, 9, 12, 0)).assert_not_called()

    def test_daily_backup_not_repeated_same_day(self):
        self.run_automatic_backup(interval=1440, recent=True).assert_not_called()

    def test_base_backup_command_and_archive_without_real_database(self):
        command = BaseBackupCommand(stdout=self.output, no_color=True)

        def base_backup(arguments, **kwargs):
            target = Path(arguments[arguments.index('-D') + 1])
            target.mkdir()
            (target / 'PG_VERSION').write_text('15')
            return SimpleNamespace(returncode=0, stdout='', stderr='Synthetic base backup')

        with override_settings(BASE_DIR=self.root / 'app'), \
             patch.object(command, 'find_pg_basebackup', return_value='pg_basebackup'), \
             patch('api.management.commands.base_backup.subprocess.run', side_effect=base_backup):
            command.handle()
        directory = self.root / 'backups' / 'base'
        self.assertEqual(len(list(directory.glob('*.tar'))), 1)
        self.assertEqual(len(list(directory.glob('base-*/pitr_meta.txt'))), 1)
        self.assertIn('Backup de base créé', self.output.getvalue())


class BackupLocalDumpIntegrationTest(BackupBase):
    def test_real_pg_dump_of_test_database_with_checksum(self):
        output = StringIO()
        command = BackupCommand(stdout=output, no_color=True)
        if not command.find_pg_dump():
            self.skipTest('pg_dump indisponible')
        with tempfile.TemporaryDirectory() as directory, \
             override_settings(BASE_DIR=Path(directory) / 'app'), \
             patch.object(command, 'copy_to_secondary'), \
             patch.object(command, 'copy_to_external'), \
             patch.object(command, 'copy_to_google_drive'), \
             patch.object(command, 'upload_to_cloud'):
            command.handle()
            backups = list((Path(directory) / 'backups').glob('backup-*.sql'))
            self.assertEqual(len(backups), 1)
            content = backups[0].read_bytes()
            self.assertIn(b'CREATE TABLE public.api_facture', content)
            self.assertIn(b'PostgreSQL database dump complete', content)
            checksum = Path(str(backups[0]) + '.md5').read_text().split()[0]
            self.assertEqual(checksum, hashlib.md5(content, usedforsecurity=False).hexdigest())
            self.assertIn('Backup created successfully', output.getvalue())


class BackupFailureReportingTest(BackupBase):
    def test_zero_exported_tables_must_not_be_reported_as_success(self):
        with tempfile.TemporaryDirectory() as directory, \
             patch('api.views.backup_views.BACKUP_DIR', directory), \
             patch('api.views.backup_views.subprocess.run',
                   return_value=SimpleNamespace(returncode=1, stdout='', stderr='Synthetic failure')):
            response = self.client_api.post(reverse('backup-create'))
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data['success'])

    def test_partial_export_must_not_publish_backup(self):
        def export(arguments, **kwargs):
            table = arguments[-1]
            if table == 'api_client':
                return SimpleNamespace(returncode=1, stdout='', stderr='Synthetic failure')
            return SimpleNamespace(returncode=0, stdout='-- Synthetic SQL', stderr='')

        with tempfile.TemporaryDirectory() as directory, \
             patch('api.views.backup_views.BACKUP_DIR', directory), \
             patch('api.views.backup_views.subprocess.run', side_effect=export):
            response = self.client_api.post(reverse('backup-create'))
            self.assertEqual(os.listdir(directory), [])
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data['success'])
        self.assertIn('api_client', response.data['failed_tables'])

    def test_command_exception_must_not_be_reported_as_success(self):
        with patch('django.core.management.call_command', side_effect=CommandError('Échec de sauvegarde')):
            response = self.client_api.post('/api/system-admin/run_backup/')
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data['success'])

    def test_empty_command_output_must_not_be_reported_as_success(self):
        with patch('django.core.management.call_command'):
            response = self.client_api.post('/api/system-admin/run_backup/')
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data['success'])

    def test_unexpected_backup_error_must_not_be_reported_as_success(self):
        with patch('django.core.management.call_command',
                   side_effect=lambda *args, **kwargs: kwargs['stdout'].write('Error during backup: synthetic disk error')):
            response = self.client_api.post('/api/system-admin/run_backup/')
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data['success'])
