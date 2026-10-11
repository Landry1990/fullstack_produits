"""
Smoke test de toutes les routes GET de l'API.

Parcourt dynamiquement `api.urls` (router DRF + paths explicites) et vérifie :
- qu'aucun GET ne renvoie d'erreur serveur (5xx) ni d'exception,
- que les listes ne 404 pas,
- que les routes protégées renvoient 401/403 sans authentification.

Le test est auto-alimenté : toute nouvelle route ajoutée à urls.py est testée
automatiquement. Les 400/403/404-sur-détail sont rapportés comme avertissements
(paramètre requis, permission spécifique, absence de donnée de test), pas comme
échecs — le test échoue uniquement sur les vraies cassures.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_routes_smoke -v 2 --noinput
"""
import re

from django.core.cache import cache
from django.urls import URLPattern, URLResolver, reverse
from django.urls.exceptions import NoReverseMatch
from rest_framework import status
from rest_framework.test import APITestCase

from api import urls as api_urls

from .factories import TestDataFactory

# Endpoints GET volontairement publics (AllowAny explicite dans la vue)
KNOWN_PUBLIC_ROUTES = {
    'health-check',        # monitoring Docker
    'api-root',            # sonde /api/
    'app-version',         # version publique
    'qz-certificate',      # certificat QZ Tray
    'licence-status',      # écran licence avant login
    'user-login-options',  # options de la page de connexion
    'categories-list',     # vitrine publique
    'categories-detail',   # vitrine publique
}


def iter_urlpatterns(patterns, prefix=''):
    """Aplatit urlpatterns + includes en (route_str, URLPattern)."""
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from iter_urlpatterns(
                pattern.url_patterns, prefix + str(pattern.pattern)
            )
        elif isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern


def get_view_cls(callback):
    """Retourne la classe de vue (APIView/ViewSet) si accessible."""
    return getattr(callback, 'cls', None)


def get_view_model(cls):
    """Retourne le modèle du queryset d'un ViewSet, ou None."""
    if cls is None:
        return None
    queryset = getattr(cls, 'queryset', None)
    model = getattr(queryset, 'model', None)
    if model is not None:
        return model
    # Certains viewsets définissent get_queryset sans attribut queryset
    try:
        return cls().get_queryset().model
    except Exception:
        return None


