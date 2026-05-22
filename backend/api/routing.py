"""
Routing WebSocket pour Django Channels
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Endpoint caisse (web facturation)
    re_path(r'ws/cashier/$', consumers.CashierConsumer.as_asgi()),
    
    # Endpoint PDA (mobile-facturation)
    re_path(r'ws/pda/$', consumers.PDAConsumer.as_asgi()),
]
