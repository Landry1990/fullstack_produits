"""
Tests du LicenceMiddleware — le vigile licence de l'API.

Le middleware se désactive normalement sous `manage.py test` / pytest
(`'test' in sys.argv`). Le setting DISABLE_LICENCE_MIDDLEWARE permet de
forcer son activation dans ces tests (override_settings(...=False)).

Mécanique simulée ici (cf. api/middleware_licence.py + api/utils_licence.py) :

- Licence valide → on sème le cache `system_licence_validation` avec un dict
  `{'est_valide': True, 'message': ..., 'payload': ..., '_sig': <hmac>}` signé
  via `_sign_cache_value` — le middleware prend alors le chemin "vérification
  rapide" sans toucher la DB ni la table Licence.
- Licence invalide → même mécanique avec `est_valide: False` → 403 +
  `code_erreur: LICENCE_INVALIDE`.
- Licence corrompue → cache vide + ligne Licence avec une clé JWT illisible :
  `valider_licence_systeme()` échoue au jwt.decode → `est_valide` False → 403.
  (NB : aucune licence en base ≠ 403 — c'est la période d'essai, cf.
  `_get_or_create_trial`, qui autorise. On évite ce chemin en test car il
  écrit un fichier trial_start.txt.)

CACHES est forcé en LocMemCache : sans REDIS_URL le cache par défaut est
DummyCache (get() → None permanent), ce qui rendrait le test dépendant de
l'environnement.
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.middleware_licence import LICENCE_CACHE_KEY, LICENCE_CACHE_TTL
from api.models.licence import Licence
from api.utils_licence import _sign_cache_value

from .factories import TestDataFactory

LOCMEM_CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
}


def _signed_cache_value(est_valide, message, payload=None):
    """Construit une entrée de cache licence signée HMAC, comme le fait
    le middleware après une validation DB réussie."""
    cached = {
        'est_valide': est_valide,
        'message': message,
        'payload': payload,
    }
    cached['_sig'] = _sign_cache_value(cached)
    return cached


@override_settings(DISABLE_LICENCE_MIDDLEWARE=False, CACHES=LOCMEM_CACHES)
class LicenceMiddlewareTests(APITestCase):
    """Le vigile licence, forcé actif, laisse passer les licences valides
    et bloque le reste de l'API sinon."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        cache.delete(LICENCE_CACHE_KEY)

    def tearDown(self):
        cache.delete(LICENCE_CACHE_KEY)

    def _seed_valid_licence_cache(self):
        cache.set(
            LICENCE_CACHE_KEY,
            _signed_cache_value(
                est_valide=True,
                message='Licence valide.',
                payload={
                    'pharmacie_nom': 'PHARMACIE TEST',
                    'plan': 'PRO',
                    'hardware_id': 'ANY',
                },
            ),
            timeout=LICENCE_CACHE_TTL,
        )

    def _seed_invalid_licence_cache(self, message='Licence expirée.'):
        cache.set(
            LICENCE_CACHE_KEY,
            _signed_cache_value(est_valide=False, message=message),
            timeout=LICENCE_CACHE_TTL,
        )

    # ── Licence valide ──────────────────────────────────────────────────

    def test_valid_licence_allows_api_request(self):
        """Client authentifié + licence valide (cache signé) → 200 sur /api/."""
        self._seed_valid_licence_cache()

        response = self.client.get(reverse('produit-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # ── Licence invalide / absente ──────────────────────────────────────

    def test_invalid_licence_returns_403_licence_invalide(self):
        """Licence expirée (cache signé est_valide=False) → 403 LICENCE_INVALIDE."""
        self._seed_invalid_licence_cache('Licence expirée.')

        response = self.client.get(reverse('produit-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['code_erreur'], 'LICENCE_INVALIDE')
        self.assertEqual(response.json()['detail'], 'Licence expirée.')

    def test_corrupt_licence_in_db_returns_403(self):
        """Cache vide + licence illisible en base → validation DB échoue → 403.

        Couvre le chemin "vérification complète" du middleware
        (valider_licence_systeme → jwt.decode lève → est_valide False).
        """
        Licence.objects.create(cle='ceci-n-est-pas-un-jwt-valide')

        response = self.client.get(reverse('produit-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['code_erreur'], 'LICENCE_INVALIDE')

    def test_tampered_cache_signature_is_rejected(self):
        """Un cache 'valide' sans signature HMAC n'est pas honoré :
        impossible de forger une licence valide en écrivant dans Redis."""
        # Cache empoisonné : est_valide=True mais pas de '_sig' valide.
        cache.set(
            LICENCE_CACHE_KEY,
            {'est_valide': True, 'message': 'forgé', 'payload': None, '_sig': 'faux'},
            timeout=LICENCE_CACHE_TTL,
        )
        # ...et la vraie licence en base est corrompue : si le cache forgé
        # était accepté on aurait 200 ; la revalidation DB doit donner 403.
        Licence.objects.create(cle='ceci-n-est-pas-un-jwt-valide')

        response = self.client.get(reverse('produit-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['code_erreur'], 'LICENCE_INVALIDE')

    # ── Chemins exclus / kill switch ────────────────────────────────────

    def test_whitelisted_path_bypasses_licence_check(self):
        """Les chemins exclus (health, licence, login, admin) restent
        accessibles même sans licence valide — sinon impossible de soumettre
        une nouvelle clé ni de monitorer le service."""
        self._seed_invalid_licence_cache()

        response = self.client.get(reverse('health-check'))

        # 200 attendu ; on tolère 503 (check disque/RAM de l'env) — jamais 403.
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(DISABLE_LICENCE_MIDDLEWARE=True)
    def test_disable_setting_bypasses_middleware(self):
        """DISABLE_LICENCE_MIDDLEWARE=True court-circuite le vigile
        (comportement historique en mode test), même avec licence invalide."""
        self._seed_invalid_licence_cache()

        response = self.client.get(reverse('produit-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
