"""
Smoke test anti-crash : PATCH/PUT/DELETE, rôle non privilégié, entrées malformées.

Complément de `test_routes_smoke.py` (GET) et `test_post_smoke.py` (POST) :

1. `test_all_mutation_routes_no_server_error` — PUT {} / PATCH {} / DELETE sur
   toutes les routes qui les acceptent : 400/403/404 attendus, jamais 5xx.
   Auto-alimenté via urls.py.

2. `test_unprivileged_user_never_crashes` — un utilisateur sans aucune
   permission sudo (caissière) balaie les routes GET + les flux critiques :
   403 attendu sur les actions privilégiées, jamais 5xx. Détecte les crashs
   de contrôle d'accès (profile inexistant, None.attribute...).

3. `test_malformed_inputs_fail_gracefully` — IDs non numériques ('abc'),
   dates invalides/inversées, page_size exotique : 400 explicite, jamais 500.
   C'est la classe de bug des `KeyError` trouvés par le smoke POST.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_crash_smoke -v 2 --noinput
"""
from django.core.cache import cache
from django.urls import URLPattern, URLResolver, reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api import urls as api_urls
from api.models import PosteVente

from .factories import TestDataFactory

# Endpoints jamais appelés par le balayage (effets de bord externes ou
# destructeurs même en base de test) — identique à test_post_smoke.
EXCLUDED_ROUTES = {
    'system-admin-base-backup', 'system-admin-check-update',
    'system-admin-fix-restart-policy', 'system-admin-pitr-restore',
    'system-admin-restore', 'system-admin-run-backup',
    'system-admin-run-update', 'system-admin-set-update-schedule',
    'backup-create', 'backup-restore', 'code-backup-restore',
    'maintenance-backup', 'maintenance-restore', 'maintenance-run-update',
    'maintenance-retention-run', 'maintenance-export',
    'maintenance-purge', 'maintenance-purge-produits',
    'corbeille-empty', 'corbeille-purge', 'corbeille-restore',
    'whatsapp-test', 'telegram-test', 'telegram-get-chat-id',
    'telegram-rapport-flash', 'telegram-rapport-flash-date',
    'telegram-rapport-inventaire', 'telegram-rapport-mensuel',
    'facture-send-whatsapp', 'facture-send-telegram',
    'factureproduit-envoi-rappel-renouvellement',
    'sms-send', 'qz-sign', 'shift-schedule-send-to-operators',
    'product-import', 'inventaire-import-csv', 'interaction-upload-csv',
    'maintenance-import-produits', 'dci-admin-upload-compo',
    'licence-status', 'licence-notifications',
}

# pk non numérique sur les routes de détail les plus utilisées
DETAIL_ROUTES_BAD_PK = [
    'produit-detail', 'facture-detail', 'commande-detail',
    'inventaire-detail', 'creance-detail', 'promis-detail',
    'avoir-detail', 'fournisseur-detail', 'client-detail',
    'postevente-detail', 'stocklot-detail', 'avoirclient-detail',
    'ligneinventaire-detail', 'factureproduit-detail',
    'commandeproduit-detail', 'caisse-detail', 'mouvementcaisse-detail',
]

# Endpoints de rapports/statistiques : dates et paramètres exotiques
REPORT_ROUTES_BAD_PARAMS = {
    'rapports-balance-stock-excel': {'date_debut': 'abc', 'date_fin': 'def'},
    'rapports-rapport-mensuel-pdf': {'mois': 'pas-un-mois'},
    'rapports-rapport-par-dates-pdf': {
        'date_debut': '2030-12-31', 'date_fin': '2020-01-01',  # inversées
    },
    'rapports-export-comptable-csv': {'date_debut': 'xx', 'date_fin': 'yy'},
    'rapports-export-sage-i7': {
        'date_debut': '2030-01-01', 'date_fin': '2020-01-01',
    },
    'creance-releve': {'client_id': 'abc'},
    'produit-list': {'page_size': 'abc'},
    'produit-list#2': {'page_size': '99999999'},
    'facture-list': {'date_debut': '13/45/9999'},
}

SAFE_STATUSES = set(range(200, 500))


def _iter_urlpatterns(patterns, prefix=''):
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _iter_urlpatterns(
                pattern.url_patterns, prefix + str(pattern.pattern)
            )
        elif isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern


