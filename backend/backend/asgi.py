"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Application Django standard (HTTP)
django_asgi_app = get_asgi_application()

# Importer le routage WebSocket après l'initialisation Django
from api.routing import websocket_urlpatterns
from api.ws_auth_middleware import TokenAuthMiddleware

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': TokenAuthMiddleware(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})

# Warm-up : forcer la résolution de l'URLconf au démarrage du worker pour
# importer maintenant (~2 s) tous les modules de vues/serializers, plutôt que
# sur la première requête d'un utilisateur. Sans ça, chaque worker neuf (boot
# ou recycle via --limit-max-requests) inflige ce coût à un utilisateur réel.
from django.urls import get_resolver
get_resolver().url_patterns
