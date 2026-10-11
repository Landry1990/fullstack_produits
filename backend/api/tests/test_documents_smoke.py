"""
Smoke test des endpoints de génération de documents (PDF, Excel, CSV, print-data).

Contrairement au smoke test générique (`test_routes_smoke.py`), celui-ci fournit
des données de test valides et les paramètres requis, puis valide le contenu
généré — pas seulement le code HTTP :

- PDF   : la réponse commence par "%PDF" et n'est pas vide
- XLSX  : archive ZIP valide ouvrable par openpyxl
- CSV   : corps décodable et non vide
- JSON  : endpoints "print-data"/"relevé" → JSON valide

Les erreurs de validation attendues (paramètre manquant, 400) sont vérifiées
dans un test séparé : elles doivent renvoyer 400/404, jamais 5xx.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_documents_smoke -v 2 --noinput
"""
import gzip
import json
import zipfile
from io import BytesIO

import openpyxl
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Avoir, Inventaire, Promis, TelegramLog

from .factories import TestDataFactory


def _date_debut(_s=None):
    return (timezone.localdate() - timezone.timedelta(days=400)).isoformat()


def _date_fin(_s=None):
    return timezone.localdate().isoformat()


def _mois(_s=None):
    return timezone.localdate().strftime('%Y-%m')

XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def _body(response):
    """Contenu décodé : GZipMiddleware compresse les grosses réponses."""
    content = response.content
    if response.get('Content-Encoding') == 'gzip' or content[:2] == b'\x1f\x8b':
        content = gzip.decompress(content)
    return content


def _pdf(content):
    assert content[:4] == b'%PDF', 'signature PDF absente'
    assert len(content) > 500, 'PDF suspicieusement petit'


def _xlsx(content):
    assert content[:4] == b'PK\x03\x04', 'signature ZIP/XLSX absente'
    wb = openpyxl.load_workbook(BytesIO(content))
    assert wb.sheetnames, 'classeur sans feuille'


def _csv(content):
    text = content.decode('utf-8-sig')
    assert text.strip(), 'CSV vide'


def _txt(content):
    assert content.strip(), 'fichier texte vide'


def _json(content):
    json.loads(content)


def _zip(content):
    assert zipfile.is_zipfile(BytesIO(content)), 'pas une archive ZIP'


# ─────────────────────────────────────────────────────────────────────────────
# Table des endpoints GET de génération de documents.
#
# Chaque entrée : nom de route →
#   kwargs   : fonction(self) → dict pour reverse()
#   params   : query string requis (valeur callable → évaluée au runtime)
#   expect   : validateur du corps ('pdf' | 'xlsx' | 'csv' | 'txt' | 'json' | 'any')
# ─────────────────────────────────────────────────────────────────────────────
GET_DOCUMENT_ROUTES = {
    # ── PDF ──
    'etat-inventaire-pdf': {
        'params': {'group_by': 'RAYON'},
        'expect': 'pdf',
    },
    'facture-imprimer-facture': {
        'kwargs': lambda s: {'pk': s.facture.pk},
        'expect': 'pdf',
    },
    'promis-imprimer-ticket': {
        'kwargs': lambda s: {'pk': s.promis.pk},
        'expect': 'pdf',
    },
    'creance-imprimer-recu': {
        'kwargs': lambda s: {'pk': s.creance.pk},
        'expect': 'pdf',
    },
    'inventaire-imprimer-etat': {
        'kwargs': lambda s: {'pk': s.inventaire.pk},
        'expect': 'pdf',
    },
    'inventaire-imprimer-ecarts': {
        'kwargs': lambda s: {'pk': s.inventaire.pk},
        'expect': 'pdf',
    },
    'rayon-imprimer-etat-stock': {
        'kwargs': lambda s: {'pk': s.produit.rayon.pk},
        'expect': 'pdf',
    },
    'rayon-imprimer-sans-rayon': {'expect': 'pdf'},
    'categorie-imprimer-etat-stock': {
        'kwargs': lambda s: {'pk': s.produit.rayon.pk},
        'expect': 'pdf',
    },
    'categorie-imprimer-sans-rayon': {'expect': 'pdf'},
    'ordonnancier-export-pdf': {'expect': 'pdf'},
    'rapports-valeur-stock-pdf': {'expect': 'pdf'},
    'rapports-rapport-mensuel-pdf': {
        'params': {'mois': _mois},
        'expect': 'pdf',
    },
    'rapports-rapport-par-dates-pdf': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'pdf',
    },

    # ── Excel (.xlsx) ──
    'maintenance-export-produits': {'expect': 'xlsx'},
    'inventaire-listing-excel': {'expect': 'xlsx'},
    'creance-export-excel': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'xlsx',
    },
    'avoirclient-exporter-excel': {'expect': 'xlsx'},
    'stockadjustment-export-excel': {'expect': 'xlsx'},
    'historiqueventes-exporter-excel': {'expect': 'xlsx'},
    'rapports-balance-stock-excel': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'xlsx',
    },
    'rapports-livre-caisse-excel': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'xlsx',
    },
    'rapports-rapport-general-excel': {
        'params': {'mois': _mois},
        'expect': 'xlsx',
    },
    'rapports-rapport-remises-excel': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'xlsx',
    },
    'rapports-rapport-remises-details-excel': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'xlsx',
    },

    # ── CSV / texte ──
    'produit-export-csv': {'expect': 'csv'},
    'audit-log-export-csv': {'expect': 'csv'},
    'telegramlog-export-csv': {'expect': 'csv'},
    'rupture-fournisseur-export-frequence-csv': {'expect': 'csv'},
    'rapports-export-comptable-csv': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'csv',
    },
    'rapports-export-sage-i7': {
        'params': {'date_debut': _date_debut, 'date_fin': _date_fin},
        'expect': 'csv',
    },
    'commande-export': {
        'kwargs': lambda s: {'commande_id': s.commande.pk},
        'expect': 'csv',
    },

    # ── JSON structuré (print-data, relevés, previews) ──
    'facture-print-data': {
        'kwargs': lambda s: {'pk': s.facture.pk},
        'expect': 'json',
    },
    'inventaire-print-data': {
        'kwargs': lambda s: {'pk': s.inventaire.pk},
        'expect': 'json',
    },
    'avoir-print-data': {
        'kwargs': lambda s: {'pk': s.avoir.pk},
        'expect': 'json',
    },
    'commande-export-preview': {
        'kwargs': lambda s: {'commande_id': s.commande.pk},
        'expect': 'json',
    },
    'creance-releve': {
        'params': {'client_id': lambda s: str(s.customer.pk)},
        'expect': 'json',
    },
    'fournisseur-releve-factures': {
        'kwargs': lambda s: {'pk': s.fournisseur.pk},
        'expect': 'json',
    },
}

