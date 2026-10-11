"""
Smoke test WebSocket : les 5 endpoints Channels ne doivent jamais crasher.

La caisse centralisée dépend des WS pour le temps réel — un consumer qui
plante déconnecte la caisse silencieusement. Couverture :

1. `test_all_endpoints_connect_and_ping` — chaque endpoint accepte la
   connexion (avec token quand exigé) et répond ping→pong.
2. `test_unauthenticated_and_invalid_token_rejected` — ws/stock et ws/lock
   exigent l'auth → close 4001 ; token invalide → 4001 (middleware).
3. `test_pda_cashier_relay` — un item envoyé par le PDA arrive à la caisse,
   et un statut de la caisse revient au PDA.
4. `test_caisse_centralisee_facture_update` — le broadcast groupe atteint
   le client avec le bon format.
5. `test_stock_update_broadcast` — idem pour 'stock_updates'.
6. `test_document_lock_protocol` — acquire/release/heartbeat/denied :
   le verrouillage pessimiste des documents fonctionne de bout en bout.
7. `test_malformed_input_never_crashes` — JSON cassé, types inconnus :
   la connexion survit, jamais de déconnexion brutale.

NOTE SÉCURITÉ (observation, pas un échec) : `ws/cashier/`, `ws/pda/` et
`ws/caisse_centralisee/` acceptent les clients non authentifiés — tout
appareil du réseau peut injecter des articles dans la caisse ou écouter
les mises à jour de factures. Acceptable en LAN de confiance, à durcir
si le serveur est exposé.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_websocket_smoke -v 2 --noinput
"""
import json

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from rest_framework.authtoken.models import Token

from api.routing import websocket_urlpatterns
from api.ws_auth_middleware import TokenAuthMiddleware

from .factories import TestDataFactory

# Layer en mémoire : ne pas polluer le vrai Redis (dev/prod) avec les
# messages du test, et garder le test déterministe.
TEST_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

# Même pile qu'en prod : TokenAuthMiddleware(AuthMiddlewareStack(URLRouter))
APPLICATION = TokenAuthMiddleware(
    AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
)

TIMEOUT = 3


