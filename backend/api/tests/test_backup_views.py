"""
Tests pour api/views/backup_views.py (API backups web).

Couvre : BackupListView (listage incrémental/complet/groupé),
CreateBackupView, RestoreBackupView (validation + existence fichier),
DeleteBackupView.
"""
import gzip
import os
import tempfile
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

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
            self.assertGreater(resp.data['tables_backed_up'], 0)


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
