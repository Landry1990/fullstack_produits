from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from api.models.settings import PharmacySettings
import os
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Runs backup if enabled and interval since last backup is reached'

    def handle(self, *args, **options):
        conf, _ = PharmacySettings.objects.get_or_create(pk=1)

        if not conf.backup_enabled:
            self.stdout.write("Backup automatique désactivé dans les paramètres.")
            return

        from django.conf import settings as django_settings
        backup_dir = os.path.join(django_settings.BASE_DIR, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        # Find the most recent backup file
        last_backup_time = None
        backups = [f for f in os.listdir(backup_dir) if f.startswith('backup_') and f.endswith('.sql.gz')]
        if backups:
            latest_file = max([os.path.join(backup_dir, f) for f in backups], key=os.path.getmtime)
            last_backup_time = datetime.fromtimestamp(os.path.getmtime(latest_file))

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
                minutes_since = (now - timezone.localtime(last_backup_time)).total_seconds() / 60
                if minutes_since < interval:
                    self.stdout.write(f"Dernier backup il y a {minutes_since:.0f} min (intervalle: {interval} min). Skipping.")
                    return

        self.stdout.write(f"Lancement du backup automatique (intervalle: {interval} min)...")
        call_command('backup_database')

        # Handle secondary backup
        if conf.secondary_backup_path and os.path.exists(conf.secondary_backup_path):
            import shutil
            backups = [f for f in os.listdir(backup_dir) if f.endswith('.sql.gz')]
            if backups:
                latest_backup = max([os.path.join(backup_dir, f) for f in backups], key=os.path.getmtime)
                dest_path = os.path.join(conf.secondary_backup_path, os.path.basename(latest_backup))
                shutil.copy2(latest_backup, dest_path)
                self.stdout.write(f"Copie vers destination secondaire OK: {dest_path}")
