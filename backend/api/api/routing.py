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

    # Endpoint caisse centralisée (notifications temps réel POS → caisse)
    re_path(r'ws/caisse_centralisee/$', consumers.CaisseCentraliseeConsumer.as_asgi()),

    # Endpoint verrouillage pessimiste documents (commande, inventaire, etc.)
    re_path(r'ws/lock/(?P<model>[a-z]+)/(?P<pk>\d+)/$', consumers.DocumentLockConsumer.as_asgi()),
]
