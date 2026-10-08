"""Notifications temps réel des changements de stock via WebSocket.

Broadcaste les compteurs stock/stock_reserve des produits modifiés sur le
groupe ``stock_updates``, consommé par le frontend pour rafraîchir les
affichages de stock sans polling.
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from ..models import Produit

logger = logging.getLogger(__name__)


def notify_stock_changed(produit_ids):
    """Enregistre un broadcast WebSocket des stocks après commit.

    Hors transaction, transaction.on_commit exécute le callback
    immédiatement — comportement voulu.
    """
    try:
        ids = {int(pid) for pid in (produit_ids or []) if pid}
    except (TypeError, ValueError):
        return
    if not ids:
        return

    def _send():
        try:
            channel_layer = get_channel_layer()
            if channel_layer is None:
                return
            produits = list(
                Produit.objects.filter(id__in=ids).values(
                    'id', 'stock', 'stock_reserve'
                )
            )
            async_to_sync(channel_layer.group_send)(
                'stock_updates',
                {'type': 'stock_update', 'produits': produits},
            )
        except Exception as ws_err:
            logger.warning(f"WebSocket broadcast stock échoué: {ws_err}")

    transaction.on_commit(_send)
