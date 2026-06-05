import json
import requests
import logging
from django.conf import settings
from .models import WhatsAppLog, PharmacySettings
from django.utils import timezone
from .retry_utils import retry_with_backoff

logger = logging.getLogger(__name__)

class WhatsAppService:
    """
    Service pour l'envoi de messages via Meta Cloud API (WhatsApp Business).
    Les credentials sont lus depuis PharmacySettings (base de données).
    """
    
    @staticmethod
    def _get_credentials():
        """Récupère les credentials WhatsApp depuis PharmacySettings."""
        try:
            ps = PharmacySettings.objects.first()
            if ps:
                return ps.whatsapp_phone_id, ps.whatsapp_access_token
        except Exception:
            pass
        # Fallback sur django settings (rétro-compatibilité)
        return (
            getattr(settings, 'WHATSAPP_PHONE_ID', None),
            getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
        )
    
    @staticmethod
    def _get_headers():
        _, access_token = WhatsAppService._get_credentials()
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    @staticmethod
    def send_invoice_pdf(facture, recipient_number, pdf_buffer, recipient_name=""):
        """
        Envoie une facture au format PDF via Meta Cloud API.
        """
        phone_number_id, access_token = WhatsAppService._get_credentials()
        
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
            return True, "Simulation réussie (credentials non configurés)"

        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        
        # Envoyer un message texte avec le résumé de la facture
        produits = facture.produits.all()
        lines = [f"📄 *Ticket {facture.numero_facture}*", ""]
        for p in produits:
            name = p.produit.name if p.produit else p.produit_nom
            lines.append(f"• {name} x{p.quantity} — {int(p.quantity * p.selling_price):,} F")
        lines.append("")
        lines.append(f"💰 *Total: {int(facture.total_ttc):,} F*")
        lines.append("")
        lines.append("Merci de votre visite !")
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_number,
            "type": "text",
            "text": {"body": "\n".join(lines)}
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        @retry_with_backoff(
            max_retries=2,
            base_delay=1.0,
            max_delay=5.0,
            exceptions=(requests.exceptions.RequestException,),
        )
        def _do_request():
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()

        try:
            res_data = _do_request()
            log_entry.status = WhatsAppLog.Status.SENT
            log_entry.provider_id = res_data.get('messages', [{}])[0].get('id')
            log_entry.provider_response = json.dumps(res_data)
            log_entry.sent_at = timezone.now()
            log_entry.save()
            return True, "Ticket envoyé avec succès"
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur WhatsApp (Invoice) après retries: {str(e)}")
            log_entry.status = WhatsAppLog.Status.FAILED
            log_entry.provider_response = f"Échec après retries: {str(e)}"
            log_entry.save()
            return False, f"Erreur: {str(e)}"
        except Exception as e:
            logger.error(f"Erreur WhatsApp (Invoice): {str(e)}")
            log_entry.status = WhatsAppLog.Status.FAILED
            log_entry.provider_response = str(e)
            log_entry.save()
            return False, f"Erreur: {str(e)}"

    @staticmethod
    def send_text_message(recipient_number, message, recipient_name="", msg_type=WhatsAppLog.Type.MANUEL):
        """
        Envoie un message texte simple via Meta Cloud API.
        """
        phone_number_id, access_token = WhatsAppService._get_credentials()
        
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
        
        @retry_with_backoff(
            max_retries=2,
            base_delay=1.0,
            max_delay=5.0,
            exceptions=(requests.exceptions.RequestException,),
        )
        def _do_request():
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()

        try:
            res_data = _do_request()
            log_entry.status = WhatsAppLog.Status.SENT
            log_entry.provider_id = res_data.get('messages', [{}])[0].get('id')
            log_entry.provider_response = json.dumps(res_data)
            log_entry.sent_at = timezone.now()
            log_entry.save()
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur WhatsApp (Text) après retries: {str(e)}")
            log_entry.status = WhatsAppLog.Status.FAILED
            log_entry.provider_response = f"Échec après retries: {str(e)}"
            log_entry.save()
            return False
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
            log = WhatsAppLog.objects.filter(
                recipient_number="".join(filter(str.isdigit, client.phone)),
                message=message
            ).first()
            if log:
                log.client = client
                log.save()
                
        return success, "Message envoyé" if success else "Échec de l'envoi"


