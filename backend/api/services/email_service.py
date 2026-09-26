"""
Email service for sending notifications
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails."""

    @staticmethod
    def _get_pharmacy_name():
        """Nom de la pharmacie : licence signée en priorité, sinon paramètres."""
        try:
            from api.utils_licence import valider_licence_systeme
            _valid, _msg, payload = valider_licence_systeme()
            if payload and payload.get('pharmacie_nom'):
                return payload['pharmacie_nom']
        except Exception:
            pass
        try:
            from api.utils.currency import get_pharmacy_name
            return get_pharmacy_name()
        except Exception:
            return ''

    @staticmethod
    def send_feedback_notification(feedback):
        """
        Send email notification when a new feedback is created.
        
        Args:
            feedback: Feedback model instance
        """
        try:
            pharmacie = EmailService._get_pharmacy_name()
            pharmacie_tag = f"{pharmacie} — " if pharmacie else ""
            subject = f"[Feedback] {pharmacie_tag}{feedback.get_category_display()} - {feedback.subject}"

            # Build email body
            message = f"""
Pharmacie: {pharmacie or 'N/A'}
Nouveau feedback reçu de {feedback.user.username if feedback.user else 'Utilisateur anonyme'}

Catégorie: {feedback.get_category_display()}
Priorité: {feedback.get_priority_display()}
Sujet: {feedback.subject}

Description:
{feedback.description}

Page URL: {feedback.page_url or 'N/A'}
Navigateur: {feedback.browser_info or 'N/A'}

---
Envoyé depuis l'application Zenith Pharma
            """
            
            # Send email
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.FEEDBACK_EMAIL],
                fail_silently=False,
            )
            
            logger.info(f"Email de feedback envoyé pour le feedback #{feedback.id}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de l'email de feedback #{feedback.id}: {e!s}")
            return False
    
    @staticmethod
    def send_feedback_response(feedback):
        """
        Send email notification when a feedback is responded to by admin.
        
        Args:
            feedback: Feedback model instance
        """
        try:
            if not feedback.user or not feedback.user.email:
                logger.warning(f"Impossible d'envoyer l'email de réponse: utilisateur sans email pour feedback #{feedback.id}")
                return False
            
            subject = f"[Feedback] Réponse: {feedback.subject}"
            
            # Build email body
            message = f"""
Bonjour {feedback.user.username},

Votre feedback a reçu une réponse de la part de l'équipe:

Feedback original:
Catégorie: {feedback.get_category_display()}
Sujet: {feedback.subject}
Description: {feedback.description}

Réponse:
{feedback.admin_response}

---
Merci pour votre contribution !
            """
            
            # Send email
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[feedback.user.email],
                fail_silently=False,
            )
            
            logger.info(f"Email de réponse envoyé à {feedback.user.email} pour le feedback #{feedback.id}")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de l'email de réponse pour feedback #{feedback.id}: {e!s}")
            return False


email_service = EmailService()
