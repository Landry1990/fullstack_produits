import logging
import os
import tempfile
import threading
import time
from datetime import timedelta

try:
    import fcntl
except ImportError:  # pragma: no cover (Windows)
    fcntl = None
from django.core.management import call_command

logger = logging.getLogger(__name__)

# Verrous en mémoire pour éviter les doublons dans la même instance
_stock_levels_done_month = None
_monthly_report_attempted_day = None
_scheduler_lock_handle = None


def _run_monthly_tasks(now):
    """
    Tâches mensuelles :
    1. Recalcul des seuils stock min/max (une fois par mois, rattrapage inclus)
    2. Envoi du rapport mensuel (jour configuré via monthly_report_day, avec
       rattrapage les jours suivants tant qu'il n'a pas réussi)
    """
    global _stock_levels_done_month, _monthly_report_attempted_day

    current_month_key = (now.year, now.month)

    # ── 1. Recalcul des seuils de stock min/max ──────────────────────────
    if _stock_levels_done_month != current_month_key:
        try:
            from .models import PharmacySettings
            from .signals_stock_levels import monthly_stock_levels_update

            pharmacy_settings, _ = PharmacySettings.objects.get_or_create(pk=1)
            last_run = pharmacy_settings.last_stock_analytics_run
            already_run_this_month = last_run and (last_run.year, last_run.month) == current_month_key
            if not already_run_this_month:
                logger.info("Scheduler: rattrapage du recalcul mensuel min/max et consommation.")
                updated = monthly_stock_levels_update()
                logger.info(f"Scheduler: {updated} produits mis à jour (seuils min/max)")
                call_command('recalculate_analytics')
                pharmacy_settings.last_stock_analytics_run = now
                pharmacy_settings.save(update_fields=['last_stock_analytics_run'])
                logger.info("Scheduler: consommation mensuelle recalculée pour tous les produits.")
            _stock_levels_done_month = current_month_key
        except Exception as e:
            logger.error(f"Scheduler - Stock Levels Error: {e}")

    # ── 2. Rapport mensuel (email, Telegram) ─────────────────────────────
    # send_monthly_report honore monthly_report_day, les destinataires email
    # et les canaux Telegram/WhatsApp ; elle gère l'anti-doublon persistant
    # (last_monthly_report_sent). Un envoi qui se termine sans exception est
    # retenté le lendemain s'il a échoué ; une exception ici laisse le flag
    # non positionné → nouvelle tentative au prochain passage de la boucle.
    today_key = (now.year, now.month, now.day)
    if _monthly_report_attempted_day != today_key:
        try:
            from .models import PharmacySettings

            ps, _ = PharmacySettings.objects.get_or_create(pk=1)
            sent = ps.last_monthly_report_sent
            already_sent = sent and (sent.year, sent.month) == current_month_key
            if ps.monthly_report_enabled and now.day >= ps.monthly_report_day and not already_sent:
                logger.info("Scheduler: envoi du rapport mensuel (send_monthly_report).")
                call_command('send_monthly_report')
            _monthly_report_attempted_day = today_key
        except Exception as e:
            logger.error(f"Scheduler - Monthly Report Error: {e}")


def _run_retention_tasks(now):
    """
    Rétention des données — exécution quotidienne.

    STRICTEMENT non-destructive par défaut : ne fait rien tant que
    PharmacySettings.retention_enabled=False. Quand la rétention est activée,
    on lance `run_retention --confirm` au plus une fois par 20h (garde
    temporelle basée sur last_retention_run pour le rattrapage après arrêt).
    """
    try:
        from .models import PharmacySettings

        pharmacy_settings, _ = PharmacySettings.objects.get_or_create(pk=1)
        if not pharmacy_settings.retention_enabled:
            return

        last_run = pharmacy_settings.last_retention_run
        if last_run and (now - last_run) < timedelta(hours=20):
            return

        logger.info("Scheduler: exécution de la rétention des données (run_retention --confirm).")
        call_command('run_retention', '--confirm')
    except Exception as e:
        logger.error(f"Scheduler - Retention Error: {e}")


def run_scheduler_loop():
    """Loop that runs in a background thread."""
    # Delay to let the server start properly
    time.sleep(10)
    
    logger.info("Background Task Runner: Started")
    
    while True:
        # ── Commandes automatiques ────────────────────────────────────────
        try:
            call_command('run_order_schedules')
        except Exception as e:
            logger.error(f"Background Task Runner Error: {e}")

        # ── Tâches mensuelles du 1er ─────────────────────────────────────
        try:
            from django.utils import timezone
            _run_monthly_tasks(timezone.localtime())
        except Exception as e:
            logger.error(f"Scheduler - Monthly Tasks Error: {e}")

        # ── Rétention des données (quotidienne, désactivée par défaut) ────
        try:
            from django.utils import timezone
            _run_retention_tasks(timezone.localtime())
        except Exception as e:
            logger.error(f"Scheduler - Retention Tasks Error: {e}")

        # Wait 10 minutes before next check
        time.sleep(600)

def start_background_tasks():
    """Starts the background thread only once."""
    global _scheduler_lock_handle

    if _scheduler_lock_handle:
        return

    if fcntl is None:
        # Pas de verrou fichier sur cette plateforme (ex: Windows) ; le flag
        # en mémoire suffit pour empêcher les doublons dans le même processus.
        _scheduler_lock_handle = True
    else:
        lock_path = os.path.join(tempfile.gettempdir(), 'pharma_background_scheduler.lock')
        lock_handle = open(lock_path, 'w')  # noqa: SIM115 — kept open as file lock
        try:
            fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock_handle.close()
            return
        _scheduler_lock_handle = lock_handle

    thread = threading.Thread(target=run_scheduler_loop, daemon=True)
    thread.start()
