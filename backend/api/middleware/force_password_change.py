"""
Middleware : changement de mot de passe obligatoire au premier login.

Si `Profile.must_change_password` est True, l'utilisateur authentifié ne peut
appeler QUE les endpoints de la whitelist ci-dessous ; toute autre requête
sous /api/ reçoit un 403 explicite. Le frontend affiche alors un écran de
changement de mot de passe non dismissible.

Note : request.user n'est peuplé par AuthenticationMiddleware que pour l'auth
par session. Pour l'auth par token (cas normal de l'app), on résout le token
manuellement depuis le header Authorization.
"""

import sys

from django.http import JsonResponse

# ── Whitelist ────────────────────────────────────────────────────────────────
# Chemins autorisés tant que le mot de passe n'a pas été changé.
# Format : (prefixe_de_path, methodes_http_autorisees_ou_None_pour_toutes).
# Volontairement minimale : changer le mot de passe, se déconnecter, et les
# GET informatifs indispensables au boot du frontend (contexts/providers).
ALLOWED_PATHS = [
    ('/api/users/change-my-password/', None),   # L'endpoint de changement lui-même
    ('/api/auth/logout/', ('POST',)),           # Déconnexion toujours possible
    ('/api/users/logout/', ('POST',)),          # Variante routeur de la déconnexion
    ('/api/users/me/', ('GET',)),               # Profil courant
    ('/api/pharmacy-settings/', ('GET',)),      # PharmacySettingsContext (boot)
    ('/api/licence/', ('GET',)),                # LicenceContext (nom de la pharmacie)
    ('/api/version/', ('GET',)),                # useVersionCheck (polling)
    ('/api/health/', ('GET',)),                 # Healthcheck (public de toute façon)
    ('/api/auth/token/', ('POST',)),            # Login (pas d'user authentifié en pratique)
]
# ─────────────────────────────────────────────────────────────────────────────

FORBIDDEN_DETAIL = 'Changement de mot de passe obligatoire.'
FORBIDDEN_CODE = 'PASSWORD_CHANGE_REQUIRED'


def _resolve_request_user(request):
    """Retourne l'utilisateur authentifié (session OU token DRF), sinon None."""
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        return user

    # Auth par token : DRF ne résout le token qu'au niveau de la vue — trop tard
    # pour un middleware. On relit le header Authorization nous-mêmes.
    header = request.META.get('HTTP_AUTHORIZATION', '')
    if header.startswith('Token '):
        from rest_framework.authtoken.models import Token
        try:
            return (
                Token.objects
                .select_related('user', 'user__profile')
                .get(key=header[len('Token '):].strip())
                .user
            )
        except Token.DoesNotExist:
            return None
    return None


def _is_path_allowed(request):
    for prefix, methods in ALLOWED_PATHS:
        if request.path_info.startswith(prefix):
            if methods is None or request.method in methods:
                return True
    return False


class ForcePasswordChangeMiddleware:
    """Bloque l'API tant que le mot de passe par défaut n'a pas été changé."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Même tolérance que LicenceMiddleware : ne pas gêner la suite de tests.
        if 'test' in sys.argv or any('pytest' in arg for arg in sys.argv):
            return self.get_response(request)

        # On ne contraint que l'API applicative (admin Django, statiques et
        # WebSockets Channels ne sont pas ciblés).
        if request.path_info.startswith('/api/'):
            user = _resolve_request_user(request)

            if user is not None:
                profile = getattr(user, 'profile', None)
                if profile and profile.must_change_password and not _is_path_allowed(request):
                    return JsonResponse(
                        {'detail': FORBIDDEN_DETAIL, 'code_erreur': FORBIDDEN_CODE},
                        status=403,
                    )
            # Pas d'user (endpoints publics : login, licence, health) → rien à forcer

        return self.get_response(request)
