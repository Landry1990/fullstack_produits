from django.core.management.base import BaseCommand
from django.conf import settings
import subprocess
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import shutil


class Command(BaseCommand):
    help = 'Creates a backup of the PostgreSQL database'

    def find_pg_dump(self):
        """Try to find pg_dump executable on Windows or Linux"""
        # 1. Check if pg_dump is in PATH (universal)
        try:
            result = subprocess.run(['pg_dump', '--version'], capture_output=True)
            if result.returncode == 0:
                return 'pg_dump'
        except FileNotFoundError:
            pass

        # 2. Windows specific common paths
        if sys.platform == 'win32':
            common_paths = [
                r'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe',
                r'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe',
                r'C:\Program Files\PostgreSQL\14\bin\pg_dump.exe',
                r'C:\Program Files\PostgreSQL\13\bin\pg_dump.exe',
                r'C:\Program Files (x86)\PostgreSQL\16\bin\pg_dump.exe',
            ]
            for path in common_paths:
                if os.path.exists(path):
                    return path
            
            for program_files in [r'C:\Program Files', r'C:\Program Files (x86)']:
                if os.path.exists(program_files):
                    postgres_dir = os.path.join(program_files, 'PostgreSQL')
                    if os.path.exists(postgres_dir):
                        for version_dir in os.listdir(postgres_dir):
                            pg_dump_path = os.path.join(postgres_dir, version_dir, 'bin', 'pg_dump.exe')
                            if os.path.exists(pg_dump_path):
                                return pg_dump_path
        
        # 3. Linux specific common paths (if not in PATH)
        if sys.platform != 'win32':
            linux_paths = [
                '/usr/bin/pg_dump',
                '/usr/local/bin/pg_dump',
                '/usr/pgsql/bin/pg_dump'
            ]
            for path in linux_paths:
                if os.path.exists(path):
                    return path
        
        return None


    def handle(self, *args, **options):
        # Find pg_dump
        pg_dump_cmd = self.find_pg_dump()
        
        if not pg_dump_cmd:
            self.stdout.write(self.style.ERROR(
                'pg_dump not found! Please install PostgreSQL or add it to your PATH.\n'
                'Common locations:\n'
                '  - C:\\Program Files\\PostgreSQL\\[version]\\bin\n'
                '\nOr set PG_DUMP_PATH environment variable.'
            ))
            return

        self.stdout.write(self.style.SUCCESS(f'Using pg_dump: {pg_dump_cmd}'))

        # Create backups directory if it doesn't exist
        # Use the shared backups folder (same as backup-db.sh and the web interface)
        backup_dir = Path(settings.BASE_DIR).parent / 'backups'
        backup_dir.mkdir(parents=True, exist_ok=True)

        # Generate timestamp filename (same format as backup-db.sh)
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup_file = backup_dir / f'backup-{timestamp}.sql'
        checksum_file = backup_dir / f'backup-{timestamp}.sql.md5'

        # Get database settings
        db_settings = settings.DATABASES['default']
        db_name = db_settings['NAME']
        db_user = db_settings['USER']
        db_password = db_settings['PASSWORD']
        db_host = db_settings['HOST']
        db_port = db_settings['PORT']

        self.stdout.write(self.style.SUCCESS(f'Starting backup of database: {db_name}'))

        try:
            # Set environment variable for password
            env = os.environ.copy()
            env['PGPASSWORD'] = db_password

            # Execute pg_dump
            dump_command = [
                pg_dump_cmd,
                '-h', db_host,
                '-p', db_port,
                '-U', db_user,
                '--clean',
                '--if-exists',
                '-F', 'p',  # Plain text format
                '-f', backup_file,
                db_name
            ]

            result = subprocess.run(
                dump_command,
                env=env,
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                self.stdout.write(self.style.ERROR(f'Backup failed: {result.stderr}'))
                return

            # Generate MD5 checksum
            import hashlib
            hasher = hashlib.md5()
            with open(backup_file, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    hasher.update(chunk)
            with open(checksum_file, 'w') as f:
                f.write(f"{hasher.hexdigest()}  {backup_file.name}\n")

            # Get file size
            file_size = backup_file.stat().st_size / (1024 * 1024)  # MB

            self.stdout.write(self.style.SUCCESS(
                f'[OK] Backup created successfully: {backup_file} ({file_size:.2f} MB)'
            ))
            self.stdout.write(f'   MD5: {hasher.hexdigest()}')

            # Upload to cloud (S3-compatible)
            self.upload_to_cloud(str(backup_file))

            # Copy to Google Drive (local mounted path)
            self.copy_to_google_drive(str(backup_file))

            # Clean old backups (keep last N backups based on settings)
            from api.models.settings import PharmacySettings
            conf, _ = PharmacySettings.objects.get_or_create(pk=1)
            retention = conf.backup_retention_count or 30
            self.cleanup_old_backups(str(backup_dir), retention_count=retention)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error during backup: {str(e)}'))

    def cleanup_old_backups(self, backup_dir, retention_count=30):
        """Keep only the N most recent backups (.sql + .sql.md5)"""
        backups = []
        for filename in os.listdir(backup_dir):
            if filename.startswith('backup-') and filename.endswith('.sql'):
                filepath = os.path.join(backup_dir, filename)
                backups.append((filepath, os.path.getmtime(filepath)))

        # Sort by modification time descending
        backups.sort(key=lambda x: x[1], reverse=True)

        removed_count = 0
        for filepath, _ in backups[retention_count:]:
            os.remove(filepath)
            # Also remove associated MD5 file
            md5_path = filepath + '.md5'
            if os.path.exists(md5_path):
                os.remove(md5_path)
            removed_count += 1

        if removed_count > 0:
            self.stdout.write(self.style.WARNING(
                f'[CLEANUP] Supprimé {removed_count} backup(s) (conservé les {retention_count} plus récents)'
            ))

    def copy_to_google_drive(self, backup_file_path):
        """Copy backup file to a locally mounted Google Drive folder"""
        try:
            from api.models.settings import PharmacySettings
            conf, _ = PharmacySettings.objects.get_or_create(pk=1)

            gdrive_path = (conf.google_drive_backup_path or '').strip()
            if not gdrive_path:
                return

            if not os.path.exists(gdrive_path):
                self.stdout.write(self.style.WARNING(
                    f'[GDRIVE] Chemin Google Drive configuré mais introuvable: {gdrive_path}'
                ))
                return

            import shutil
            gdrive_backup_dir = os.path.join(gdrive_path, 'pharmacie-backups')
            os.makedirs(gdrive_backup_dir, exist_ok=True)
            dest_path = os.path.join(gdrive_backup_dir, os.path.basename(backup_file_path))
            shutil.copy2(backup_file_path, dest_path)
            self.stdout.write(self.style.SUCCESS(
                f'[GDRIVE] Copie Google Drive OK: {dest_path}'
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'[GDRIVE] Erreur copie: {str(e)}'
            ))

    def upload_to_cloud(self, backup_file_path):
        """Upload backup file to S3-compatible cloud storage"""
        try:
            from api.models.settings import PharmacySettings
            conf, _ = PharmacySettings.objects.get_or_create(pk=1)

            if not conf.cloud_backup_enabled:
                return

            endpoint = (conf.cloud_backup_endpoint or '').strip()
            bucket = (conf.cloud_backup_bucket or '').strip()
            access_key = (conf.cloud_backup_access_key or '').strip()
            secret_key = (conf.cloud_backup_secret_key or '').strip()

            if not all([endpoint, bucket, access_key, secret_key]):
                self.stdout.write(self.style.WARNING(
                    '[CLOUD] Cloud backup activé mais paramètres incomplets — skipping'
                ))
                return

            import boto3
            from botocore.config import Config

            region = (conf.cloud_backup_region or '').strip()
            prefix = (conf.cloud_backup_path_prefix or 'pharmacie-backups/').strip()
            if prefix and not prefix.endswith('/'):
                prefix += '/'

            filename = os.path.basename(backup_file_path)
            s3_key = f"{prefix}{filename}"

            config = Config(
                signature_version='s3v4',
                retries={'max_attempts': 3, 'mode': 'standard'}
            )

            session_kwargs = {
                'service_name': 's3',
                'aws_access_key_id': access_key,
                'aws_secret_access_key': secret_key,
                'endpoint_url': f"https://{endpoint}",
                'config': config,
            }
            if region:
                session_kwargs['region_name'] = region

            s3 = boto3.client(**session_kwargs)

            self.stdout.write(f'[CLOUD] Upload vers {endpoint}/{bucket}/{s3_key} ...')
            s3.upload_file(backup_file_path, bucket, s3_key)
            self.stdout.write(self.style.SUCCESS(
                f'[CLOUD] Upload OK: {s3_key}'
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'[CLOUD] Erreur upload: {str(e)}'
            ))

