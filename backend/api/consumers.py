import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

LOCK_TTL = 30  # secondes — expire si le client crash sans déconnecter


def _lock_key(model: str, pk: str) -> str:
    return f"doc_lock:{model}:{pk}"


def _group_name(model: str, pk: str) -> str:
    return f"lock_{model}_{pk}"


class CashierConsumer(AsyncWebsocketConsumer):
    """Consumer WebSocket pour la caisse web : reçoit les articles du PDA."""

    async def connect(self):
        self.group_name = 'cashier'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'type': 'error', 'message': 'JSON invalide'}))
            return

        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
            return

        # Relayer les mises à jour de statut vers le groupe PDA
        if data.get('type') == 'cashier_item_status':
            await self.channel_layer.group_send(
                'pda',
                {
                    'type': 'forward_pda',
                    'payload': data,
                }
            )

    async def forward_cashier(self, event):
        """Reçoit les nouveaux articles envoyés par un PDA et les transmet à la caisse."""
        await self.send(text_data=json.dumps(event['payload']))


class PDAConsumer(AsyncWebsocketConsumer):
    """Consumer WebSocket pour le PDA mobile : envoie les articles à la caisse."""

    async def connect(self):
        self.group_name = 'pda'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'type': 'error', 'message': 'JSON invalide'}))
            return

        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
            return

        # Relayer les nouveaux articles vers le groupe caisse
        if data.get('type') == 'cashier_item_new':
            await self.channel_layer.group_send(
                'cashier',
                {
                    'type': 'forward_cashier',
                    'payload': data,
                }
            )

    async def forward_pda(self, event):
        """Reçoit les mises à jour de statut de la caisse et les transmet au PDA."""
        await self.send(text_data=json.dumps(event['payload']))


class DocumentLockConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour le verrouillage pessimiste des documents.

    Protocole client → serveur :
      { "type": "acquire" }              — demande le verrou
      { "type": "release" }              — libère le verrou
      { "type": "heartbeat" }            — renouvelle le TTL (toutes les 15s)

    Protocole serveur → client :
      { "type": "lock_acquired", "holder": "username", "expires_in": 30 }
      { "type": "lock_denied",   "holder": "username" }
      { "type": "lock_released" }
      { "type": "lock_update",   "holder": "username"|null }  — broadcast groupe
    """

    async def connect(self):
        url = self.scope['url_route']['kwargs']
        self.model = url['model']
        self.pk = url['pk']
        self.lock_key = _lock_key(self.model, self.pk)
        self.group = _group_name(self.model, self.pk)
        self.username = None

        user = self.scope.get('user')
        if user and user.is_authenticated:
            self.username = user.username
        else:
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        holder = await self._get_lock_holder()
        if holder:
            await self.send(text_data=json.dumps({
                'type': 'lock_denied',
                'holder': holder,
            }))
        else:
            await self.send(text_data=json.dumps({
                'type': 'lock_released',
            }))

    async def disconnect(self, close_code):
        if self.username:
            await self._release_if_owner()
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')

        if msg_type == 'acquire':
            acquired = await self._try_acquire()
            if acquired:
                await self.send(text_data=json.dumps({
                    'type': 'lock_acquired',
                    'holder': self.username,
                    'expires_in': LOCK_TTL,
                }))
                await self.channel_layer.group_send(self.group, {
                    'type': 'broadcast_lock_update',
                    'holder': self.username,
                })
            else:
                holder = await self._get_lock_holder()
                await self.send(text_data=json.dumps({
                    'type': 'lock_denied',
                    'holder': holder or 'inconnu',
                }))

        elif msg_type == 'release':
            released = await self._release_if_owner()
            if released:
                await self.channel_layer.group_send(self.group, {
                    'type': 'broadcast_lock_update',
                    'holder': None,
                })

        elif msg_type == 'heartbeat':
            await self._renew_if_owner()

    async def broadcast_lock_update(self, event):
        """Reçoit un événement de groupe et le transmet au client WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'lock_update',
            'holder': event.get('holder'),
        }))

    @database_sync_to_async
    def _get_lock_holder(self):
        from django.core.cache import cache
        return cache.get(self.lock_key)

    @database_sync_to_async
    def _try_acquire(self):
        from django.core.cache import cache
        return cache.add(self.lock_key, self.username, timeout=LOCK_TTL)

    @database_sync_to_async
    def _release_if_owner(self):
        from django.core.cache import cache
        if cache.get(self.lock_key) == self.username:
            cache.delete(self.lock_key)
            return True
        return False

    @database_sync_to_async
    def _renew_if_owner(self):
        from django.core.cache import cache
        if cache.get(self.lock_key) == self.username:
            cache.set(self.lock_key, self.username, timeout=LOCK_TTL)
            return True
        return False