# Endpoints POST qui génèrent un document (payload isolé, sans effet de bord)
POST_DOCUMENT_ROUTES = {
    'produit-generate-labels': {
        'payload': lambda s: {'products': [{'id': s.produit.pk, 'quantity': 1}]},
        'expect': 'pdf',
    },
    'promis-imprimer-ticket-groupe': {
        'payload': lambda s: {'ids': [s.promis.pk]},
        'expect': 'pdf',
    },
}

# Endpoints qui requièrent un paramètre : sans lui → 400/404 attendu, jamais 5xx.
GET_DOCUMENT_ROUTES_MISSING_PARAMS = {
    'etat-inventaire-pdf': {},
    'rapports-rapport-mensuel-pdf': {},
    'rapports-rapport-par-dates-pdf': {},
    'rapports-export-comptable-csv': {},
    'rapports-export-sage-i7': {},
    'rapports-balance-stock-excel': {},
    'rapports-livre-caisse-excel': {},
    'rapports-rapport-remises-excel': {},
    'rapports-rapport-remises-details-excel': {},
    'creance-releve': {},
    'maintenance-download-rapport': {},
    'commande-export': {'kwargs': lambda s: {'commande_id': 999999}},
}

VALIDATORS = {
    'pdf': _pdf,
    'xlsx': _xlsx,
    'csv': _csv,
    'txt': _txt,
    'json': _json,
    'zip': _zip,
    'any': lambda c: bool(c.strip()),
}