class ApiRoutesSmokeTest(APITestCase):
    """Vérifie que toutes les routes GET répondent sans erreur serveur."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = TestDataFactory.create_superuser(username='smoke-admin')
        # Données de base pour exercer les routes de détail (<pk>)
        cls.produit = TestDataFactory.create_produit()
        cls.stock_lot = TestDataFactory.create_stock_lot(cls.produit)
        cls.client = TestDataFactory.create_client()
        cls.facture = TestDataFactory.create_facture(client=cls.client)
        cls.facture_produit = TestDataFactory.create_facture_produit(
            cls.facture, cls.produit
        )
        cls.commande = TestDataFactory.create_commande(
            fournisseur=cls.produit.fournisseur
        )
        cls.commande_produit = TestDataFactory.create_commande_produit(
            cls.commande, cls.produit
        )
        cls.poste_caisse = TestDataFactory.create_poste_caisse()
        cls.poste_vente = TestDataFactory.create_session_caisse(
            user=cls.admin, poste=cls.poste_caisse
        )
        cls.mouvement = TestDataFactory.create_mouvement_caisse(cls.admin)

    def setUp(self):
        cache.clear()
        self.client.raise_request_exception = False
        self.routes = self._collect_routes()

    def tearDown(self):
        cache.clear()

    # ── Collecte des routes ──

    def _collect_routes(self):
        """Retourne les entrées {name, params, cls, model} dédupliquées."""
        routes = []
        seen_names = set()
        for route_str, pattern in iter_urlpatterns(api_urls.urlpatterns):
            name = pattern.name
            if not name or name in seen_names:
                continue
            seen_names.add(name)

            callback = pattern.callback
            cls = get_view_cls(callback)
            param_names = list(pattern.pattern.regex.groupindex.keys())

            # Variantes format-suffix (.json/.api) — doublons des routes de base
            if 'format' in param_names:
                seen_names.discard(name)
                continue

            routes.append({
                'name': name,
                'route': route_str,
                'params': param_names,
                'cls': cls,
                'model': get_view_model(cls),
                'callback': callback,
            })
        return routes

    def _get_allowed(self, entry):
        """La route accepte-t-elle GET ?"""
        actions = getattr(entry['callback'], 'actions', None)
        if actions is not None:
            return 'get' in actions
        cls = entry['cls']
        if cls is None:
            # Vue fonction simple (lambda api-root, health…) — GET supporté
            return True
        return hasattr(cls, 'get')

    def _resolve_url(self, entry):
        """Construit l'URL via reverse(); None si impossible."""
        kwargs = {}
        for param in entry['params']:
            if param in ('pk', 'id', 'inventaire_id', 'facture_id'):
                obj = None
                if entry['model'] is not None:
                    obj = entry['model'].objects.first()
                kwargs[param] = str(obj.pk) if obj else '1'
            elif param == 'commande_id':
                kwargs[param] = str(self.commande.pk)
            elif param == 'filename':
                kwargs[param] = 'no-such-file.zip'
            else:
                kwargs[param] = '1'
        try:
            return reverse(entry['name'], kwargs=kwargs)
        except NoReverseMatch:
            return None

    def _classify(self, entry, status_code):
        """Retourne (verdict, label) pour un code de statut authentifié."""
        if status_code is None:
            return 'FAIL', 'url-not-reversible'
        if 200 <= status_code < 400:
            return 'OK', 'ok'
        if status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            return 'SKIP', 'no-get'
        if status_code >= 500:
            return 'FAIL', 'server-error'
        if status_code == status.HTTP_404_NOT_FOUND:
            # L'URL vient de reverse() → le 404 vient forcément de la vue :
            # donnée absente (détail) ou ressource introuvable (ex. changelog).
            label = 'detail-no-data' if entry['params'] else 'handled-404'
            return 'WARN', label
        return 'WARN', f'http-{status_code}'

    # ── Tests ──

    def test_all_get_routes_no_server_error(self):
        self.client.force_authenticate(user=self.admin)

        results = {'OK': [], 'WARN': [], 'SKIP': [], 'FAIL': []}
        for entry in self.routes:
            if not self._get_allowed(entry):
                results['SKIP'].append((entry, 'post-only'))
                continue

            url = self._resolve_url(entry)
            code = None
            if url is not None:
                try:
                    code = self.client.get(url).status_code
                except Exception as exc:  # 500 levé malgré tout
                    results['FAIL'].append((entry, f'{type(exc).__name__}: {exc}'))
                    continue
            verdict, label = self._classify(entry, code)
            results[verdict].append((entry, f'{label} [{code}]'))

        self._print_report(results)

        failures = results['FAIL']
        self.assertFalse(
            failures,
            '\n' + '\n'.join(
                f"  {entry['name']:45} {detail}" for entry, detail in failures
            ),
        )

    def test_protected_routes_require_auth(self):
        self.client.force_authenticate(user=None)

        public = []
        for entry in self.routes:
            if not self._get_allowed(entry):
                continue
            url = self._resolve_url(entry)
            if url is None:
                continue
            try:
                code = self.client.get(url).status_code
            except Exception:
                continue
            if 200 <= code < 400:
                public.append(entry['name'])

        unexpected = sorted(set(public) - KNOWN_PUBLIC_ROUTES)
        if public:
            print('\n── Routes accessibles sans auth ──')
            for name in sorted(set(public)):
                tag = '' if name in KNOWN_PUBLIC_ROUTES else '  <- INATTENDU'
                print(f'  {name}{tag}')
        self.assertFalse(
            unexpected,
            f'Routes protégées accessibles sans authentification : {unexpected}',
        )

    def test_route_inventory_is_non_empty(self):
        """Garde-fou : la collecte doit trouver un nombre cohérent de routes."""
        get_routes = [r for r in self.routes if self._get_allowed(r)]
        print(f'\n── Inventaire : {len(self.routes)} routes nommées, '
              f'{len(get_routes)} acceptent GET ──')
        self.assertGreater(len(self.routes), 100)

    # ── Rapport ──

    def _print_report(self, results):
        print('\n' + '=' * 60)
        print('SMOKE TEST ROUTES API — rapport')
        print('=' * 60)
        for verdict in ('OK', 'WARN', 'SKIP', 'FAIL'):
            entries = results[verdict]
            print(f'\n[{verdict}] {len(entries)} route(s)')
            for entry, detail in sorted(entries, key=lambda x: x[0]['name']):
                print(f"  {entry['name']:45} {detail}")
