"""
Smoke test métier des endpoints POST de l'API.

Deux niveaux :

1. `test_critical_business_flows` — les actions métier critiques reçoivent de
   vraies données de test + payloads valides : elles doivent RÉUSSIR (2xx).
   Une 400/500 ici signifie un vrai bug (vente, caisse, commande, stock).

2. `test_all_post_routes_no_server_error` — TOUS les autres endpoints POST
   reçoivent un payload {} : 400/404/403 attendus (validation), mais jamais
   5xx ni exception non gérée. Auto-alimenté : tout nouveau POST ajouté à
   urls.py est couvert.

Les endpoints à effet de bord irréversible ou externes (purges, backups,
restores, mises à jour système, envois WhatsApp/Telegram/SMS, uploads de
fichiers) sont exclus via EXCLUDED_POST_ROUTES.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_post_smoke -v 2 --noinput
"""
from django.core.cache import cache
from django.urls import URLPattern, URLResolver, reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api import urls as api_urls
from api.models import Avoir, Caisse, Inventaire, PosteVente, Promis

from .factories import TestDataFactory

# POST jamais testés par le balayage générique (effets de bord externes
# ou destructeurs même en base de test) — couverts manuellement si besoin.
EXCLUDED_POST_ROUTES = {
    # Système / maintenance : commandes docker, mises à jour, backup/restore
    'system-admin-base-backup', 'system-admin-check-update',
    'system-admin-fix-restart-policy', 'system-admin-pitr-restore',
    'system-admin-restore', 'system-admin-run-backup',
    'system-admin-run-update', 'system-admin-set-update-schedule',
    'backup-create', 'backup-restore', 'code-backup-restore',
    'maintenance-backup', 'maintenance-restore', 'maintenance-run-update',
    'maintenance-retention-run', 'maintenance-export',
    # Purges / corbeille : destructrices
    'maintenance-purge', 'maintenance-purge-produits',
    'corbeille-empty', 'corbeille-purge', 'corbeille-restore',
    # Intégrations externes : réseau réel (Telegram, WhatsApp, SMS, QZ)
    'whatsapp-test', 'telegram-test', 'telegram-get-chat-id',
    'telegram-rapport-flash', 'telegram-rapport-flash-date',
    'telegram-rapport-inventaire', 'telegram-rapport-mensuel',
    'facture-send-whatsapp', 'facture-send-telegram',
    'factureproduit-envoi-rappel-renouvellement',
    'sms-send', 'qz-sign', 'shift-schedule-send-to-operators',
    # Uploads de fichiers : nécessitent multipart, couverts par tests dédiés
    'product-import', 'inventaire-import-csv', 'interaction-upload-csv',
    'maintenance-import-produits', 'dci-admin-upload-compo',
    # Licence : écriture d'état licence
    'licence-status', 'licence-notifications',
}

# Flux métier critiques : vrais payloads → 2xx obligatoire.
# 'setup' crée les fixtures dont le flow dépend ; 'kwargs'/'payload' sont
# des callables recevant le test (self.xxx pour les objets seedés).
CRITICAL_FLOWS = [
    {
        'id': 'postevente-ouvrir',
        'route': 'postevente-ouvrir',
        'kwargs': lambda s: {'pk': s.poste_caisse_2.pk},
        'payload': {'fond_de_caisse': 10000},
        'expect': 'success',
    },
    {
        'id': 'caisse-list',
        'route': 'caisse-list',
        'kwargs': None,
        'payload': lambda s: {
            'facture_id': s.facture_validee.pk,
            'montant': 500,
            'mode_paiement': 'especes',
        },
        'expect': 'success',
    },
    {
        'id': 'postevente-fermer',
        'route': 'postevente-fermer',
        'kwargs': lambda s: {'pk': getattr(s, 'poste_vente_ouvert', None)
                                and s.poste_vente_ouvert.pk or '1'},
        'payload': {},
        'expect': 'success',
        # Le poste ouvert dans le flow précédent — ordre garanti par la liste.
    },
    {
        'id': 'postevente-activer',
        'route': 'postevente-activer',
        'kwargs': lambda s: {'pk': s.poste_pos.pk},
        'payload': {'fond_de_caisse': 0},
        'expect': 'success',
    },
    {
        'id': 'facture-valider',
        'route': 'facture-valider',
        'kwargs': lambda s: {'pk': s.facture_brouillon.pk},
        'payload': {},
        'expect': 'success',
    },
    {
        'id': 'facture-marquer-payee',
        'route': 'facture-marquer-payee',
        'kwargs': lambda s: {'pk': s.facture_validee.pk},
        'payload': {},
        'expect': 'success',
    },
    {
        'id': 'facture-annuler',
        'route': 'facture-annuler',
        'kwargs': lambda s: {'pk': s.facture_a_annuler.pk},
        'payload': {'motif': 'smoke test'},
        'expect': 'success',
    },
    {
        'id': 'creance-ajouter-paiement',
        'route': 'creance-ajouter-paiement',
        'kwargs': lambda s: {'pk': s.creance.pk},
        'payload': {'montant': 200, 'mode_paiement': 'especes'},
        'expect': 'success',
    },
    {
        'id': 'commande-lock',
        'route': 'commande-lock',
        'kwargs': lambda s: {'pk': s.commande.pk},
        'payload': {},
        'expect': 'success',
    },
    {
        'id': 'commande-unlock',
        'route': 'commande-unlock',
        'kwargs': lambda s: {'pk': s.commande.pk},
        'payload': {},
        'expect': 'success',
    },
    {
        'id': 'commande-cloturer',
        'route': 'commande-cloturer',
        'kwargs': lambda s: {'pk': s.commande_a_cloturer.pk},
        'payload': {},
        'expect': 'success',
    },
    {
        'id': 'produit-adjust-stock',
        'route': 'produit-adjust-stock',
        'kwargs': lambda s: {'pk': s.produit.pk},
        'payload': {'new_quantity': 42, 'reason_type': 'CASSE'},
        'expect': 'success',
    },
    {
        'id': 'avoir-valider',
        'route': 'avoir-valider',
        'kwargs': lambda s: {'pk': s.avoir.pk},
        'payload': {},
        'expect': 'success',
    },
    {
        'id': 'promis-delivrer',
        'route': 'promis-delivrer',
        'kwargs': lambda s: {'pk': s.promis.pk},
        'payload': {},
        'expect': 'success',
    },
]

