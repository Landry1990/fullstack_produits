from django.core.management.base import BaseCommand
from django.conf import settings
import subprocess
import os
import sys
from datetime import datetime, timedelta
import gzip
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
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        # Generate timestamp filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(backup_dir, f'backup_{timestamp}.sql')
        backup_file_gz = f'{backup_file}.gz'

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

            # Compress the backup
            self.stdout.write('Compressing backup...')
            with open(backup_file, 'rb') as f_in:
                with gzip.open(backup_file_gz, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)

            # Remove uncompressed file
            os.remove(backup_file)

            # Get file size
            file_size = os.path.getsize(backup_file_gz) / (1024 * 1024)  # MB

            self.stdout.write(self.style.SUCCESS(
                f'[OK] Backup created successfully: {backup_file_gz} ({file_size:.2f} MB)'
            ))

            # Clean old backups (keep last 30 days)
            self.cleanup_old_backups(backup_dir, days=30)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error during backup: {str(e)}'))

    def cleanup_old_backups(self, backup_dir, days=30):
        """Remove backups older than specified days"""
        cutoff_date = datetime.now() - timedelta(days=days)
        removed_count = 0

        for filename in os.listdir(backup_dir):
            if filename.startswith('backup_') and filename.endswith('.sql.gz'):
                filepath = os.path.join(backup_dir, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))

                if file_time < cutoff_date:
                    os.remove(filepath)
                    removed_count += 1

        if removed_count > 0:
            self.stdout.write(self.style.WARNING(
                f'[CLEANUP] Removed {removed_count} old backup(s)'
            ))

