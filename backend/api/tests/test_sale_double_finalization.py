"""
Tests de double finalisation d'une même vente
(POST /api/factures/finaliser/).

Deux protections distinctes sont vérifiées :

- ``existing_id`` (rappel d'un devis/proforma) : le verrou
  ``select_for_update`` de ``_update_existing_facture`` + la garde de statut
  (seuls BROUILLON/PROFORMA sont re-finalisables) garantissent qu'une 2ᵉ
  tentative — concurrente ou séquentielle — renvoie 400 sans créer de
  facture ni re-décrémenter le stock. Le verrou ajouté en tête de
  ``SaleValidator.validate_invoice`` rend le repli propre même si le statut
  change sous le nez de la 2ᵉ transaction.
- ``Idempotency-Key`` (double-clic / retry réseau) : le décorateur
  ``@idempotent_action`` rejoue la réponse en cache pour la 2ᵉ requête
  portant la même clé — une seule facture, un seul décrément.

CACHES est forcé en LocMemCache : sans REDIS_URL le cache par défaut est
DummyCache (add() → True sans persistance), ce qui désactiverait la
déduplication d'idempotence et rendrait le test dépendant de l'env.
"""
import threading
from decimal import Decimal

from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from ..models import Facture, FactureProduit, MouvementStock
from .factories import TestDataFactory

LOCMEM_CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
}


class _DoubleFinalizationBase:
    """Setup + payload commun aux versions séquentielle et concurrente."""

    QUANTITY = 3
    INITIAL_STOCK = 50

    def _setUp(self):
        # La numérotation FAC exige la ligne DocumentCounter (seedée par la
        # migration 0271 sur une vraie base ; en test, le flush custom peut
        # l'avoir vidée) — le test ne dépend pas de données de migration.
        from ..models import DocumentCounter
        DocumentCounter.objects.get_or_create(name='FAC', defaults={'value': 0})
        DocumentCounter.objects.get_or_create(name='DEV', defaults={'value': 0})

        self.user = TestDataFactory.create_superuser()
        self.produit = TestDataFactory.create_produit(
            name='Produit Double Finalisation',
            stock=self.INITIAL_STOCK,
            cost_price=200,
            selling_price=500,
        )
        self.client_obj = TestDataFactory.create_client(name='Client DoubleFin')
        # Session de caisse requise en mode centralisé
        self.session = TestDataFactory.create_session_caisse(user=self.user)

    def _create_proforma(self):
        """Crée le devis que la vente va convertir (statut PROFORMA)."""
        facture = Facture.objects.create(
            status=Facture.Status.PROFORMA,
            client=self.client_obj,
        )
        FactureProduit.objects.create(
            facture=facture,
            produit=self.produit,
            quantity=self.QUANTITY,
            selling_price=Decimal('500'),
            discount=Decimal('0'),
            tva=Decimal('0'),
        )
        return facture

    def _payload(self, **overrides):
        """Payload au format frontend (cf. test_facturation_contract.py)."""
        payload = {
            'client': self.client_obj.id,
            'client_name_override': None,
            'ayant_droit': None,
            'remise': '0',
            'produits': [{
                'produit': self.produit.id,
                'quantity': self.QUANTITY,
                'selling_price': '500',
                'discount': '0',
                'tva': 0,
                'lot_id': None,
                'lot_allocations': None,
                'is_promis': False,
                'promis_quantity': 0,
                'promis_phone': '',
            }],
            'paiements': [{'mode': 'especes', 'montant': 1500}],
            'loyalty': {'use_pending_discount': False, 'points_to_use': 0},
            'ordonnance': None,
            'totals': {'totalTtc': 1500, 'totalHt': 1500, 'totalTva': 0},
            'sudo': {'validated_by_id': None, 'sudo_password': None},
            'type': 'STD',
            'centralized_cash_register': True,
            'poste_vente_id': None,
            'coupon_numero': None,
            'existing_id': None,
            'is_avoir_client': False,
            'montant_verse': '1500',
            'montant_rendu': '0',
        }
        payload.update(overrides)
        return payload

    def _assert_single_finalization(self, facture):
        """Invariant : une seule facture validée, stock décrémenté une fois."""
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.VALIDEE)
        self.assertTrue(facture.numero_facture.startswith('FAC-'))
        self.assertEqual(Facture.objects.count(), 1)

        self.produit.refresh_from_db()
        self.assertEqual(
            self.produit.stock,
            self.INITIAL_STOCK - self.QUANTITY,
            'Le stock doit être décrémenté une seule fois.',
        )

        total_mouvements = sum(
            MouvementStock.objects
            .filter(facture=facture)
            .values_list('quantite', flat=True)
        )
        self.assertEqual(total_mouvements, -self.QUANTITY)


