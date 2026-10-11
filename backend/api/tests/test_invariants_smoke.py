"""
Smoke test des invariants métier : la corruption silencieuse de stock.

`produit.stock` est un compteur dénormalisé censé toujours égaler
Σ lots.quantity_remaining − obligations RAYON (et stock_reserve = Σ reserved
− obligations RESERVE). Or la synchro repose sur un signal post_save que les
`bulk_update`/`F('stock')` contournent — chaque chemin de code qui oublie sa
compensation crée une dérive invisible : stock affiché ≠ stock réel.

Après chaque flux critique (vente, annulation, ajustement, réception,
livraison promis, sortie périmés), ce test revérifie l'invariant complet :

    produit.stock         == Σ lots.quantity_remaining − obligations RAYON
    produit.stock_reserve == Σ lots.quantity_reserved  − obligations RESERVE
    aucun champ de lot négatif
    Σ allocations facture == quantité vendue

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_invariants_smoke -v 2 --noinput
"""
from django.core.cache import cache
from django.db.models import Sum
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    FactureProduitAllocation,
    Produit,
    Promis,
    StockAdjustment,
    StockLot,
)

from .factories import TestDataFactory


class InvariantsSmokeTest(APITestCase):
    """Après chaque mutation métier, les compteurs de stock ne dérivent pas."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = TestDataFactory.create_superuser(username='inv-admin')
        cls.customer = TestDataFactory.create_client()
        cls.poste_caisse = TestDataFactory.create_poste_caisse()
        cls.session = TestDataFactory.create_session_caisse(
            user=cls.admin, poste=cls.poste_caisse
        )

        # Un produit isolé par flux : stock physique 100 % couvert par un lot
        # → l'invariant stock == Σlots doit tenir dès le seed.
        cls.produit_vente = cls._seed_produit(stock=100)
        cls.produit_annul = cls._seed_produit(stock=100)
        cls.produit_ajust = cls._seed_produit(stock=50)
        cls.produit_recep = cls._seed_produit(stock=10)
        cls.produit_promis = cls._seed_produit(stock=20)
        cls.produit_perime = cls._seed_produit(
            stock=30,
            expiration=timezone.now().date() - timezone.timedelta(days=10),
        )

    @staticmethod
    def _seed_produit(stock, expiration=None):
        produit = TestDataFactory.create_produit(stock=stock)
        kwargs = {}
        if expiration is not None:
            kwargs['date_expiration'] = expiration
        TestDataFactory.create_stock_lot(produit, quantity=stock, **kwargs)
        return produit

    def setUp(self):
        cache.clear()
        self.client.raise_request_exception = False
        self.client.force_authenticate(user=self.admin)

    def tearDown(self):
        cache.clear()

    # ── Invariant central ──

    def _assert_stock_synced(self, produit, context=''):
        """produit.stock/stock_reserve == recalcul depuis les lots (même
        formule que Produit.calculate_stock_from_lots, sans muter)."""
        produit.refresh_from_db()
        agg = produit.stock_lots.aggregate(
            rem=Sum('quantity_remaining'), res=Sum('quantity_reserved')
        )
        obligations = produit.stock_obligations.filter(
            status='ATT', stock_applied=True
        ).values('stock_location').annotate(total=Sum('quantity_remaining'))
        ob_map = {o['stock_location']: o['total'] or 0 for o in obligations}

        expected_stock = (agg['rem'] or 0) - ob_map.get('RAYON', 0)
        expected_reserve = (agg['res'] or 0) - ob_map.get('RESERVE', 0)

        self.assertEqual(
            produit.stock, expected_stock,
            f'[{context}] stock dénormalisé={produit.stock} mais '
            f'Σlots−obligations={expected_stock} — dérive détectée',
        )
        self.assertEqual(
            produit.stock_reserve, expected_reserve,
            f'[{context}] stock_reserve={produit.stock_reserve} mais '
            f'Σreserved−obligations={expected_reserve}',
        )
        return expected_stock

    def _assert_no_negative_lot(self, produit, context=''):
        for lot in produit.stock_lots.all():
            self.assertGreaterEqual(
                lot.quantity_remaining, 0, f'[{context}] lot {lot.id} négatif'
            )
            self.assertGreaterEqual(
                lot.quantity_reserved, 0, f'[{context}] lot {lot.id} réserve<0'
            )

    # ── 1. Vente ──

    def test_facture_valider_keeps_stock_synced(self):
        produit = self.produit_vente
        facture = TestDataFactory.create_facture(
            client=self.customer, status='BROU', total_ttc=300
        )
        ligne = TestDataFactory.create_facture_produit(
            facture, produit, quantity=3, selling_price=100
        )

        response = self.client.post(
            reverse('facture-valider', kwargs={'pk': facture.pk}), {}
        )
        self.assertLess(response.status_code, 300, response.data)

        self.assertEqual(
            self._assert_stock_synced(produit, 'valider'), 97,
            'stock attendu 97 après vente de 3',
        )
        self._assert_no_negative_lot(produit, 'valider')

        # Traçabilité : les allocations couvrent toute la quantité vendue
        allocated = FactureProduitAllocation.objects.filter(
            facture_produit=ligne
        ).aggregate(total=Sum('quantity'))['total'] or 0
        self.assertEqual(allocated, 3, 'allocations ≠ quantité vendue')

    # ── 2. Annulation = restauration complète ──

    def test_facture_annuler_restores_stock_fully(self):
        produit = self.produit_annul
        facture = TestDataFactory.create_facture(
            client=self.customer, status='BROU', total_ttc=400
        )
        TestDataFactory.create_facture_produit(
            facture, produit, quantity=4, selling_price=100
        )
        r = self.client.post(
            reverse('facture-valider', kwargs={'pk': facture.pk}), {}
        )
        self.assertLess(r.status_code, 300)
        self.assertEqual(self._assert_stock_synced(produit, 'valider'), 96)

        r = self.client.post(
            reverse('facture-annuler', kwargs={'pk': facture.pk}),
            {'motif': 'test invariant'},
        )
        self.assertLess(r.status_code, 300, r.data)

        self.assertEqual(
            self._assert_stock_synced(produit, 'annuler'), 100,
            'l\'annulation n\'a pas restauré intégralement le stock',
        )
        self._assert_no_negative_lot(produit, 'annuler')

    # ── 3. Ajustement manuel ──

    def test_adjust_stock_keeps_lots_synced(self):
        produit = self.produit_ajust
        response = self.client.post(
            reverse('produit-adjust-stock', kwargs={'pk': produit.pk}),
            {'new_quantity': 42, 'reason_type': 'CASSE'},
            format='json',
        )
        self.assertLess(response.status_code, 300, response.data)

        self.assertEqual(
            self._assert_stock_synced(produit, 'ajustement'), 42,
        )
        self._assert_no_negative_lot(produit, 'ajustement')
        self.assertTrue(
            StockAdjustment.objects.filter(produit=produit).exists(),
            'aucun StockAdjustment tracé',
        )

    # ── 4. Réception de commande ──

    def test_commande_cloturer_reception_syncs_stock(self):
        produit = self.produit_recep
        commande = TestDataFactory.create_commande(
            fournisseur=produit.fournisseur, status='PREP'
        )
        TestDataFactory.create_commande_produit(commande, produit, quantity=5)

        response = self.client.post(
            reverse('commande-cloturer', kwargs={'pk': commande.pk}), {}
        )
        self.assertLess(response.status_code, 300, response.data)

        self.assertEqual(
            self._assert_stock_synced(produit, 'clôture'), 15,
            'la réception n\'a pas incrémenté stock et lots de façon cohérente',
        )
        self._assert_no_negative_lot(produit, 'clôture')

    # ── 5. Livraison de promis ──

    def test_promis_delivrer_stays_consistent(self):
        produit = self.produit_promis
        promis = Promis.objects.create(
            client=self.customer, produit=produit,
            quantite=2, created_by=self.admin,
        )
        response = self.client.post(
            reverse('promis-delivrer', kwargs={'pk': promis.pk}), {}
        )
        self.assertLess(response.status_code, 300, response.data)

        promis.refresh_from_db()
        # Livré (totalement ou partiellement) — jamais incohérent
        self.assertIn(
            promis.status, (Promis.Status.DELIVRE, Promis.Status.EN_ATTENTE),
        )
        # Le compteur reste synchronisé quelle que soit la voie empruntée
        # (déstockage lot ou dette de stock tracée).
        self._assert_stock_synced(produit, 'promis')
        self._assert_no_negative_lot(produit, 'promis')

    # ── 6. Sortie des périmés ──

    def test_sortir_perimes_syncs_stock(self):
        produit = self.produit_perime
        lot = produit.stock_lots.first()
        response = self.client.post(
            reverse('stocklot-sortir-perimes', kwargs={'pk': lot.pk}), {}
        )
        self.assertLess(response.status_code, 300, response.data)

        lot.refresh_from_db()
        self.assertEqual(
            lot.quantity_remaining, 0, 'le lot périmé n\'est pas vidé'
        )
        self.assertEqual(
            self._assert_stock_synced(produit, 'périmés'), 0,
        )

    # ── 7. Scan global de fin de flux ──

    def test_global_stock_integrity_scan(self):
        """Aucune dérive ni quantité négative sur AUCUN produit lot-géré."""
        drifts = []
        for produit in Produit.objects.filter(use_lot_management=True):
            try:
                self._assert_stock_synced(produit, f'global:{produit.pk}')
            except AssertionError as exc:
                drifts.append(str(exc))
        self.assertEqual(drifts, [], '\n'.join(drifts))

        negatives = StockLot.objects.filter(
            quantity_remaining__lt=0
        ) | StockLot.objects.filter(quantity_reserved__lt=0)
        self.assertFalse(
            negatives.exists(),
            f'lots négatifs: {[l.id for l in negatives[:10]]}',
        )
