# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from ...services.chronic_reminder_service import ChronicReminderService

class Command(BaseCommand):
    help = 'Sends WhatsApp reminders to clients with chronic diseases whose treatment is ending soon.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=3,
            help='Number of days before treatment ends to send the reminder'
        )

    def handle(self, *args, **options):
        days = options['days']
        self.stdout.write(f"Checking for chronic reminders due in {days} days...")
        
        sent_count = ChronicReminderService.send_reminders(days_before=days)
        
        self.stdout.write(self.style.SUCCESS(f"Successfully sent {sent_count} reminders."))