@override_settings(CACHES=LOCMEM_CACHES)
class DoubleFinalizationSequentialTests(_DoubleFinalizationBase, APITestCase):
    """Version séquentielle — déterministe, vérifie l'idempotence."""

    def setUp(self):
        self._setUp()
        self.client.force_authenticate(user=self.user)

    def test_double_finaliser_same_proforma_creates_one_facture(self):
        """Rappel du même devis deux fois de suite : le 2ᵉ appel voit le
        statut VALIDEE (garde de statut) → 400, aucune double décrémentation."""
        proforma = self._create_proforma()
        url = reverse('facture-finaliser')
        payload = self._payload(existing_id=proforma.id)

        response1 = self.client.post(url, payload, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        response2 = self.client.post(url, payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)

        self._assert_single_finalization(proforma)

    def test_double_submit_same_idempotency_key_replays_response(self):
        """Même payload + même Idempotency-Key (double-clic) : la 2ᵉ requête
        rejoue la réponse cachée — une seule facture, un seul décrément."""
        url = reverse('facture-finaliser')
        payload = self._payload()
        headers = {'HTTP_IDEMPOTENCY_KEY': 'double-fin-seq-0001'}

        response1 = self.client.post(url, payload, format='json', **headers)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        facture_id = response1.json()['id']

        response2 = self.client.post(url, payload, format='json', **headers)
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.json()['id'], facture_id)

        self.assertEqual(
            Facture.objects.filter(status=Facture.Status.VALIDEE).count(), 1
        )
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, self.INITIAL_STOCK - self.QUANTITY)

    def test_same_idempotency_key_with_different_payload_is_rejected(self):
        url = reverse('facture-finaliser')
        headers = {'HTTP_IDEMPOTENCY_KEY': 'payload-conflict-0001'}

        response1 = self.client.post(url, self._payload(), format='json', **headers)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        changed_payload = self._payload(montant_verse='2000')
        response2 = self.client.post(url, changed_payload, format='json', **headers)

        self.assertEqual(response2.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('contenu différent', response2.json()['detail'])
        self.assertEqual(Facture.objects.count(), 1)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, self.INITIAL_STOCK - self.QUANTITY)


