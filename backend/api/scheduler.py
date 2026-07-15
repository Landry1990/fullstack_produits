import threading
import time
import logging
import os
import tempfile
try:
    import fcntl
except ImportError:  # pragma: no cover (Windows)
    fcntl = None
from django.core.management import call_command

logger = logging.getLogger(__name__)

# Verrous en mémoire pour éviter les doublons dans la même instance
_stock_levels_done_month = None
_telegram_report_done_month = None
_scheduler_lock_handle = None


def _run_monthly_tasks(now):
    """
    Tâches du 1er du mois :
    1. Recalcul des seuils stock min/max
    2. Envoi du rapport mensuel Telegram
    Exécutées entre 00h00 et 06h00, une seule fois par mois.
    """
    global _stock_levels_done_month, _telegram_report_done_month

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

    # ── 2. Rapport mensuel Telegram ──────────────────────────────────────
    if now.day == 1 and now.hour < 6 and _telegram_report_done_month != current_month_key:
        try:
            from .models import TelegramLog
            already_sent = TelegramLog.objects.filter(
                type=TelegramLog.Type.RAPPORT,
                status=TelegramLog.Status.SENT,
                sent_at__year=now.year,
                sent_at__month=now.month
            ).exists()
            if not already_sent:
                logger.info("Scheduler: 1er du mois — Envoi rapport mensuel Telegram...")
                call_command('send_monthly_telegram_report')
            else:
                logger.info("Scheduler: Rapport Telegram déjà envoyé ce mois.")
            _telegram_report_done_month = current_month_key
        except Exception as e:
            logger.error(f"Scheduler - Telegram Report Error: {e}")


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
        lock_handle = open(lock_path, 'w')
        try:
            fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock_handle.close()
            return
        _scheduler_lock_handle = lock_handle

    thread = threading.Thread(target=run_scheduler_loop, daemon=True)
    thread.start()
