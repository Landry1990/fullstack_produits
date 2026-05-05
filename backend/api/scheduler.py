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
