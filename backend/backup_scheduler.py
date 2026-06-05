#!/usr/bin/env python
"""
Backup Scheduler — Tourne en boucle dans le container Docker
et déclenche les backups automatiques selon la configuration.
"""
import os
import sys
import time
import subprocess

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '/app')

import django
django.setup()

from django.utils import timezone
from datetime import datetime, timedelta
from api.models.settings import PharmacySettings


def run_backup():
    """Exécute la commande auto_backup."""
    print(f"[{timezone.localtime().strftime('%H:%M:%S')}] Déclenchement backup automatique...")
    try:
        result = subprocess.run(
            [sys.executable, 'manage.py', 'auto_backup'],
            cwd='/app',
            capture_output=True,
            text=True,
            timeout=300
        )
        output = result.stdout.strip()
        if output:
            print(output)
        if result.returncode != 0 and result.stderr:
            print(f"ERREUR: {result.stderr.strip()}")
    except Exception as e:
        print(f"ERREUR lors du backup: {e}")


def main():
    print("══════════════════════════════════════════════")
    print("  Backup Scheduler démarré")
    print("══════════════════════════════════════════════")
    print(f"  Heure actuelle: {timezone.localtime().strftime('%Y-%m-%d %H:%M:%S')}")
    print("  Vérification toutes les 5 minutes...")
    print("")

    while True:
        try:
            conf, _ = PharmacySettings.objects.get_or_create(pk=1)
            interval = conf.backup_interval_minutes or 1440

            # Vérifier si on doit lancer
            now = timezone.localtime()
            should_run = False

            if not conf.backup_enabled:
                print(f"[{now.strftime('%H:%M')}] Backup auto désactivé — skipping")
            else:
                if interval >= 1440:
                    # Quotidien+: vérifier si on est dans la fenêtre horaire
                    scheduled_time = conf.backup_time
                    current_dt = datetime.combine(now.date(), now.time())
                    scheduled_dt = datetime.combine(now.date(), scheduled_time)
                    diff_mins = (current_dt - scheduled_dt).total_seconds() / 60

                    if 0 <= diff_mins <= 31:
                        should_run = True
                else:
                    # Court intervalle: vérifier le temps depuis dernier backup
                    from django.conf import settings as django_settings
                    import os as os_module
                    backup_dir = os_module.path.join(django_settings.BASE_DIR, 'backups')
                    last_backup_time = None
                    if os_module.path.exists(backup_dir):
                        backups = [f for f in os_module.listdir(backup_dir)
                                   if f.startswith('backup_') and f.endswith('.sql.gz')]
                        if backups:
                            latest_file = max([os_module.path.join(backup_dir, f) for f in backups],
                                              key=os_module.path.getmtime)
                            last_backup_time = datetime.fromtimestamp(os_module.path.getmtime(latest_file))

                    if last_backup_time:
                        minutes_since = (now - timezone.localtime(last_backup_time)).total_seconds() / 60
                        if minutes_since >= interval:
                            should_run = True
                    else:
                        should_run = True  # Aucun backup encore

                if should_run:
                    run_backup()
                else:
                    print(f"[{now.strftime('%H:%M')}] Pas encore l'heure (intervalle: {interval} min)")

        except Exception as e:
            print(f"ERREUR scheduler: {e}")

        # Vérifier toutes les 5 minutes
        time.sleep(300)


if __name__ == '__main__':
    main()
