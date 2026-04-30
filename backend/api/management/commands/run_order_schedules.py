import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import OrderSchedule
from api.services.auto_order import run_suggestions_for_schedule, create_order_from_suggestions

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Executes active order schedules to generate automated suggestions.'

    def handle(self, *args, **options):
        now = timezone.now()
        weekday = now.weekday()  # 0=Monday, 6=Sunday

        # We look for schedules that are active and set for today
        active_schedules = OrderSchedule.objects.filter(
            is_active=True,
            active_days__contains=weekday
        )

        self.stdout.write(f"Checking {active_schedules.count()} potential schedules for {now}...")

        for schedule in active_schedules:
            try:
                if self.should_run(schedule, now):
                    self.process_schedule(schedule)
            except Exception as e:
                logger.error(f"Error processing schedule {schedule.id}: {str(e)}", exc_info=True)
                self.stderr.write(self.style.ERROR(f"Error for schedule {schedule.id}: {str(e)}"))

    def should_run(self, schedule, now):
        """Determines if the schedule should run at this precise moment."""
        today = now.date()

        # 1. Already ran today?
        if schedule.last_run and schedule.last_run.date() == today:
            return False

        # 2. Time check (must be at or after the scheduled time)
        if now.time() < schedule.time:
            return False

        # 3. Frequency check — based on last_run
        if schedule.last_run:
            days_since_last = (today - schedule.last_run.date()).days
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
