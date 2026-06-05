import logging
import os
import tempfile
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import OrderSchedule
from api.services.auto_order import run_suggestions_for_schedule, create_order_from_suggestions

logger = logging.getLogger(__name__)

# Fichier lock pour éviter les exécutions concurrentes entre workers gunicorn
LOCK_FILE = os.path.join(tempfile.gettempdir(), 'pharma_run_order_schedules.lock')


class Command(BaseCommand):
    help = 'Executes active order schedules to generate automated suggestions.'

    def handle(self, *args, **options):
        # Lock fichier simple pour éviter que plusieurs workers n'exécutent en même temps
        if os.path.exists(LOCK_FILE):
            self.stdout.write(self.style.WARNING("Another instance is already running. Skipping."))
            return
        try:
            open(LOCK_FILE, 'w').close()
            self._run_schedules()
        finally:
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)

    def _run_schedules(self):
        now = timezone.now()
        # Utiliser l'heure locale pour les comparaisons (timezone.now() retourne UTC)
        local_now = timezone.localtime(now)
        weekday = local_now.weekday()  # 0=Monday, 6=Sunday
        today = local_now.date()

        self.stdout.write(f"Checking schedules for {local_now} (local time)...")

        # We look for schedules that are active and set for today
        # Check either weekday OR month day match (if month days are specified)
        month_day = local_now.day
        from django.db.models import Q
        active_schedules = OrderSchedule.objects.filter(
            is_active=True
        ).filter(
            Q(active_days__contains=weekday) | Q(active_month_days__contains=month_day)
        )

        self.stdout.write(f"Found {active_schedules.count()} potential schedules for today ({today}).")

        for schedule in active_schedules:
            try:
                if self.should_run(schedule, local_now):
                    self.process_schedule(schedule)
            except Exception as e:
                logger.error(f"Error processing schedule {schedule.id}: {str(e)}", exc_info=True)
                self.stderr.write(self.style.ERROR(f"Error for schedule {schedule.id}: {str(e)}"))

    def should_run(self, schedule, local_now):
        """Determines if the schedule should run at this precise moment."""
        today = local_now.date()

        # 1. Start date not yet reached?
        if schedule.start_date and today < schedule.start_date:
            return False

        # 2. Already ran today?
        if schedule.last_run:
            last_run_local = timezone.localtime(schedule.last_run)
            if last_run_local.date() == today:
                return False

        # 3. Time check (must be at or after the scheduled time)
        # schedule.time est stocké sans timezone, comparons avec l'heure locale
        if local_now.time() < schedule.time:
            return False

        # 4. Frequency check — based on last_run
        if schedule.last_run:
            last_run_local = timezone.localtime(schedule.last_run)
            days_since_last = (today - last_run_local.date()).days
            if days_since_last < (schedule.frequency_weeks * 7):
                return False

        return True

    def process_schedule(self, schedule):
        self.stdout.write(f"Executing schedule {schedule.id} for {schedule.fournisseur.name}")

        # 1. Generate suggestions
        try:
            suggestions, total_ht = run_suggestions_for_schedule(schedule)
        except Exception as e:
            logger.error(f"Suggestion error for schedule {schedule.id}: {e}", exc_info=True)
            schedule.last_run = timezone.now()
            schedule.save(update_fields=['last_run'])
            return

        if not suggestions:
            self.stdout.write(self.style.WARNING(f"No suggestions generated for {schedule.fournisseur.name}"))
            schedule.last_run = timezone.now()
            schedule.save(update_fields=['last_run'])
            return

        # 2. Create order (conditions are checked inside)
        commande, nb_created = create_order_from_suggestions(schedule, suggestions, total_ht)

        if commande is None:
            self.stdout.write(self.style.WARNING(f"Conditions not met for {schedule.fournisseur.name}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Order created: CMD-{commande.id} for {schedule.fournisseur.name} ({nb_created} products)"
            ))

            # Handle notifications (placeholder)
            if schedule.notify_whatsapp:
                pass
            if schedule.notify_sms:
                pass

        # 3. Update last run
        schedule.last_run = timezone.now()
        schedule.save(update_fields=['last_run'])
