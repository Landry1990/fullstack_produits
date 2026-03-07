from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from api.models.settings import PharmacySettings
import os
from datetime import datetime

class Command(BaseCommand):
    help = 'Runs backup if enabled and time matches settings'

    def handle(self, *args, **options):
        settings, _ = PharmacySettings.objects.get_or_create(pk=1)
        
        if not settings.backup_enabled:
            self.stdout.write("Backup is disabled in settings.")
            return

        now = timezone.localtime().time()
        scheduled_time = settings.backup_time
        
        # Check if we are within 30 minutes of the scheduled time
        # This allows the task scheduler to run e.g. every 30 mins
        current_dt = datetime.combine(datetime.today(), now)
        scheduled_dt = datetime.combine(datetime.today(), scheduled_time)
        
        diff = (current_dt - scheduled_dt).total_seconds() / 60
        
        # If we are between 0 and 31 minutes AFTER the scheduled time
        if 0 <= diff <= 31:
            self.stdout.write(f"Time matches ({now} vs {scheduled_time}). Checking if already run today...")
            
            # Check if a backup file from today already exists in the backups folder
            from django.conf import settings as django_settings
            backup_dir = os.path.join(django_settings.BASE_DIR, 'backups')
            if os.path.exists(backup_dir):
                today_str = datetime.now().strftime('%Y%m%d')
                for f in os.listdir(backup_dir):
                    if f.startswith(f'backup_{today_str}') and f.endswith('.sql.gz'):
                        self.stdout.write("Backup already performed today. Skipping.")
                        return
            
            self.stdout.write("Starting automated backup...")
            call_command('backup_database')
            
            # handle secondary backup
            if settings.secondary_backup_path and os.path.exists(settings.secondary_backup_path):
                import shutil
                backups = [f for f in os.listdir(backup_dir) if f.endswith('.sql.gz')]
                if backups:
                    latest_backup = max([os.path.join(backup_dir, f) for f in backups], key=os.path.getmtime)
                    dest_path = os.path.join(settings.secondary_backup_path, os.path.basename(latest_backup))
                    shutil.copy2(latest_backup, dest_path)
                    self.stdout.write(f"Copy to secondary destination success: {dest_path}")
        else:
            self.stdout.write(f"Time does not match ({now} vs {scheduled_time}). Diff: {diff} mins")