def _view_model(callback):
    """Modèle du queryset du ViewSet, pour résoudre un pk réel."""
    cls = getattr(callback, 'cls', None)
    queryset = getattr(cls, 'queryset', None)
    model = getattr(queryset, 'model', None)
    if model is not None:
        return model
    if cls is not None:
        try:
            return cls().get_queryset().model
        except Exception:
            return None
    return None


class CrashSmokeTest(APITestCase):
    """PATCH/PUT/DELETE + user sans droits + entrées corrompues → jamais 5xx."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = TestDataFactory.create_superuser(username='crash-admin')
        # Caissière : compte actif mais AUCUNE permission sudo sur le profil
        cls.caissiere = TestDataFactory.create_user(username='crash-caissiere')

        cls.produit = TestDataFactory.create_produit(stock=100)
        cls.fournisseur = cls.produit.fournisseur
        cls.customer = TestDataFactory.create_client()
        cls.facture = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=1000
        )
        TestDataFactory.create_facture_produit(
            cls.facture, cls.produit, selling_price=1000
        )
        cls.commande = TestDataFactory.create_commande(
            fournisseur=cls.fournisseur
        )
        TestDataFactory.create_commande_produit(cls.commande, cls.produit)
        cls.poste_caisse = TestDataFactory.create_poste_caisse()
        cls.poste_vente = TestDataFactory.create_session_caisse(
            user=cls.admin, poste=cls.poste_caisse
        )

    def setUp(self):
        cache.clear()
        self.client.raise_request_exception = False
        self.routes = self._collect()

    def tearDown(self):
        cache.clear()

    # ── Collecte ──

    def _collect(self):
        """Routes nommées avec méthodes acceptées, paramètres et modèle."""
        routes = {}
        for route_str, pattern in _iter_urlpatterns(api_urls.urlpatterns):
            name = pattern.name
            if not name or name in routes or name in EXCLUDED_ROUTES:
                continue
            param_names = [
                p for p in pattern.pattern.regex.groupindex.keys()
                if p != 'format'
            ]
            actions = getattr(pattern.callback, 'actions', None)
            if actions is not None:
                methods = {m for m in actions if m in
                           ('get', 'post', 'put', 'patch', 'delete')}
            else:
                cls = getattr(pattern.callback, 'cls', None)
                methods = {
                    m for m in ('get', 'post', 'put', 'patch', 'delete')
                    if cls is not None and hasattr(cls, m)
                }
            routes[name] = {
                'name': name,
                'params': param_names,
                'methods': methods,
                'model': _view_model(pattern.callback),
            }
        return routes

    def _resolve(self, entry, pk_override=None):
        kwargs = {}
        for param in entry['params']:
            if pk_override is not None:
                kwargs[param] = pk_override
            elif param == 'commande_id':
                kwargs[param] = str(self.commande.pk)
            elif param in ('pk', 'id'):
                obj = None
                if entry['model'] is not None:
                    obj = entry['model'].objects.first()
                kwargs[param] = str(obj.pk) if obj else '1'
            else:
                kwargs[param] = '1'
        try:
            return reverse(entry['name'], kwargs=kwargs or None)
        except Exception:
            return None

    def _sweep(self, entries, method, payload=None, label=''):
        """Balaye les routes avec une méthode donnée. Retourne les échecs."""
        failures = []
        tested = 0
        for entry in entries:
            if method not in entry['methods']:
                continue
            url = self._resolve(entry)
            if url is None:
                continue
            tested += 1
            try:
                response = getattr(self.client, method)(
                    url, payload if payload is not None else {},
                    format='json' if method != 'delete' else None,
                )
            except Exception as exc:
                failures.append(
                    (entry['name'], f'exception {type(exc).__name__}: {exc}')
                )
                continue
            if response.status_code >= 500:
                failures.append(
                    (entry['name'],
                     f'{method.upper()} HTTP {response.status_code} — '
                     f'{response.content[:200]!r}')
                )
        return tested, failures

    # ── 1. PATCH / PUT / DELETE ──

    def test_all_mutation_routes_no_server_error(self):
        """PUT {} / PATCH {} / DELETE sur chaque route : jamais 5xx."""
        self.client.force_authenticate(user=self.admin)
        entries = list(self.routes.values())
        all_failures = []

        for method in ('put', 'patch', 'delete'):
            tested, failures = self._sweep(entries, method)
            print(f'[{method.upper()}] {tested} routes testées, '
                  f'{len(failures)} échec(s)')
            all_failures.extend(failures)

        # Dédupliquer les routes testées par plusieurs méthodes
        seen = {}
        for name, detail in all_failures:
            seen.setdefault(name, detail)
        if all_failures:
            print('\n[FAIL PATCH/PUT/DELETE]')
            for name, detail in sorted(seen.items()):
                print(f'  {name:55} {detail}')

        self.assertFalse(
            all_failures,
            '\n' + '\n'.join(f'  {n:55} {d}' for n, d in seen.items()),
        )

    # ── 2. Utilisateur sans privilèges ──

    def test_unprivileged_user_never_crashes(self):
        """La caissière sans droits : 401/403/404 attendus, jamais 5xx."""
        self.client.force_authenticate(user=self.caissiere)
        failures = []
        get_tested = post_tested = 0

        for entry in self.routes.values():
            if 'get' in entry['methods']:
                url = self._resolve(entry)
                if url:
                    get_tested += 1
                    try:
                        code = self.client.get(url).status_code
                    except Exception as exc:
                        failures.append(
                            (entry['name'], f'GET exception {exc}'))
                        continue
                    if code >= 500:
                        failures.append(
                            (entry['name'], f'GET HTTP {code}'))

            if 'post' in entry['methods']:
                url = self._resolve(entry)
                if url:
                    post_tested += 1
                    try:
                        code = self.client.post(
                            url, {}, format='json').status_code
                    except Exception as exc:
                        failures.append(
                            (entry['name'], f'POST exception {exc}'))
                        continue
                    if code >= 500:
                        failures.append(
                            (entry['name'], f'POST HTTP {code}'))

        print(f'\n[CAISSIÈRE] GET {get_tested} + POST {post_tested} routes, '
              f'{len(failures)} crash(s)')
        if failures:
            for name, detail in sorted(set(failures)):
                print(f'  {name:55} {detail}')

        self.assertFalse(
            failures,
            '\n' + '\n'.join(f'  {n:55} {d}' for n, d in set(failures)),
        )

    # ── 3. Entrées malformées ──

    def test_malformed_inputs_fail_gracefully(self):
        """pk='abc', dates invalides/inversées, page_size exotique → 4xx."""
        self.client.force_authenticate(user=self.admin)
        failures = []

        for name in DETAIL_ROUTES_BAD_PK:
            if name not in self.routes:
                continue
            try:
                url = reverse(name, kwargs={'pk': 'abc'})
            except Exception:
                continue
            try:
                code = self.client.get(url).status_code
            except Exception as exc:
                failures.append((name, f'pk=abc → exception {exc}'))
                continue
            if code >= 500:
                failures.append((name, f'pk=abc → HTTP {code}'))

        for key, params in REPORT_ROUTES_BAD_PARAMS.items():
            name = key.split('#')[0]  # '#2' = variante du même endpoint
            if name not in self.routes:
                continue
            try:
                url = reverse(name)
            except Exception:
                continue
            try:
                response = self.client.get(url, params)
                code = response.status_code
            except Exception as exc:
                failures.append((name, f'{params} → exception {exc}'))
                continue
            if code >= 500:
                failures.append(
                    (name, f'{params} → HTTP {code} '
                           f'{response.content[:150]!r}'))

        # Body JSON malformé sur les endpoints de saisie critiques
        for name in ('facture-finaliser', 'caisse-list', 'produit-list'):
            if name not in self.routes:
                continue
            try:
                url = reverse(name)
                response = self.client.post(
                    url, 'pas du json{{{',
                    content_type='application/json')
                code = response.status_code
            except Exception as exc:
                failures.append((name, f'json malformé → exception {exc}'))
                continue
            if code >= 500:
                failures.append((name, f'json malformé → HTTP {code}'))

        if failures:
            print('\n[FAIL entrées malformées]')
            for name, detail in failures:
                print(f'  {name:45} {detail}')
        self.assertFalse(
            failures,
            '\n' + '\n'.join(f'  {n:45} {d}' for n, d in failures),
        )
