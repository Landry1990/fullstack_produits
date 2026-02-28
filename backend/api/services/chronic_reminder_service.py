# -*- coding: utf-8 -*-
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from ..models import FactureProduit, WhatsAppLog, PharmacySettings
from ..whatsapp_service import WhatsAppService
import logging

logger = logging.getLogger(__name__)

class ChronicReminderService:
    """
    Service to manage reminders for chronic disease medications.
    """

    @staticmethod
    def get_pending_reminders(days_before=3):
        """
        Identify clients who need a reminder.
        """
        today = timezone.now().date()
        reminder_target_date = today + timedelta(days=days_before)
        
        # 1. Find FactureProduit with chronic products and treatment duration
        # We only care about validated/paid invoices
        query = Q(
            produit__is_chronic=True,
            treatment_duration_days__isnull=False,
            facture__status__in=['VAL', 'PAY'],
            facture__client__isnull=False,
            facture__client__phone__isnull=False
        )
        
        # Optimization: only look at recent invoices (e.g., last 6 months)
        six_months_ago = timezone.now() - timedelta(days=180)
        query &= Q(facture__date__gte=six_months_ago)
        
        candidates = FactureProduit.objects.filter(query).select_related('facture', 'facture__client', 'produit')
        
        due_reminders = []
        for line in candidates:
            purchase_date = line.facture.date.date()
            expected_end_date = purchase_date + timedelta(days=line.treatment_duration_days)
            
            # If the treatment ends exactly in 'days_before' days
            if expected_end_date == reminder_target_date:
                # Check if we already sent a reminder for THIS specific line
                already_sent = WhatsAppLog.objects.filter(
                    client=line.facture.client,
                    message__icontains=line.produit.name,
                    created_at__date__gte=purchase_date,
                    type=WhatsAppLog.Type.RAPPEL
                ).exists()
                
                if not already_sent:
                    due_reminders.append(line)
        
        return due_reminders

    @staticmethod
    def send_reminders(days_before=3):
        """
        Identify and send reminders.
        """
        due_lines = ChronicReminderService.get_pending_reminders(days_before)
        sent_count = 0
        
        pharmacy_settings, _ = PharmacySettings.objects.get_or_create(pk=1)
        pharmacy_name = pharmacy_settings.pharmacy_name or "la Pharmacie"
        
        for line in due_lines:
            client = line.facture.client
            product_name = line.produit.name
            
            message = (
                f"Bonjour {client.name}, votre traitement pour {product_name} arrive à expiration "
                f"bientôt (dans {days_before} jours). Pensez à passer à {pharmacy_name} pour renouveler votre achat. "
                f"À bientôt !"
            )
            
            success = WhatsAppService.send_text_message(
                recipient_number=client.phone,
                message=message,
                recipient_name=client.name,
                msg_type=WhatsAppLog.Type.RAPPEL
            )
            
            if success:
                sent_count += 1
                logger.info(f"Reminder sent to {client.name} for {product_name}")
            else:
                logger.error(f"Failed to send reminder to {client.name} for {product_name}")
                
        return sent_count