class DocumentRoutesSmokeTest(APITestCase):
    """Chaque endpoint document doit renvoyer un fichier valide, pas un 500."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = TestDataFactory.create_superuser(username='doc-admin')

        cls.produit = TestDataFactory.create_produit(selling_price=1000)
        cls.fournisseur = cls.produit.fournisseur
        # NOTE : `self.client` est réservé par DRF (APIClient) — d'où `customer`.
        cls.customer = TestDataFactory.create_client()

        cls.facture = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=1000
        )
        TestDataFactory.create_facture_produit(cls.facture, cls.produit)

        # Créance : facture validée avec reste à payer (releve/imprimer_recu).
        # remainder = total_ttc - paiements non-en_compte doit rester > 0
        # pour que le queryset CreanceViewSet inclue la facture.
        cls.creance = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=1000
        )
        TestDataFactory.create_facture_produit(
            cls.creance, cls.produit, selling_price=1000
        )
        TestDataFactory.create_caisse(cls.creance, montant=400, user=cls.admin)

        cls.commande = TestDataFactory.create_commande(fournisseur=cls.fournisseur)
        TestDataFactory.create_commande_produit(cls.commande, cls.produit)

        cls.inventaire = Inventaire.objects.create(
            reference='INV-DOC-TEST', created_by=cls.admin
        )
        cls.avoir = Avoir.objects.create(
            fournisseur=cls.fournisseur, created_by=cls.admin
        )
        cls.promis = Promis.objects.create(
            client=cls.customer, produit=cls.produit,
            quantite=5, created_by=cls.admin,
        )
        TelegramLog.objects.create(
            recipient_chat_id='12345', recipient_name='Smoke Test',
            message='smoke test',
            type=TelegramLog.Type.MANUEL, status=TelegramLog.Status.SENT,
        )

    def setUp(self):
        cache.clear()
        self.client.raise_request_exception = False
        self.client.force_authenticate(user=self.admin)

    def tearDown(self):
        cache.clear()

    # ── Helpers ──

    def _resolve(self, name, spec):
        kwargs = spec.get('kwargs')
        try:
            return reverse(name, kwargs=kwargs(self) if kwargs else None)
        except Exception as exc:
            self.fail(f'{name}: reverse() impossible — {exc}')

    def _params(self, spec):
        params = spec.get('params') or {}
        resolved = {}
        for key, value in params.items():
            resolved[key] = value(self) if callable(value) else value
        return resolved

    def _fetch(self, name, spec):
        url = self._resolve(name, spec)
        return self.client.get(url, self._params(spec))

    # ── Tests ──

    def test_get_document_endpoints(self):
        """GET authentifié + params valides → 200 et document valide."""
        results = {'OK': [], 'FAIL': []}
        for name, spec in sorted(GET_DOCUMENT_ROUTES.items()):
            label = name
            try:
                response = self._fetch(name, spec)
            except Exception as exc:
                results['FAIL'].append((label, f'exception {type(exc).__name__}: {exc}'))
                continue

            if response.status_code != status.HTTP_200_OK:
                body = getattr(response, 'content', b'')[:200]
                results['FAIL'].append(
                    (label, f'HTTP {response.status_code} — {body!r}')
                )
                continue

            validator = VALIDATORS[spec['expect']]
            try:
                validator(_body(response))
            except AssertionError as exc:
                first = _body(response)[:40]
                results['FAIL'].append(
                    (label, f'contenu invalide [{spec["expect"]}]: {exc} '
                            f'(début: {first!r})')
                )
            except Exception as exc:
                results['FAIL'].append(
                    (label, f'validateur {type(exc).__name__}: {exc}')
                )
            else:
                results['OK'].append((label, spec['expect']))

        self._print_report('DOCUMENTS GET', results)
        self.assertFalse(
            results['FAIL'],
            '\n' + '\n'.join(f'  {n:50} {d}' for n, d in results['FAIL']),
        )

    def test_post_document_endpoints(self):
        """POST avec payload valide → 200 et document valide."""
        results = {'OK': [], 'FAIL': []}
        for name, spec in sorted(POST_DOCUMENT_ROUTES.items()):
            url = self._resolve(name, spec)
            try:
                response = self.client.post(
                    url, spec['payload'](self), format='json'
                )
            except Exception as exc:
                results['FAIL'].append((name, f'exception {type(exc).__name__}: {exc}'))
                continue

            if response.status_code != status.HTTP_200_OK:
                results['FAIL'].append(
                    (name, f'HTTP {response.status_code} — {response.content[:200]!r}')
                )
                continue
            try:
                VALIDATORS[spec['expect']](_body(response))
                results['OK'].append((name, spec['expect']))
            except Exception as exc:  # noqa: BLE001
                results['FAIL'].append((name, f'contenu invalide: {exc}'))

        self._print_report('DOCUMENTS POST', results)
        self.assertFalse(
            results['FAIL'],
            '\n' + '\n'.join(f'  {n:50} {d}' for n, d in results['FAIL']),
        )

    def test_missing_required_params_fail_gracefully(self):
        """Paramètres requis absents → 400/404 explicite, jamais 5xx."""
        failures = []
        for name, spec in sorted(GET_DOCUMENT_ROUTES_MISSING_PARAMS.items()):
            try:
                response = self._fetch(name, spec)
            except Exception as exc:
                failures.append((name, f'exception {type(exc).__name__}: {exc}'))
                continue
            code = response.status_code
            if code >= 500:
                failures.append(
                    (name, f'HTTP {code} — {response.content[:200]!r}')
                )
            elif code < 400:
                failures.append((name, f'HTTP {code} inattendu sans paramètre'))

        if failures:
            self.fail(
                'Paramètres manquants → comportement incorrect :\n'
                + '\n'.join(f'  {n:50} {d}' for n, d in failures)
            )

    def test_document_routes_require_auth(self):
        """Les endpoints de documents ne doivent pas être publics."""
        self.client.force_authenticate(user=None)
        public = []
        for name, spec in sorted(GET_DOCUMENT_ROUTES.items()):
            try:
                response = self._fetch(name, spec)
            except Exception:
                continue
            if response.status_code < 400:
                public.append(name)
        self.assertFalse(
            public, f'Endpoints documents accessibles sans auth : {public}'
        )

    # ── Rapport ──

    def _print_report(self, title, results):
        print(f'\n{"=" * 60}\nSMOKE TEST {title} — rapport\n{"=" * 60}')
        print(f'\n[OK] {len(results["OK"])} endpoint(s)')
        for name, kind in results['OK']:
            print(f'  {name:50} {kind}')
        if results['FAIL']:
            print(f'\n[FAIL] {len(results["FAIL"])} endpoint(s)')
            for name, detail in results['FAIL']:
                print(f'  {name:50} {detail}')
