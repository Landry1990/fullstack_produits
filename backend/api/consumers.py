import json
from channels.generic.websocket import AsyncWebsocketConsumer


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
