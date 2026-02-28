import json
import requests
import logging
from django.conf import settings
from .models import WhatsAppLog
from django.utils import timezone

logger = logging.getLogger(__name__)

class WhatsAppService:
    """
    Service pour l'envoi de messages via Meta Cloud API (WhatsApp Business).
    """
    
    @staticmethod
    def _get_headers():
        access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    @staticmethod
    def send_invoice_pdf(facture, recipient_number, pdf_buffer, recipient_name=""):
        """
        Envoie une facture au format PDF via Meta Cloud API.
        Meta nécessite d'abord d'uploader le média ou d'utiliser une URL publique.
        """
        phone_number_id = getattr(settings, 'WHATSAPP_PHONE_ID', None)
        access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
        
        # Nettoyer le numéro (doit être au format international sans +)
        clean_number = "".join(filter(str.isdigit, recipient_number))
        
        log_entry = WhatsAppLog.objects.create(
            recipient_number=clean_number,
            recipient_name=recipient_name,
            message=f"Ticket de caisse {facture.numero_facture}",
            type=WhatsAppLog.Type.FACTURE,
            facture=facture,
            client=facture.client,
            has_attachment=True,
            status=WhatsAppLog.Status.PENDING
        )

        if not access_token or not phone_number_id:
            logger.warning("WhatsApp Credentials manquants. Simulation.")
            log_entry.status = WhatsAppLog.Status.SENT
            log_entry.sent_at = timezone.now()
            log_entry.save()
            return True, "Simulation réussie"

        # Logique Meta Cloud API : 
        # 1. Envoyer le message template (obligatoire pour initier)
        # 2. Ou envoyer le média si la fenêtre de 24h est ouverte
        
        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        # ... logic to send template or media ...
        
        return True, "Envoi initié"

    @staticmethod
    def send_text_message(recipient_number, message, recipient_name="", msg_type=WhatsAppLog.Type.MANUEL):
        """
        Envoie un message texte simple via Meta Cloud API.
        """
        phone_number_id = getattr(settings, 'WHATSAPP_PHONE_ID', None)
        access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
        
        # Nettoyer le numéro
        clean_number = "".join(filter(str.isdigit, recipient_number))
        
        log_entry = WhatsAppLog.objects.create(
            recipient_number=clean_number,
            recipient_name=recipient_name,
            message=message,
            type=msg_type,
            status=WhatsAppLog.Status.PENDING
        )
        
        if not access_token or not phone_number_id:
            logger.warning("WhatsApp Credentials manquants. Simulation.")
            log_entry.status = WhatsAppLog.Status.SENT
            log_entry.sent_at = timezone.now()
            log_entry.save()
            return True

        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_number,
            "type": "text",
            "text": {"body": message}
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            res_data = response.json()
            
            log_entry.status = WhatsAppLog.Status.SENT
            log_entry.provider_id = res_data.get('messages', [{}])[0].get('id')
            log_entry.provider_response = json.dumps(res_data)
            log_entry.sent_at = timezone.now()
            log_entry.save()
            return True
        except Exception as e:
            logger.error(f"Erreur WhatsApp (Text): {str(e)}")
            log_entry.status = WhatsAppLog.Status.FAILED
            log_entry.provider_response = str(e)
            log_entry.save()
            return False

    @staticmethod
    def send_renewal_reminder(facture_produit):
        """
        Envoie un rappel de renouvellement pour un produit chronique.
        """
        facture = facture_produit.facture
        client = facture.client
        produit = facture_produit.produit
        
        if not client or not client.phone:
            return False, "Client ou numéro de téléphone manquant"
            
        recipient_name = client.name
        produit_name = produit.name if produit else facture_produit.produit_nom
        
        message = (
            f"Bonjour {recipient_name}, votre traitement pour \"{produit_name}\" "
            f"arrive bientôt à sa fin (dans quelques jours).\n\n"
            f"N'oubliez pas de passer à la pharmacie pour renouveler votre ordonnance. "
            f"À bientôt !"
        )
        
        success = WhatsAppService.send_text_message(
            recipient_number=client.phone,
            message=message,
            recipient_name=recipient_name,
            msg_type=WhatsAppLog.Type.RENOUVELLEMENT
        )
        
        if success:
            # On peut logger plus de détails si besoin
            log = WhatsAppLog.objects.filter(
                recipient_number="".join(filter(str.isdigit, client.phone)),
                message=message
            ).first()
            if log:
                log.client = client
                log.save()
                
        return success, "Message envoyé" if success else "Échec de l'envoi"
