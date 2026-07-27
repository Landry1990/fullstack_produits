from django.core.management.base import BaseCommand
from django.conf import settings
import subprocess
import os
import sys
from datetime import datetime
from pathlib import Path
import shutil


class Command(BaseCommand):
    help = 'Crée un backup de base compatible WAL (pg_basebackup) pour PITR'

    def find_pg_basebackup(self):
        try:
            result = subprocess.run(['pg_basebackup', '--version'], capture_output=True)
            if result.returncode == 0:
                return 'pg_basebackup'
        except FileNotFoundError:
            pass

        if sys.platform == 'win32':
            common_paths = [
                r'C:\Program Files\PostgreSQL\16\bin\pg_basebackup.exe',
                r'C:\Program Files\PostgreSQL\15\bin\pg_basebackup.exe',
                r'C:\Program Files\PostgreSQL\14\bin\pg_basebackup.exe',
            ]
            for path in common_paths:
                if os.path.exists(path):
                    return path

        linux_paths = ['/usr/bin/pg_basebackup', '/usr/local/bin/pg_basebackup']
        for path in linux_paths:
            if os.path.exists(path):
                return path

        return None

    def handle(self, *args, **options):
        pg_cmd = self.find_pg_basebackup()
        if not pg_cmd:
            self.stdout.write(self.style.ERROR(
                'pg_basebackup introuvable! Installez PostgreSQL client tools.\n'
                '  - Linux: apt-get install -y postgresql-client\n'
                '  - Windows: C:\\Program Files\\PostgreSQL\\[version]\\bin'
            ))
            return

        backup_dir = Path(settings.BASE_DIR).parent / 'backups' / 'base'
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        base_dir = backup_dir / f'base-{timestamp}'
        backup_dir.mkdir(parents=True, exist_ok=True)

        db = settings.DATABASES['default']
        env = os.environ.copy()
        env['PGPASSWORD'] = db['PASSWORD']

        self.stdout.write(f'Création du backup de base WAL: {base_dir}')

        try:
            result = subprocess.run([
                pg_cmd,
                '-h', db['HOST'],
                '-p', str(db['PORT']),
                '-U', db['USER'],
                '-D', str(base_dir),
                '-F', 'plain',
                '-X', 'stream',
                '-P',
                '-v',
                '--no-password',
            ], env=env, capture_output=True, text=True, timeout=300)

            if result.returncode != 0:
                self.stdout.write(self.style.ERROR(
                    f'pg_basebackup échoué (code {result.returncode}): {result.stderr}\n'
                    f'stdout: {result.stdout}'
                ))
                return

            # Créer un fichier de métadonnées
            meta_file = base_dir / 'pitr_meta.txt'
            with open(meta_file, 'w') as f:
                f.write(f'base_backup_created={datetime.now().isoformat()}\n')
                f.write(f'pg_version={result.stderr.splitlines()[0] if result.stderr else "unknown"}\n')
                f.write(f'wal_archive_dir=/wal_archive\n')

            # Créer une archive tar pour faciliter le stockage
            tar_file = backup_dir / f'base-{timestamp}.tar'
            shutil.make_archive(str(tar_file.with_suffix('')), 'tar', str(base_dir))

            # Nettoyer les anciens base backups (garder 5)
            base_backups = sorted(
                [d for d in backup_dir.iterdir() if d.is_dir() and d.name.startswith('base-')],
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            for old in base_backups[5:]:
                shutil.rmtree(old, ignore_errors=True)
                tar_old = backup_dir / f'{old.name}.tar'
                if tar_old.exists():
                    tar_old.unlink()

            self.stdout.write(self.style.SUCCESS(
                f'[OK] Backup de base créé: {base_dir}\n'
                f'     Archive: {tar_file}\n'
                f'     WAL archives: /wal_archive (actif en continu)'
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erreur: {str(e)}'))