@override_settings(CACHES=LOCMEM_CACHES)
class DoubleFinalizationConcurrentTests(_DoubleFinalizationBase, TransactionTestCase):
    """Version concurrente — 2 threads sur la même vente.

    TransactionTestCase (et non TestCase) : chaque thread a sa propre
    connexion DB et doit voir les données commitées — une transaction
    enveloppante les rendrait invisibles (ou bloquerait le select_for_update).
    """

    def setUp(self):
        self._setUp()

    def _fixture_teardown(self):
        # api_sessioncaisse est unmanaged (managed=False) : absente du flush
        # standard, mais sa FK vers auth_user fait échouer TRUNCATE auth_user
        # sur Postgres ("cannot truncate a table referenced in a foreign key
        # constraint"). On refait le flush en incluant la table unmanaged,
        # puis on réémet post_migrate (contenttypes/permissions) comme le
        # flush standard.
        from django.core.management.sql import emit_post_migrate_signal
        from django.db import connection

        tables = set(connection.introspection.django_table_names(only_existing=True))
        tables.add('api_sessioncaisse')
        with connection.cursor() as cursor:
            cursor.execute(
                'TRUNCATE {} CASCADE'.format(
                    ', '.join(connection.ops.quote_name(t) for t in sorted(tables))
                )
            )
        emit_post_migrate_signal(verbosity=0, interactive=False, db='default')

    def _post_in_thread(self, payload, barrier, results, index):
        """Worker : POST finaliser depuis un client/thread dédié."""
        from django.db import connections
        idem_key = payload.pop('_idem_key', None)
        extra = {'HTTP_IDEMPOTENCY_KEY': idem_key} if idem_key else {}
        client = APIClient()
        client.force_authenticate(user=self.user)
        try:
            barrier.wait()
            results[index] = client.post(
                reverse('facture-finaliser'), payload, format='json', **extra,
            )
        except Exception as exc:  # pragma: no cover - diagnostic
            results[index] = exc
        finally:
            connections.close_all()

    def test_concurrent_double_finaliser_same_proforma(self):
        """Deux requêtes quasi-simultanées sur le même devis : exactement
        une réussit (201), l'autre échoue proprement (400) — pas de 500,
        pas de 2ᵉ facture, stock décrémenté une seule fois."""
        proforma = self._create_proforma()
        payload = self._payload(existing_id=proforma.id)

        barrier = threading.Barrier(2)
        results = [None, None]
        threads = [
            threading.Thread(
                target=self._post_in_thread,
                args=(dict(payload), barrier, results, i),
            )
            for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)

        self.assertFalse(
            any(r is None for r in results),
            'Un thread n a pas terminé dans le délai imparti.',
        )
        for r in results:
            self.assertFalse(
                isinstance(r, Exception),
                f'Exception inattendue dans un thread : {r!r}',
            )

        statuses = sorted(r.status_code for r in results)
        self.assertEqual(
            statuses,
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
            'Une seule finalisation doit réussir ; la perdante doit voir '
            'le statut VALIDEE après le verrou select_for_update.',
        )
        self._assert_single_finalization(proforma)

    def test_concurrent_double_submit_same_idempotency_key(self):
        """Deux requêtes concurrentes avec la même Idempotency-Key : le
        sentinel `in-progress` (cache.add atomique) fait attendre la perdante
        qui rejoue le résultat (201) — ou est rejetée proprement (409).
        Invariant dans les deux cas : une seule facture, un seul décrément."""
        idem_key = 'double-fin-conc-0001'
        payload = self._payload(_idem_key=idem_key)
        payload2 = self._payload(_idem_key=idem_key)  # même clé, 2ᵉ thread

        barrier = threading.Barrier(2)
        results = [None, None]
        threads = [
            threading.Thread(
                target=self._post_in_thread,
                args=(payload, barrier, results, 0),
            ),
            threading.Thread(
                target=self._post_in_thread,
                args=(payload2, barrier, results, 1),
            ),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)

        self.assertFalse(any(r is None for r in results))
        for r in results:
            self.assertFalse(isinstance(r, Exception), f'Exception : {r!r}')

        statuses = sorted(r.status_code for r in results)
        # La perdante rejoue la réponse cachée (201) OU est proprement rejetée
        # (409 « requête identique en cours » si le sentinel a expiré avant
        # elle). Dans les deux cas l'invariant métier tient : une seule écriture.
        self.assertIn(
            statuses,
            [
                [status.HTTP_201_CREATED, status.HTTP_201_CREATED],
                [status.HTTP_201_CREATED, status.HTTP_409_CONFLICT],
            ],
            f'Statuts inattendus : {statuses}',
        )
        if statuses == [status.HTTP_201_CREATED, status.HTTP_201_CREATED]:
            facture_ids = {r.json()['id'] for r in results}
            self.assertEqual(len(facture_ids), 1, 'Une seule facture créée.')

        self.assertEqual(
            Facture.objects.filter(status=Facture.Status.VALIDEE).count(), 1
        )
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, self.INITIAL_STOCK - self.QUANTITY)
