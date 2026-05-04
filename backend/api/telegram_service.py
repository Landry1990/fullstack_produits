import requests
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class TelegramService:
    """
    Service pour l'envoi de messages via Telegram Bot API.
    Les credentials sont lus depuis PharmacySettings.
    """

    BASE_URL = "https://api.telegram.org/bot{token}"

    @staticmethod
    def _get_credentials():
        from .models import PharmacySettings
        try:
            ps = PharmacySettings.objects.first()
            if ps:
                return (ps.telegram_bot_token or '').strip(), (ps.telegram_chat_id or '').strip()
        except Exception:
            pass
        return '', ''

    @staticmethod
    def send_message(text: str, bot_token: str = None, chat_id: str = None, parse_mode: str = 'HTML') -> tuple[bool, str]:
        """
        Envoie un message texte via le bot Telegram.
        Retourne (success: bool, message: str).
        """
        if not bot_token or not chat_id:
            token, cid = TelegramService._get_credentials()
            bot_token = bot_token or token
            chat_id = chat_id or cid

        if not bot_token:
            return False, "Token bot Telegram manquant"
        if not chat_id:
            return False, "Chat ID manquant"

        # Telegram limite les messages à 4096 caractères
        if len(text) > 4096:
            text = text[:4090] + "\n…"

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }

        try:
            resp = requests.post(url, json=payload, timeout=10)
            data = resp.json()
            if resp.status_code == 200 and data.get('ok'):
                logger.info(f"[Telegram] Message envoyé à chat_id={chat_id}")
                return True, "Message envoyé avec succès ✅"

            error_desc = data.get('description', 'Erreur inconnue')
            error_code = data.get('error_code', resp.status_code)
            logger.warning(f"[Telegram] Erreur {error_code}: {error_desc}")
            return False, f"Erreur Telegram ({error_code}): {error_desc}"

        except requests.exceptions.Timeout:
            return False, "Timeout — impossible de joindre l'API Telegram"
        except Exception as e:
            logger.error(f"[Telegram] Exception: {e}")
            return False, str(e)


