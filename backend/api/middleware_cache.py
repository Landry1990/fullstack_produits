"""
Middleware pour ajouter des headers Cache-Control sur les réponses API.

Règles :
- Endpoints stables publics (tva, invoice-settings, version) : Cache-Control: public, max-age=300
- Endpoints sensibles (stock, produits, ventes, caisse, factures, pharmacy-settings) : Cache-Control: no-store
- Par défaut : Cache-Control: no-cache (validation systématique)

Note sécurité : un endpoint authentifié ne doit JAMAIS être en 'public'
(un cache partagé pourrait stocker une réponse authentifiée).
"""
import re

# Patterns d'URLs stables (lecture seule, changent rarement)
# NB : uniquement des endpoints PUBLICS. menu-hierarchy/ en a été retiré :
# endpoint IsAuthenticated — un 'public' laisserait un cache partagé
# stocker puis resservir du contenu authentifié (comme categories/ avant).
STABLE_PATTERNS = [
    re.compile(r'^/api/tva/?$'),
    re.compile(r'^/api/invoice-settings/?$'),
    re.compile(r'^/api/version/?$'),
]

# Patterns d'URLs sensibles (stock, ventes, caisse — jamais de cache)
NO_STORE_PATTERNS = [
    re.compile(r'^/api/produits'),
    re.compile(r'^/api/stock'),
    re.compile(r'^/api/ventes'),
    re.compile(r'^/api/factures'),
    re.compile(r'^/api/caisse'),
    re.compile(r'^/api/postes-caisses'),
    re.compile(r'^/api/commandes'),
    re.compile(r'^/api/inventaire'),
    re.compile(r'^/api/omnisearch'),
    # pharmacy-settings contient des secrets métier (tokens Telegram/WhatsApp/S3)
    re.compile(r'^/api/pharmacy-settings/?$'),
]


class CacheControlMiddleware:
    """Ajoute des headers Cache-Control appropriés selon l'endpoint."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Ne pas écraser si déjà défini
        if 'Cache-Control' in response:
            return response

        path = request.path

        # Endpoints stables : cache public 5 min
        for pattern in STABLE_PATTERNS:
            if pattern.match(path):
                response['Cache-Control'] = 'public, max-age=300'
                return response

        # Endpoints sensibles : jamais de cache
        for pattern in NO_STORE_PATTERNS:
            if pattern.match(path):
                response['Cache-Control'] = 'no-store'
                return response

        # Par défaut : validation systématique
        if path.startswith('/api/'):
            response['Cache-Control'] = 'no-cache'

        return response
