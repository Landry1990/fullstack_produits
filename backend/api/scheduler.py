import threading
import time
import logging
import os
from django.core.management import call_command

logger = logging.getLogger(__name__)

def run_scheduler_loop():
    """Loop that runs in a background thread."""
    # Delay to let the server start properly
    time.sleep(10)
    
    logger.info("Background Task Runner: Started")
    
    while True:
        try:
            # Execute the management command we found earlier
            # This will check all OrderSchedules and generate commands if needed
            call_command('run_order_schedules')
        except Exception as e:
            logger.error(f"Background Task Runner Error: {e}")
            
        # Vérification et envoi automatisé du rapport mensuel Telegram (le 1er de chaque mois)
        try:
            from django.utils import timezone
            from .models import TelegramLog
            now = timezone.now()
            if now.day == 1:
                # Vérifier si un rapport mensuel a déjà été envoyé pour le mois en cours
                already_sent = TelegramLog.objects.filter(
                    type=TelegramLog.Type.RAPPORT,
                    status=TelegramLog.Status.SENT,
                    sent_at__year=now.year,
                    sent_at__month=now.month
                ).exists()
                if not already_sent:
                    logger.info("Scheduler: Premier jour du mois détecté. Envoi du rapport mensuel Telegram...")
                    call_command('send_monthly_telegram_report')
        except Exception as e:
            logger.error(f"Background Task Runner - Telegram Report Error: {e}")
        
        # Recalcul mensuel des seuils de stock min/max (le 1er de chaque mois)
        try:
            from django.utils import timezone
            from .signals_stock_levels import monthly_stock_levels_update
            now = timezone.now()
            if now.day == 1 and now.hour < 2:  # Entre minuit et 2h du matin
                logger.info("Scheduler: Premier jour du mois. Recalcul des seuils de stock...")
                updated = monthly_stock_levels_update()
                logger.info(f"Scheduler: {updated} produits avec seuils mis à jour")
        except Exception as e:
            logger.error(f"Background Task Runner - Stock Levels Error: {e}")
            
        # Wait 10 minutes before next check
        # (600 seconds = 10 minutes)
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
