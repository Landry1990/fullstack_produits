from django.core.management.base import BaseCommand
from django.conf import settings
from typing import cast
import subprocess
import os
import sys
import gzip
import shutil
import tempfile

class Command(BaseCommand):
    help = 'Restores the PostgreSQL database from a .sql.gz backup file'

    def add_arguments(self, parser):
        parser.add_argument('backup_file', type=str, help='Path to the .sql.gz backup file')
        parser.add_argument('--no-confirm', action='store_true', help='Skip confirmation prompt')

    def find_psql(self):
        """Try to find psql executable on Windows or Linux"""
        # 1. Check if psql is in PATH (universal)
        try:
            result = subprocess.run(['psql', '--version'], capture_output=True)
            if result.returncode == 0:
                return 'psql'
        except FileNotFoundError:
            pass

        # 2. Windows specific common paths
        if sys.platform == 'win32':
            common_paths = [
                r'C:\Program Files\PostgreSQL\16\bin\psql.exe',
                r'C:\Program Files\PostgreSQL\15\bin\psql.exe',
                r'C:\Program Files\PostgreSQL\14\bin\psql.exe',
                r'C:\Program Files\PostgreSQL\13\bin\psql.exe',
                r'C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe',
            ]
            for path in common_paths:
                if os.path.exists(path):
                    return path
            
            for program_files in [r'C:\Program Files', r'C:\Program Files (x86)']:
                if os.path.exists(program_files):
                    postgres_dir = os.path.join(program_files, 'PostgreSQL')
                    if os.path.exists(postgres_dir):
                        for version_dir in os.listdir(postgres_dir):
                            psql_path = os.path.join(postgres_dir, version_dir, 'bin', 'psql.exe')
                            if os.path.exists(psql_path):
                                return psql_path

        # 3. Linux specific common paths (if not in PATH)
        if sys.platform != 'win32':
            linux_paths = [
                '/usr/bin/psql',
                '/usr/local/bin/psql',
                '/usr/pgsql/bin/psql'
            ]
            for path in linux_paths:
                if os.path.exists(path):
                    return path
        return None


    def handle(self, *args, **options):
        backup_file_gz = options['backup_file']
        no_confirm = options['no_confirm']

        if not os.path.exists(backup_file_gz):
            self.stdout.write(self.style.ERROR(f'File not found: {backup_file_gz}'))
            return

        psql_cmd = self.find_psql()
        if not psql_cmd:
            self.stdout.write(self.style.ERROR('psql not found! Please install PostgreSQL or add it to your PATH.'))
            return

        # Warning
        if not no_confirm:
            self.stdout.write(self.style.WARNING(
                "!!! WARNING !!!\n"
                "This operation will OVERWRITE the current database data.\n"
                "Are you sure you want to continue? (yes/no): "
            ))
            confirm = input().lower()
            if confirm != 'yes':
                self.stdout.write("Restoration cancelled.")
                return

        # Get database settings
        db_settings = settings.DATABASES['default']
        db_name = db_settings['NAME']
        db_user = db_settings['USER']
        db_password = db_settings['PASSWORD']
        db_host = db_settings['HOST']
        db_port = db_settings['PORT']

        # Create a temporary directory for decompression
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_sql_file = os.path.join(temp_dir, 'restore.sql')

            is_gz = backup_file_gz.endswith('.gz')
            if is_gz:
                self.stdout.write(f"Decompressing {backup_file_gz}...")
                try:
                    with gzip.open(backup_file_gz, 'rb') as f_in:
                        with open(temp_sql_file, 'wb') as f_out:
                            shutil.copyfileobj(cast(gzip.GzipFile, f_in), f_out)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Decompression failed: {str(e)}'))
                    return
            else:
                self.stdout.write(f"Using plain SQL file: {backup_file_gz}")
                temp_sql_file = backup_file_gz

            self.stdout.write(f"Starting restoration to database: {db_name}...")
            try:
                env = os.environ.copy()
                env['PGPASSWORD'] = db_password

                # 1. Wipe the current schema to ensure a clean slate
                # This is necessary because older backups might not have --clean
                self.stdout.write("Wiping existing schema 'public'...")
                wipe_command = [
                    psql_cmd,
                    '-h', db_host,
                    '-p', db_port,
                    '-U', db_user,
                    '-d', db_name,
                    '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
                ]
                
                subprocess.run(wipe_command, env=env, capture_output=True, check=True)

                # 2. Run the actual restoration
                # We use --set ON_ERROR_STOP=1 to make sure we catch any SQL errors
                restore_command = [
                    psql_cmd,
                    '-h', db_host,
                    '-p', db_port,
                    '-U', db_user,
                    '-d', db_name,
                    '--set', 'ON_ERROR_STOP=1',
                    '-f', temp_sql_file,
                ]

                result = subprocess.run(
                    restore_command,
                    env=env,
                    capture_output=True,
                    text=True
                )

                if result.returncode != 0:
                    self.stdout.write(self.style.ERROR(f'Restoration failed: {result.stderr}'))
                    return
                
                self.stdout.write(self.style.SUCCESS('Database content restored successfully!'))
                
                # 3. Reset PostgreSQL sequences to avoid IntegrityErrors
                self.stdout.write("Resetting PostgreSQL sequences for 'api' app...")
                try:
                    from django.core.management import call_command
                    from django.db import connection
                    from io import StringIO
                    
                    output = StringIO()
                    call_command('sqlsequencereset', 'api', stdout=output)
                    sql_commands = output.getvalue()
                    
                    if sql_commands:
                        with connection.cursor() as cursor:
                            cursor.execute(sql_commands)
                        self.stdout.write(self.style.SUCCESS('Sequences reset successfully!'))
                    else:
                        self.stdout.write(self.style.WARNING('No sequences to reset found for app "api".'))
                except Exception as seq_err:
                    self.stdout.write(self.style.WARNING(f'Could not reset sequences: {str(seq_err)}'))
                    self.stdout.write("Tip: You might need to run 'python manage.py sqlsequencereset api' manually.")
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error during restoration: {str(e)}'))
