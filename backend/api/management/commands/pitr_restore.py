from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
import subprocess
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime


class Command(BaseCommand):
    help = 'Restauration PITR: restore un base backup + rejoue les WAL jusqu\'au timestamp choisi'

    def add_arguments(self, parser):
        parser.add_argument('base_backup_dir', type=str, help='Chemin du base backup (directory)')
        parser.add_argument('--target-time', type=str, default='', help='Timestamp cible (ex: 2026-07-23 14:29:00)')
        parser.add_argument('--no-confirm', action='store_true', help='Skip confirmation')

    def find_psql(self):
        try:
            result = subprocess.run(['psql', '--version'], capture_output=True)
            if result.returncode == 0:
                return 'psql'
        except FileNotFoundError:
            pass

        if sys.platform == 'win32':
            paths = [
                r'C:\Program Files\PostgreSQL\16\bin\psql.exe',
                r'C:\Program Files\PostgreSQL\15\bin\psql.exe',
            ]
            for p in paths:
                if os.path.exists(p):
                    return p

        linux_paths = ['/usr/bin/psql', '/usr/local/bin/psql']
        for p in linux_paths:
            if os.path.exists(p):
                return p
        return None

    def find_pg_ctl(self):
        try:
            result = subprocess.run(['pg_ctl', '--version'], capture_output=True)
            if result.returncode == 0:
                return 'pg_ctl'
        except FileNotFoundError:
            pass

        if sys.platform == 'win32':
            paths = [
                r'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe',
                r'C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe',
            ]
            for p in paths:
                if os.path.exists(p):
                    return p

        linux_paths = ['/usr/bin/pg_ctl', '/usr/local/bin/pg_ctl']
        for p in linux_paths:
            if os.path.exists(p):
                return p
        return None

    def handle(self, *args, **options):
        base_backup_dir = options['base_backup_dir']
        target_time = options['target_time']
        no_confirm = options['no_confirm']

        if not os.path.exists(base_backup_dir):
            raise CommandError(f'Base backup introuvable: {base_backup_dir}')

        wal_archive = '/wal_archive'
        if not os.path.exists(wal_archive):
            wal_archive = str(Path(settings.BASE_DIR).parent / 'wal_archive')
            if not os.path.exists(wal_archive):
                raise CommandError('Archive WAL introuvable. Le volume wal_archive est-il monté?')

        db = settings.DATABASES['default']
        pgdata = db.get('HOST', '') == 'db' and '/var/lib/postgresql/data' or db.get('HOST', '')

        self.stdout.write(self.style.WARNING('=' * 60))
        self.stdout.write(self.style.WARNING('  RESTAURATION PITR (Point-in-Time Recovery)'))
        self.stdout.write(self.style.WARNING('=' * 60))
        self.stdout.write(f'  Base backup: {base_backup_dir}')
        self.stdout.write(f'  WAL archive: {wal_archive}')
        if target_time:
            self.stdout.write(f'  Cible: {target_time}')
        else:
            self.stdout.write('  Cible: TOUS les WAL disponibles (récupération max)')
        self.stdout.write(self.style.WARNING('=' * 60))

        if not no_confirm:
            self.stdout.write(self.style.WARNING(
                '\nATTENTION: Cette opération va ÉCRASER la base actuelle.\n'
                'Tapez "yes" pour continuer: '
            ))
            confirm = input().lower()
            if confirm != 'yes':
                self.stdout.write('Restauration annulée.')
                return

        env = os.environ.copy()
        env['PGPASSWORD'] = db['PASSWORD']

        # Étape 1: Arrêter PostgreSQL si en cours
        pg_ctl = self.find_pg_ctl()
        if pg_ctl:
            self.stdout.write('\n[1/5] Arrêt de PostgreSQL...')
            subprocess.run([pg_ctl, 'stop', '-D', pgdata, '-m', 'fast'],
                         env=env, capture_output=True)

        # Étape 2: Sauvegarder les données actuelles
        self.stdout.write('[2/5] Sauvegarde de sécurité des données actuelles...')
        safety_dir = f'{pgdata}.pre_pitr_{datetime.now().strftime("%Y%m%d%H%M%S")}'
        if os.path.exists(pgdata):
            shutil.move(pgdata, safety_dir)
            self.stdout.write(f'  Données actuelles déplacées vers: {safety_dir}')

        # Étape 3: Copier le base backup vers pgdata
        self.stdout.write('[3/5] Restauration du base backup...')
        shutil.copytree(base_backup_dir, pgdata)

        # Supprimer postmaster.pid s'il existe
        postmaster_pid = os.path.join(pgdata, 'postmaster.pid')
        if os.path.exists(postmaster_pid):
            os.remove(postmaster_pid)

        # Étape 4: Configurer recovery.signal + recovery parameters
        self.stdout.write('[4/5] Configuration du recovery WAL...')
        recovery_conf = os.path.join(pgdata, 'postgresql.auto.conf')
        with open(recovery_conf, 'a') as f:
            f.write(f"\nrestore_command = 'cp {wal_archive}/%f %p'\n")
            if target_time:
                f.write(f"recovery_target_time = '{target_time}'\n")
            f.write("recovery_target_action = 'promote'\n")
            f.write("recovery_target_inclusive = true\n")

        # Créer recovery.signal (PostgreSQL 12+)
        recovery_signal = os.path.join(pgdata, 'recovery.signal')
        with open(recovery_signal, 'w') as f:
            pass

        # Étape 5: Démarrer PostgreSQL et attendre la fin du recovery
        self.stdout.write('[5/5] Démarrage de PostgreSQL et replay WAL...')
        if pg_ctl:
            result = subprocess.run(
                [pg_ctl, 'start', '-D', pgdata, '-w', '-l', '/tmp/pitr_recovery.log'],
                env=env, capture_output=True, text=True, timeout=120
            )
            if result.returncode != 0:
                self.stdout.write(self.style.ERROR(
                    f'Erreur démarrage PostgreSQL: {result.stderr}\n'
                    f'Voir /tmp/pitr_recovery.log'
                ))
                return

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  RESTAURATION PITR TERMINÉE'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        if target_time:
            self.stdout.write(f'  Base restaurée jusqu\'à: {target_time}')
        else:
            self.stdout.write('  Base restaurée avec tous les WAL disponibles')
        self.stdout.write(f'  Anciennes données sauvegardées: {safety_dir}')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('\nRedémarrez le backend Django pour utiliser la base restaurée.')
