"""
WebSocket Consumers pour communication temps réel PDA ↔ Caisse
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class CashierConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket pour la caisse centrale
    Reçoit les articles des PDA en temps réel
    """
    
    async def connect(self):
        self.cashier_group = "cashier_updates"
        self.pda_id = self.scope.get("query_string", b"").decode().split("=")[-1] if self.scope.get("query_string") else None
        
        # Rejoindre le groupe caisse
        await self.channel_layer.group_add(
            self.cashier_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Envoyer confirmation de connexion
        await self.send(text_data=json.dumps({
            "type": "connection",
            "status": "connected",
            "pda_id": self.pda_id,
            "message": "Connecté à la caisse centrale"
        }))
    
    async def disconnect(self, close_code):
        # Quitter le groupe
        await self.channel_layer.group_discard(
            self.cashier_group,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """
        Reçoit les messages des PDA ou de la caisse
        """
        try:
            data = json.loads(text_data)
            event_type = data.get("type")
            
            if event_type == "cashier_item_new":
                # PDA envoie des articles à la caisse
                await self.handle_new_cashier_item(data)
                
            elif event_type == "cashier_item_status":
                # Caisse met à jour le statut
                await self.handle_status_update(data)
                
            elif event_type == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "JSON invalide"
            }))
    
    async def handle_new_cashier_item(self, data):
        """
        Nouveaux articles reçus d'un PDA
        Diffuser à tous les clients caisse connectés
        """
        item_data = {
            "type": "cashier_item_new",
            "pda_id": data.get("pda_id"),
            "item_id": data.get("item_id"),
            "articles": data.get("articles", []),
            "client": data.get("client"),
            "ayant_droit": data.get("ayant_droit"),
            "total_estime": data.get("total_estime"),
            "articles_count": data.get("articles_count"),
            "timestamp": data.get("timestamp"),
        }
        
        # Diffuser à tout le groupe caisse
        await self.channel_layer.group_send(
            self.cashier_group,
            {
                "type": "broadcast_cashier_item",
                "data": item_data
            }
        )
        
        # Confirmer réception au PDA
        await self.send(text_data=json.dumps({
            "type": "cashier_item_received",
            "item_id": data.get("item_id"),
            "status": "waiting",
            "message": "Articles reçus et envoyés à la caisse"
        }))
    
    async def handle_status_update(self, data):
        """
        Mise à jour de statut par la caisse
        """
        status_data = {
            "type": "cashier_item_status",
            "item_id": data.get("item_id"),
            "status": data.get("status"),  # processing, completed, cancelled
            "ticket": data.get("ticket"),  # Si completed
            "message": data.get("message"),
        }
        
        # Diffuser au groupe
        await self.channel_layer.group_send(
            self.cashier_group,
            {
                "type": "broadcast_status_update",
                "data": status_data
            }
        )
    
    # ─── Handlers de groupe ─────────────────
    
    async def broadcast_cashier_item(self, event):
        """
        Reçu du groupe - nouveaux articles
        """
        await self.send(text_data=json.dumps(event["data"]))
    
    async def broadcast_status_update(self, event):
        """
        Reçu du groupe - mise à jour statut
        """
        await self.send(text_data=json.dumps(event["data"]))


class PDAConsumer(AsyncWebsocketConsumer):
    """
    Consumer WebSocket dédié pour les PDA
    Reçoit uniquement les mises à jour de leurs propres ventes
    """
    
    async def connect(self):
        self.pda_id = self.scope.get("query_string", b"").decode().split("=")[-1] if self.scope.get("query_string") else "unknown"
        self.pda_group = f"pda_{self.pda_id}"
        
        # Rejoindre le groupe spécifique au PDA
        await self.channel_layer.group_add(
            self.pda_group,
            self.channel_name
        )
        
        # Rejoindre aussi le groupe caisse général pour les updates
        await self.channel_layer.group_add(
            "cashier_updates",
            self.channel_name
        )
        
        await self.accept()
        
        await self.send(text_data=json.dumps({
            "type": "connection",
            "status": "connected",
            "pda_id": self.pda_id,
        }))
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.pda_group,
            self.channel_name
        )
        await self.channel_layer.group_discard(
            "cashier_updates",
            self.channel_name
        )
    
    async def receive(self, text_data):
        """
        PDA envoie un message
        """
        try:
            data = json.loads(text_data)
            
            if data.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
                
        except json.JSONDecodeError:
            pass
    
    async def broadcast_status_update(self, event):
        """
        Reçu du groupe - statut mis à jour
        """
        await self.send(text_data=json.dumps(event["data"]))