@override_settings(CHANNEL_LAYERS=TEST_LAYERS)
class WebSocketSmokeTest(TransactionTestCase):
    """Les consumers WS acceptent, relaient et refusent sans jamais crasher."""

    @classmethod
    def setUpClass(cls):
        # setUpTestData n'existe que sur TestCase (atomics par classe) —
        # TransactionTestCase seede en setUpClass ; le seed persiste car
        # _fixture_teardown ne tronque pas (cf. ci-dessous).
        super().setUpClass()
        cls.user = TestDataFactory.create_superuser(username='ws-admin')
        cls.token = Token.objects.create(user=cls.user)

    def _fixture_teardown(self):
        # TransactionTestCase vide la base par TRUNCATE — or api_sessioncaisse
        # (table legacy) référence auth_user sans être dans la liste du flush
        # → NotSupportedError. La DB de test est détruite en fin de suite :
        # on conserve le seed partagé et on nettoie juste le cache des locks.
        pass

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    # ── Helpers ──

    def _comm(self, path, token=None):
        qs = f'?token={token}' if token else ''
        return WebsocketCommunicator(APPLICATION, f'/ws/{path}/{qs}')

    async def _ping_pong(self, comm):
        await comm.send_to(text_data=json.dumps({'type': 'ping'}))
        reply = await comm.receive_json_from(timeout=TIMEOUT)
        assert reply == {'type': 'pong'}, f'pong attendu, reçu {reply}'

    # ── 1. Connexion + ping sur les 5 endpoints ──

    async def test_all_endpoints_connect_and_ping(self):
        # Endpoints sans exigence d'auth (comportement actuel — voir NOTE)
        for path in ('cashier', 'pda', 'caisse_centralisee'):
            comm = self._comm(path)
            connected, _ = await comm.connect(timeout=TIMEOUT)
            assert connected, f'/ws/{path}/ a refusé la connexion'
            await self._ping_pong(comm)
            await comm.disconnect()

        # ws/stock : auth requise
        comm = self._comm('stock', token=self.token.key)
        connected, _ = await comm.connect(timeout=TIMEOUT)
        assert connected, '/ws/stock/ a refusé un utilisateur authentifié'
        await self._ping_pong(comm)
        await comm.disconnect()

        # ws/lock : auth requise, message initial = état du verrou
        comm = self._comm('lock/inventaire/1', token=self.token.key)
        connected, _ = await comm.connect(timeout=TIMEOUT)
        assert connected, '/ws/lock/ a refusé un utilisateur authentifié'
        initial = await comm.receive_json_from(timeout=TIMEOUT)
        assert initial['type'] in ('lock_released', 'lock_denied')
        await comm.disconnect()

    # ── 2. Rejets ──

    async def test_unauthenticated_and_invalid_token_rejected(self):
        # Sans token : stock et lock ferment avec 4001
        for path in ('stock', 'lock/commande/1'):
            comm = self._comm(path)
            connected, _ = await comm.connect(timeout=TIMEOUT)
            assert not connected, f'/ws/{path}/ a accepté un anonyme'

        # Token invalide → middleware coupe avant le consumer
        comm = self._comm('stock', token='token-inexistant')
        connected, _ = await comm.connect(timeout=TIMEOUT)
        assert not connected, 'ws/stock a accepté un token invalide'

    # ── 3. Relais PDA ↔ caisse ──

    async def test_pda_cashier_relay(self):
        pda = self._comm('pda')
        cashier = self._comm('cashier')
        await pda.connect(timeout=TIMEOUT)
        await cashier.connect(timeout=TIMEOUT)

        # PDA → caisse : nouvel article
        item = {'type': 'cashier_item_new', 'produit': 'Amoxicilline', 'qty': 2}
        await pda.send_to(text_data=json.dumps(item))
        received = await cashier.receive_json_from(timeout=TIMEOUT)
        assert received['produit'] == 'Amoxicilline'
        assert received['qty'] == 2

        # Caisse → PDA : changement de statut
        status_msg = {'type': 'cashier_item_status', 'item_id': 7, 'status': 'OK'}
        await cashier.send_to(text_data=json.dumps(status_msg))
        received = await pda.receive_json_from(timeout=TIMEOUT)
        assert received['item_id'] == 7

        await pda.disconnect()
        await cashier.disconnect()

    # ── 4. Broadcast caisse centralisée ──

    async def test_caisse_centralisee_facture_update(self):
        comm = self._comm('caisse_centralisee')
        await comm.connect(timeout=TIMEOUT)

        layer = get_channel_layer()
        await layer.group_send('caisse_centralisee', {
            'type': 'facture_update',
            'action': 'created',
            'facture_id': 42,
            'poste_caisse_id': 3,
        })
        msg = await comm.receive_json_from(timeout=TIMEOUT)
        assert msg == {
            'type': 'facture_update',
            'action': 'created',
            'facture_id': 42,
            'poste_caisse_id': 3,
        }
        await comm.disconnect()

    # ── 5. Broadcast stock ──

    async def test_stock_update_broadcast(self):
        comm = self._comm('stock', token=self.token.key)
        await comm.connect(timeout=TIMEOUT)

        layer = get_channel_layer()
        await layer.group_send('stock_updates', {
            'type': 'stock_update',
            'produits': [{'id': 1, 'stock': 95}],
        })
        msg = await comm.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'stock_update'
        assert msg['produits'] == [{'id': 1, 'stock': 95}]
        await comm.disconnect()

    # ── 6. Protocole de verrouillage document ──

    async def test_document_lock_protocol(self):
        from django.core.cache import cache
        await database_sync_to_async(cache.clear)()

        alice = self._comm('lock/inventaire/9', token=self.token.key)
        bob = self._comm('lock/inventaire/9', token=self.token.key)

        # Alice se connecte : aucun verrou → lock_released
        await alice.connect(timeout=TIMEOUT)
        msg = await alice.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'lock_released'

        # Alice acquiert le verrou
        await alice.send_to(text_data=json.dumps({'type': 'acquire'}))
        msg = await alice.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'lock_acquired'
        assert msg['holder'] == self.user.username
        assert msg['expires_in'] == 30

        # Bob se connecte : verrou tenu → lock_denied au handshake
        await bob.connect(timeout=TIMEOUT)
        msg = await bob.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'lock_denied'

        # Bob tente quand même → lock_denied explicite
        await bob.send_to(text_data=json.dumps({'type': 'acquire'}))
        msg = await bob.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'lock_denied'

        # Heartbeat d'Alice : ne doit rien casser
        await alice.send_to(text_data=json.dumps({'type': 'heartbeat'}))

        # Alice libère → Bob reçoit le broadcast lock_update
        await alice.send_to(text_data=json.dumps({'type': 'release'}))
        msg = await bob.receive_json_from(timeout=TIMEOUT)
        assert msg == {'type': 'lock_update', 'holder': None}

        # Bob peut maintenant acquérir
        await bob.send_to(text_data=json.dumps({'type': 'acquire'}))
        msg = await bob.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'lock_acquired'

        await alice.disconnect()
        await bob.disconnect()

    # ── 7. Entrées malformées ──

    async def test_malformed_input_never_crashes(self):
        # JSON cassé sur cashier → réponse 'error' explicite
        comm = self._comm('cashier')
        await comm.connect(timeout=TIMEOUT)
        await comm.send_to(text_data='{pas du json')
        msg = await comm.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] == 'error'

        # Type inconnu + JSON cassé : connexion survit. CashierConsumer
        # renvoie 'error' par JSON invalide → vider la file jusqu'au pong.
        await comm.send_to(text_data=json.dumps({'type': 'nimporte_quoi', 'x': 1}))
        await comm.send_to(text_data='{{{{')
        await comm.send_to(text_data=json.dumps({'type': 'ping'}))
        received = [await comm.receive_json_from(timeout=TIMEOUT) for _ in range(2)]
        assert {'type': 'pong'} in received, f'pong absent de {received}'
        await comm.disconnect()

        # Idem sur le consumer verrou authentifié
        comm = self._comm('lock/inventaire/2', token=self.token.key)
        await comm.connect(timeout=TIMEOUT)
        await comm.receive_json_from(timeout=TIMEOUT)  # message initial
        for garbage in ('{', '[1,2', 'not json', json.dumps({'type': '???'})):
            await comm.send_to(text_data=garbage)
        # L'acquittement prouve que la connexion est vivante
        await comm.send_to(text_data=json.dumps({'type': 'acquire'}))
        msg = await comm.receive_json_from(timeout=TIMEOUT)
        assert msg['type'] in ('lock_acquired', 'lock_denied')
        await comm.disconnect()
