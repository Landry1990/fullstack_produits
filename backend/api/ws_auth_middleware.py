"""
Middleware WebSocket pour authentifier via Token DRF passé en query string.
Permet aux clients React (qui utilisent token auth) de se connecter aux WebSocket.

Usage: ws://host/ws/.../?token=<drf_token>
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return None


class TokenAuthMiddleware:
    """
    Middleware qui authentifie l'utilisateur via un token DRF passé en query string.
    Si aucun token n'est fourni, retombe sur AuthMiddlewareStack (session cookies).
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_key = params.get('token', [None])[0]

        if token_key:
            user = await get_user_from_token(token_key)
            if user and user.is_authenticated:
                scope['user'] = user
                return await self.inner(scope, receive, send)
            # Token invalide → fermer la connexion
            await send({
                'type': 'websocket.close',
                'code': 4001,
            })
            return

        # Pas de token → laisser le middleware suivant gérer (session auth)
        return await self.inner(scope, receive, send)