# Endpoints POST qui doivent rejeter proprement un payload vide (400/404/403).
# Vérifiés dans le balayage générique : jamais 5xx.
SUCCESS_STATUSES = set(range(200, 300))
SAFE_STATUSES = set(range(200, 500)) - set(range(500, 600))


def _iter_urlpatterns(patterns, prefix=''):
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _iter_urlpatterns(
                pattern.url_patterns, prefix + str(pattern.pattern)
            )
        elif isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern


class PostSmokeTest(APITestCase):
    """Smoke test des actions POST : flux critiques + aucun 5xx ailleurs."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = TestDataFactory.create_superuser(username='post-admin')

        cls.produit = TestDataFactory.create_produit(stock=100)
        cls.produit_2 = TestDataFactory.create_produit(stock=50)
        cls.fournisseur = cls.produit.fournisseur
        cls.customer = TestDataFactory.create_client()

        # Caisse physique + session de vente (requis par CaisseViewSet.create)
        cls.poste_caisse = TestDataFactory.create_poste_caisse()
        cls.poste_vente = TestDataFactory.create_session_caisse(
            user=cls.admin, poste=cls.poste_caisse
        )
        # 2e caisse libre dédiée au flow ouvrir/fermer
        # (poste_caisse est déjà occupée par poste_vente).
        cls.poste_caisse_2 = TestDataFactory.create_poste_caisse()
        # Poste POS sans caisse physique (définition pour `activer`)
        cls.poste_pos = PosteVente.objects.create(
            nom='POS Smoke', caisse=None, vendeur=None,
            est_actif=False, mode_pos=True,
        )

        # Facture validée pour paiement + marquer_payee
        cls.facture_validee = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=1000
        )
        TestDataFactory.create_facture_produit(
            cls.facture_validee, cls.produit, selling_price=1000
        )

        # Brouillon à valider
        cls.facture_brouillon = TestDataFactory.create_facture(
            client=cls.customer, status='BROU', total_ttc=500
        )
        TestDataFactory.create_facture_produit(
            cls.facture_brouillon, cls.produit, selling_price=500
        )

        # Facture validée à annuler
        cls.facture_a_annuler = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=300
        )
        TestDataFactory.create_facture_produit(
            cls.facture_a_annuler, cls.produit, selling_price=300
        )

        # Créance : paiement 'en_compte' requis par ajouter_paiement
        cls.creance = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=2000
        )
        TestDataFactory.create_facture_produit(
            cls.creance, cls.produit, selling_price=2000
        )
        Caisse.objects.create(
            facture=cls.creance, montant=2000,
            mode_paiement='en_compte', statut='completee',
            user=cls.admin,
        )

        cls.commande = TestDataFactory.create_commande(
            fournisseur=cls.fournisseur
        )
        TestDataFactory.create_commande_produit(cls.commande, cls.produit)

        cls.commande_a_cloturer = TestDataFactory.create_commande(
            fournisseur=cls.fournisseur, status='PREP'
        )
        TestDataFactory.create_commande_produit(
            cls.commande_a_cloturer, cls.produit_2, quantity=5
        )

        cls.avoir = Avoir.objects.create(
            fournisseur=cls.fournisseur, created_by=cls.admin,
            status='BROUILLON',
        )
        cls.promis = Promis.objects.create(
            client=cls.customer, produit=cls.produit,
            quantite=2, created_by=cls.admin,
        )
        cls.inventaire = Inventaire.objects.create(
            reference='INV-POST-TEST', created_by=cls.admin
        )

    def setUp(self):
        cache.clear()
        self.client.raise_request_exception = False
        self.client.force_authenticate(user=self.admin)

    def tearDown(self):
        cache.clear()

    # ── Helpers ──

    def _reverse(self, route, kwargs):
        return reverse(route, kwargs=kwargs or None)

    # ── Niveau 1 : flux critiques ──

    def test_critical_business_flows(self):
        """Les actions métier critiques doivent réussir avec des données valides."""
        results = {'OK': [], 'FAIL': []}

        for flow in CRITICAL_FLOWS:
            kwargs = flow['kwargs'](self) if flow['kwargs'] else None
            payload = (
                flow['payload'](self) if callable(flow['payload'])
                else flow['payload']
            )
            try:
                url = self._reverse(flow['route'], kwargs)
            except Exception as exc:
                results['FAIL'].append((flow['id'], f'reverse: {exc}'))
                continue

            try:
                response = self.client.post(url, payload, format='json')
            except Exception as exc:
                results['FAIL'].append(
                    (flow['id'], f'exception {type(exc).__name__}: {exc}')
                )
                continue

            if response.status_code in SUCCESS_STATUSES:
                results['OK'].append((flow['id'], response.status_code))
                # postevente-ouvrir crée le poste utilisé par postevente-fermer
                if flow['id'] == 'postevente-ouvrir':
                    self.poste_vente_ouvert = PosteVente.objects.filter(
                        est_actif=True, mode_pos=False
                    ).order_by('-id').first()
            else:
                results['FAIL'].append(
                    (flow['id'],
                     f'HTTP {response.status_code} — {response.content[:250]!r}')
                )

        print('\n' + '=' * 60)
        print('SMOKE TEST POST — flux critiques')
        print('=' * 60)
        print(f'\n[OK] {len(results["OK"])} flux')
        for name, code in results['OK']:
            print(f'  {name:40} HTTP {code}')
        if results['FAIL']:
            print(f'\n[FAIL] {len(results["FAIL"])} flux')
            for name, detail in results['FAIL']:
                print(f'  {name:40} {detail}')

        self.assertFalse(
            results['FAIL'],
            '\n' + '\n'.join(f'  {n:40} {d}' for n, d in results['FAIL']),
        )

    # ── Niveau 2 : balayage générique ──

    def test_all_post_routes_no_server_error(self):
        """POST {} sur chaque route : 400/404/403 OK, jamais 5xx."""
        tested = results_ok = results_skip = 0
        failures = []

        for route_str, pattern in _iter_urlpatterns(api_urls.urlpatterns):
            name = pattern.name
            if not name or name in EXCLUDED_POST_ROUTES:
                continue

            actions = getattr(pattern.callback, 'actions', None)
            if actions is not None:
                if 'post' not in actions:
                    continue
            else:
                cls = getattr(pattern.callback, 'cls', None)
                if cls is None or not hasattr(cls, 'post'):
                    continue

            param_names = [
                p for p in pattern.pattern.regex.groupindex.keys()
                if p != 'format'
            ]
            kwargs = {}
            for param in param_names:
                if param == 'commande_id':
                    kwargs[param] = str(self.commande.pk)
                else:
                    kwargs[param] = '1'

            try:
                url = reverse(name, kwargs=kwargs or None)
            except Exception:
                results_skip += 1
                continue

            tested += 1
            try:
                response = self.client.post(url, {}, format='json')
            except Exception as exc:
                failures.append((name, f'exception {type(exc).__name__}: {exc}'))
                continue

            if response.status_code >= 500:
                failures.append(
                    (name,
                     f'HTTP {response.status_code} — '
                     f'{response.content[:200]!r}')
                )
            else:
                results_ok += 1

        print('\n' + '=' * 60)
        print(f'SMOKE TEST POST générique — {tested} routes POST testées, '
              f'{results_skip} non résolubles')
        print('=' * 60)
        print(f'\n[OK] {results_ok} route(s) → réponse < 500')
        if failures:
            print(f'\n[FAIL] {len(failures)} route(s)')
            for name, detail in sorted(failures):
                print(f'  {name:55} {detail}')

        self.assertGreater(tested, 50, 'Trop peu de routes POST collectées')
        self.assertFalse(
            failures,
            '\n' + '\n'.join(f'  {n:55} {d}' for n, d in failures),
        )

    def test_post_routes_require_auth(self):
        """Les actions métier critiques ne doivent pas être publiques."""
        self.client.force_authenticate(user=None)
        public = []
        for flow in CRITICAL_FLOWS:
            kwargs = flow['kwargs'](self) if flow['kwargs'] else None
            try:
                url = self._reverse(flow['route'], kwargs)
            except Exception:
                continue
            try:
                if self.client.post(url, {}, format='json').status_code < 400:
                    public.append(flow['id'])
            except Exception:
                continue
        self.assertFalse(
            public, f'Endpoints métier accessibles sans auth : {public}'
        )
