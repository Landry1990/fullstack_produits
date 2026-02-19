import logging
from django.utils import timezone
from ..models import SmsLog

logger = logging.getLogger(__name__)
business_logger = logging.getLogger('api.business')

class SmsService:
    """Service de gestion de l'envoi de SMS."""
    
    def send_sms(self, recipient: str, message: str, sms_type='MANUEL', user=None, context=None):
        """
        Orchestre l'envoi d'un SMS: Log -> Provider Send -> Update Log.
        Pour l'instant utilise un Mock Provider.
        
        Args:
            recipient (str): Numéro de téléphone
            message (str): Contenu du message
            sms_type (str): Type de SMS (MANUEL, PROMIS, RAPPEL)
            user (User, optional): Utilisateur qui a déclenché l'action
            context (dict, optional): Liens vers objets liés {'promis': obj, 'client': obj}
        
        Returns:
            tuple(bool, str): (Succès, Message)
        """
        
        # Nettoyage du numéro (suppression espaces)
        clean_number = recipient.replace(' ', '').replace('-', '')
        
        # 1. Créer l'entrée de log (Statut: PENDING)
        log = SmsLog.objects.create(
            recipient_number=clean_number,
            message=message,
            type=sms_type,
            status=SmsLog.Status.PENDING,
            sent_by=user,
            promis=context.get('promis') if context else None,
            client=context.get('client') if context else None
        )
        
        try:
            # 2. Appel au Provider (Mock pour l'instant)
            # TODO: Intégrer Twilio / Infobip ici
            response = self._mock_provider_send(clean_number, message)
            
            # 3. Mise à jour succès
            log.status = SmsLog.Status.SENT
            log.provider_response = str(response)
            log.sent_at = timezone.now()
            log.provider_id = response.get('id')
            log.save()
            
            return True, "SMS envoyé avec succès (Simulé)"
            
        except Exception as e:
            logger.error(f"Erreur envoi SMS ({clean_number}): {str(e)}")
            
            # 3. Mise à jour échec
            log.status = SmsLog.Status.FAILED
            log.provider_response = f"Exception: {str(e)}"
            log.save()
            
            return False, f"Erreur lors de l'envoi: {str(e)}"

    def _mock_provider_send(self, recipient, message):
        """Simule l'envoi via une API externe."""
        import time
        import uuid
        
        # Simuler latence réseau
        # time.sleep(0.5)
        
        business_logger.info(f"[SMS] SENT to {recipient} | type={sms_type} | user={user.username if user else 'system'}")
        
        return {
            "success": True, 
            "provider": "MOCK", 
            "id": str(uuid.uuid4()),
            "timestamp": timezone.now().isoformat()
        }
