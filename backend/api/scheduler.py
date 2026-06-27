import threading
import time
import logging
import os
from django.core.management import call_command

logger = logging.getLogger(__name__)

# Verrous en mémoire pour éviter les doublons dans la même instance
_stock_levels_done_month = None
_telegram_report_done_month = None


def _run_monthly_tasks(now):
    """
    Tâches du 1er du mois :
    1. Recalcul des seuils stock min/max
    2. Envoi du rapport mensuel Telegram
    Exécutées entre 00h00 et 06h00, une seule fois par mois.
    """
    global _stock_levels_done_month, _telegram_report_done_month

    if now.day != 1 or now.hour >= 6:
        return

    current_month_key = (now.year, now.month)

    # ── 1. Recalcul des seuils de stock min/max ──────────────────────────
    if _stock_levels_done_month != current_month_key:
        try:
            from .signals_stock_levels import monthly_stock_levels_update
            logger.info("Scheduler: 1er du mois — Recalcul seuils stock min/max...")
            updated = monthly_stock_levels_update()
            logger.info(f"Scheduler: {updated} produits mis à jour (seuils min/max)")
            _stock_levels_done_month = current_month_key
        except Exception as e:
            logger.error(f"Scheduler - Stock Levels Error: {e}")

    # ── 2. Rapport mensuel Telegram ──────────────────────────────────────
    if _telegram_report_done_month != current_month_key:
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
    
    # Avoid running twice when runserver reloads (RUN_MAIN is a Django specific env var)
    if os.environ.get('RUN_MAIN') == 'true' or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        thread = threading.Thread(target=run_scheduler_loop, daemon=True)
        thread.start()
    elif not os.environ.get('RUN_MAIN') and not os.environ.get('WERKZEUG_RUN_MAIN'):
        # If not using runserver (e.g. gunicorn), still start it
        thread = threading.Thread(target=run_scheduler_loop, daemon=True)
        thread.start()
