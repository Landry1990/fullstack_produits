import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from api.models import OrderSchedule, Commande, CommandeProduit, Produit
from api.views.commandes.suggestions import calculer_optimisation_intelligente
from decimal import Decimal
import json

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Executes active order schedules to generate automated suggestions.'

    def handle(self, *args, **options):
        now = timezone.now()
        today = now.date()
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
            
        # 3. Frequency check (weeks)
        if schedule.last_run:
            # We calculate the number of weeks between the start_date and today
            # to see if we are in a valid week for the frequency.
            start_date = schedule.start_date
            days_diff = (today - start_date).days
            weeks_diff = days_diff // 7
            
            if weeks_diff % schedule.frequency_weeks != 0:
                return False
                
        return True

    def process_schedule(self, schedule):
        self.stdout.write(f"Executing schedule {schedule.id} for {schedule.fournisseur.name}")
        
        # 1. Generate suggestions using the configured mode
        if schedule.execution_mode == 'OPTIMISE':
            suggestions, total_ht = calculer_optimisation_intelligente(
                periode=schedule.analysis_period_days,
                fournisseur_id=schedule.fournisseur.id,
                budget_max=None
            )
        elif schedule.execution_mode == 'CUMULATIF':
            # Mode cumulatif : compte les ventes depuis la dernière commande auto
            from api.views.commandes.suggestions import calculer_reapprovisionnement_cumulatif
            suggestions, total_ht = calculer_reapprovisionnement_cumulatif(
                fournisseur_id=schedule.fournisseur.id,
                periode_fallback=schedule.analysis_period_days,
                budget_max=None
            )
        else: # SIMPLE mode
            from api.views.commandes.suggestions import calculer_reapprovisionnement_simple
            suggestions, total_ht = calculer_reapprovisionnement_simple(
                periode=schedule.analysis_period_days,
                fournisseur_id=schedule.fournisseur.id,
                budget_max=None
            )
        
        if not suggestions:
            self.stdout.write(self.style.WARNING(f"No suggestions generated for {schedule.fournisseur.name}"))
            schedule.last_run = timezone.now()
            schedule.save()
            return

        # 2. Check minimum conditions
        count_items = len(suggestions)
        total_ht_decimal = Decimal(str(total_ht))
        
        meets_amount = total_ht_decimal >= schedule.min_amount
        meets_items = count_items >= schedule.min_items
        
        should_create = False
        if schedule.condition_logic == 'AND':
            should_create = meets_amount and meets_items
        else: # OR
            should_create = meets_amount or meets_items
            
        if not should_create:
            self.stdout.write(self.style.WARNING(
                f"Conditions not met for {schedule.fournisseur.name}: "
                f"Amount {total_ht_decimal}/{schedule.min_amount}, Items {count_items}/{schedule.min_items}"
            ))
            # Even if not created, we mark it as "checked" for today
            schedule.last_run = timezone.now()
            schedule.save()
            return

        # 3. Create Draft Commande (marquée comme auto-générée)
        commande = Commande.objects.create(
            type=Commande.Type.LOCALE,
            fournisseur=schedule.fournisseur,
            fournisseur_nom=schedule.fournisseur.name,
            status=Commande.Status.EN_PREPARATION,
            date=timezone.now(),
            source=Commande.Source.AUTO_SCHEDULE
        )
        
        for item in suggestions:
            produit = Produit.objects.get(id=item['produit_id'])
            CommandeProduit.objects.create(
                commande=commande,
                produit=produit,
                produit_nom=produit.name,
                quantity=item['quantite_suggeree'],
                price=Decimal(str(item['prix_achat'])),
                price_cost=Decimal(str(item['prix_achat'])),
                tva=Decimal(str(item.get('tva', 0))),
                selling_price=Decimal(str(item.get('prix_vente', 0)))
            )
            
        self.stdout.write(self.style.SUCCESS(f"Order created: CMD-{commande.id} for {schedule.fournisseur.name}"))
        
        # 4. Handle Teletransmission / Notifications (Placeholder for now)
        if schedule.has_teletransmission:
            # Logic for teletransmission would go here
            pass
            
        if schedule.notify_whatsapp:
            # Logic for WhatsApp notification
            from api.whatsapp_service import WhatsAppService
            # We would send a summary message
            pass
            
        # 5. Update last run
        schedule.last_run = timezone.now()
        schedule.save()
