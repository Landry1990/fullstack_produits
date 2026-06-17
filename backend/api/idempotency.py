# -*- coding: utf-8 -*-
"""
Idempotency Key support pour les endpoints critiques (POST /finaliser, etc.)

Principe :
  - Le client envoie un header `Idempotency-Key: <uuid>` (généré côté frontend).
  - À la première requête, on exécute l'opération et on stocke le résultat en cache.
  - Pour toute requête suivante avec la même clé (double-clic, retry réseau),
    on retourne directement le résultat mis en cache sans ré-exécuter.

Durée de rétention : 24h (configurable via IDEMPOTENCY_TTL_SECONDS).
Stockage : Django cache (Redis recommandé en production).
"""
import json
import logging
from functools import wraps

from django.core.cache import cache
from django.conf import settings
from rest_framework.response import Response
from rest_framework import status as http_status

logger = logging.getLogger(__name__)

# Durée de conservation du résultat en cache (secondes)
IDEMPOTENCY_TTL = getattr(settings, 'IDEMPOTENCY_TTL_SECONDS', 86400)  # 24h
IDEMPOTENCY_HEADER = 'HTTP_IDEMPOTENCY_KEY'
IDEMPOTENCY_HEADER_ALT = 'HTTP_X_IDEMPOTENCY_KEY'


def _cache_key(user_id: int | str, idempotency_key: str) -> str:
    """Clé de cache scopée par utilisateur pour éviter les collisions inter-users."""
    return f"idempotency:u{user_id}:{idempotency_key}"


def get_idempotency_key(request) -> str | None:
    """Extrait l'Idempotency-Key depuis les headers de la requête."""
    return (
        request.META.get(IDEMPOTENCY_HEADER)
        or request.META.get(IDEMPOTENCY_HEADER_ALT)
        or request.data.get('idempotency_key')
    )


def idempotent_action(func):
    """
    Décorateur pour les actions DRF qui doivent être idempotentes.

    Usage sur une action ViewSet :

        @action(detail=False, methods=['post'])
        @transaction.atomic
        @idempotent_action
        def finaliser(self, request):
            ...

    Le client doit envoyer le header :
        Idempotency-Key: <uuid4>

    Si la clé est absente, l'action s'exécute normalement (pas de déduplication).
    Si la clé est présente et déjà connue, retourne le résultat en cache (HTTP 200).
    """
    @wraps(func)
    def wrapper(self, request, *args, **kwargs):
        idem_key = get_idempotency_key(request)

        if not idem_key:
            # Pas de clé fournie → exécution normale sans déduplication
            return func(self, request, *args, **kwargs)

        if len(idem_key) > 128:
            return Response(
                {'detail': 'Idempotency-Key trop longue (max 128 caractères).'},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        user_id = request.user.id if request.user.is_authenticated else 'anon'
        cache_key = _cache_key(user_id, idem_key)

        # Vérifier si la requête a déjà été traitée
        cached = cache.get(cache_key)
        if cached is not None:
            logger.info(
                "[Idempotency] Résultat en cache retourné pour key=%s user=%s",
                idem_key, user_id
            )
            try:
                cached_data = json.loads(cached['data'])
                return Response(cached_data, status=cached['status'])
            except (KeyError, json.JSONDecodeError):
                # Cache corrompu → ré-exécuter
                logger.warning("[Idempotency] Cache corrompu pour key=%s, ré-exécution.", idem_key)

        # Première exécution : appeler la vue réelle
        response = func(self, request, *args, **kwargs)

        # Mettre en cache uniquement les réponses de succès (2xx)
        if 200 <= response.status_code < 300:
            try:
                cache.set(
                    cache_key,
                    {
                        'data': json.dumps(response.data, default=str),
                        'status': response.status_code,
                    },
                    timeout=IDEMPOTENCY_TTL
                )
                logger.info(
                    "[Idempotency] Résultat mis en cache pour key=%s user=%s status=%s",
                    idem_key, user_id, response.status_code
                )
            except Exception as exc:
                # Ne jamais bloquer la réponse à cause du cache
                logger.warning("[Idempotency] Échec mise en cache: %s", exc)

        return response

    return wrapper
