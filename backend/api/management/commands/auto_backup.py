from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from api.models.settings import PharmacySettings
from django.conf import settings
from pathlib import Path
import os
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Runs backup if enabled and interval since last backup is reached'

    def handle(self, *args, **options):
        conf, _ = PharmacySettings.objects.get_or_create(pk=1)

        if not conf.backup_enabled:
            self.stdout.write("Backup automatique désactivé dans les paramètres.")
            return

        # Use shared backups folder (same as backup-db.sh and web interface)
        backup_dir = Path(settings.BASE_DIR).parent / 'backups'
        backup_dir.mkdir(parents=True, exist_ok=True)

        # Find the most recent backup file
        last_backup_time = None
        backups = [f for f in os.listdir(backup_dir) if f.startswith('backup-') and f.endswith('.sql')]
        if backups:
            latest_file = max([backup_dir / f for f in backups], key=lambda p: p.stat().st_mtime)
            last_backup_time = datetime.fromtimestamp(latest_file.stat().st_mtime)

        now = timezone.localtime()
        interval = conf.backup_interval_minutes or 1440

        # For daily or longer intervals: also respect the scheduled time
        if interval >= 1440:
            scheduled_time = conf.backup_time
            current_dt = datetime.combine(now.date(), now.time())
            scheduled_dt = datetime.combine(now.date(), scheduled_time)
            diff_mins = (current_dt - scheduled_dt).total_seconds() / 60

            # Must be within 30 minutes after scheduled time
            if not (0 <= diff_mins <= 31):
                self.stdout.write(f"Hors fenêtre horaire ({now.time()} vs {scheduled_time}). Diff: {diff_mins:.0f} min")
                return

            # Check if already done today
            if last_backup_time and last_backup_time.date() == now.date():
                self.stdout.write("Backup déjà effectué aujourd'hui. Skipping.")
                return
        else:
            # Short interval: check minutes since last backup
            if last_backup_time:
                aware_last = timezone.make_aware(last_backup_time)
                minutes_since = (now - aware_last).total_seconds() / 60
                if minutes_since < interval:
                    self.stdout.write(f"Dernier backup il y a {minutes_since:.0f} min (intervalle: {interval} min). Skipping.")
                    return

        self.stdout.write(f"Lancement du backup automatique (intervalle: {interval} min)...")
        call_command('backup_database')

