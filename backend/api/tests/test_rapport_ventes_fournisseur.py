"""
Tests du rapport « Ventes par Fournisseur (Lots) »
(/api/rapports/ventes_fournisseur_lots/).
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import Facture, FactureProduit, FactureProduitAllocation, Fournisseur, Produit, StockLot

URL = '/api/rapports/ventes_fournisseur_lots/'


class VentesFournisseurLotsTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(username='admin_vfl', password='x')
        self.client.force_authenticate(user=self.user)

        self.f_a = Fournisseur.objects.create(name="Grossiste A")
        self.f_b = Fournisseur.objects.create(name="Grossiste B")
        # Fournisseur par défaut du produit = B, mais le lot vient de A.
        self.produit = Produit.objects.create(
            name="Doliprane", cip1="D001", selling_price=Decimal('100'), cost_price=Decimal('60'),
            pmp=Decimal('60'), tva=Decimal('0'), fournisseur=self.f_b,
        )
        now = timezone.now()
        self.lot_a = StockLot.objects.create(
            produit=self.produit, fournisseur=self.f_a, lot="LOT-A", quantity_initial=10,
            quantity_remaining=5, price_cost=Decimal('60'), date_reception=now,
            date_expiration=now.date(),
        )
        self.lot_a2 = StockLot.objects.create(
            produit=self.produit, fournisseur=self.f_a, lot="LOT-A2", quantity_initial=10,
            quantity_remaining=9, price_cost=Decimal('50'), date_reception=now,
        )

        self.facture = Facture.objects.create(status=Facture.Status.VALIDEE, date=now)
        # Une facture VALIDEE n'est comptée qu'avec au moins un paiement complété.
        self.facture.paiements.create(montant=Decimal('1.00'), mode_paiement='especes', statut='completee')

        # 4 unités à 100 avec remise ligne de 10 : 3 du LOT-A (dont 1 UG), 1 du LOT-A2.
        fp = FactureProduit.objects.create(
            facture=self.facture, produit=self.produit, quantity=4,
            selling_price=Decimal('100'), discount=Decimal('10'), tva=Decimal('0'),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp, stock_lot=self.lot_a, quantity=3, quantity_free=1,
            cost_price=Decimal('60'), selling_price=Decimal('100'),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp, stock_lot=self.lot_a2, quantity=1,
            cost_price=Decimal('50'), selling_price=Decimal('100'),
        )
        # 2 unités vendues en attente de stock (aucun lot) → fournisseur du produit (B).
        fp2 = FactureProduit.objects.create(
            facture=self.facture, produit=self.produit, quantity=2,
            selling_price=Decimal('100'), tva=Decimal('0'),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp2, stock_lot=None, is_pending=True, quantity=2,
            cost_price=Decimal('60'), selling_price=Decimal('100'),
        )

        # Facture annulée (inactive) : ne doit jamais apparaître.
        annulee = Facture.objects.create(status=Facture.Status.PAYEE, date=now, is_active=False)
        fp3 = FactureProduit.objects.create(
            facture=annulee, produit=self.produit, quantity=7, selling_price=Decimal('100'), tva=Decimal('0'),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp3, stock_lot=self.lot_a, quantity=7,
            cost_price=Decimal('60'), selling_price=Decimal('100'),
        )

        today = now.date().isoformat()
        self.period = {'date_debut': today, 'date_fin': today}

    def test_groupe_par_lot(self):
        res = self.client.get(URL, self.period)
        self.assertEqual(res.status_code, 200)
        rows = {(r['fournisseur'], r['lot']): r for r in res.data}
        self.assertEqual(len(rows), 3)

        lot_a = rows[("Grossiste A", "LOT-A")]
        self.assertEqual(lot_a['quantite'], 3)
        self.assertEqual(lot_a['quantite_ug'], 1)
        self.assertEqual(lot_a['montant_vente'], 270.0)  # 3 × (100 - 10)
        self.assertEqual(lot_a['montant_achat'], 180.0)  # 3 × 60
        self.assertEqual(lot_a['marge'], 90.0)
        self.assertEqual(lot_a['taux_marge'], 33.33)
        self.assertIsNotNone(lot_a['date_peremption'])

        self.assertEqual(rows[("Grossiste A", "LOT-A2")]['quantite'], 1)

        sans_lot = rows[("Grossiste B", "Sans lot (en attente)")]
        self.assertEqual(sans_lot['quantite'], 2)
        self.assertEqual(sans_lot['montant_vente'], 200.0)

    def test_filtre_fournisseur(self):
        res = self.client.get(URL, {**self.period, 'fournisseur_id': self.f_a.id})
        self.assertEqual(res.status_code, 200)
        self.assertEqual({r['lot'] for r in res.data}, {"LOT-A", "LOT-A2"})

        res = self.client.get(URL, {**self.period, 'fournisseur_id': self.f_b.id})
        self.assertEqual([r['lot'] for r in res.data], ["Sans lot (en attente)"])

    def test_vue_detail(self):
        res = self.client.get(URL, {**self.period, 'vue': 'detail'})
        self.assertEqual(res.status_code, 200)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(rows), 3)
        self.assertEqual(sum(r['quantite'] for r in rows), 6)
        self.assertTrue(all(r['numero_facture'] for r in rows))
        lot_a2 = next(r for r in rows if r['lot'] == "LOT-A2")
        self.assertEqual(lot_a2['prix_vente'], 90.0)
        self.assertEqual(lot_a2['marge'], 40.0)  # 90 - 50

    def _vente_avec_tva(self):
        """1 unité TTC 119,25 (TVA 19,25 %) → HT 100, coût HT 60 → marge 40."""
        produit = Produit.objects.create(
            name="Creme TVA", cip1="T001", selling_price=Decimal('119.25'), cost_price=Decimal('60'),
            pmp=Decimal('60'), tva=Decimal('19.25'), fournisseur=self.f_a,
        )
        lot = StockLot.objects.create(
            produit=produit, fournisseur=self.f_a, lot="LOT-TVA", quantity_initial=5,
            quantity_remaining=4, price_cost=Decimal('60'), date_reception=timezone.now(),
        )
        fp = FactureProduit.objects.create(
            facture=self.facture, produit=produit, quantity=1,
            selling_price=Decimal('119.25'), tva=Decimal('19.25'),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp, stock_lot=lot, quantity=1,
            cost_price=Decimal('60'), selling_price=Decimal('119.25'),
        )
        return produit

    def test_marge_calculee_sur_le_ht(self):
        self._vente_avec_tva()
        res = self.client.get(URL, self.period)
        row = next(r for r in res.data if r['lot'] == "LOT-TVA")
        self.assertEqual(row['montant_vente'], 119.25)
        self.assertEqual(row['montant_vente_ht'], 100.0)
        self.assertEqual(row['marge'], 40.0)
        self.assertEqual(row['taux_marge'], 40.0)

        detail = self.client.get(URL, {**self.period, 'vue': 'detail'}).data
        rows = detail['results'] if isinstance(detail, dict) else detail
        d = next(r for r in rows if r['lot'] == "LOT-TVA")
        self.assertEqual(d['montant_vente_ht'], 100.0)
        self.assertEqual(d['marge'], 40.0)

    def test_top_selling_products_marge_ht_et_remise(self):
        produit_tva = self._vente_avec_tva()
        res = self.client.get('/api/rapports/top_selling_products/', self.period)
        self.assertEqual(res.status_code, 200)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        by_id = {r['id']: r for r in rows}

        tva = by_id[produit_tva.id]
        self.assertEqual(tva['catttc'], 119.25)
        self.assertEqual(tva['marge'], 40.0)
        self.assertEqual(tva['taux_marge'], 40.0)

        # Doliprane : 6 unités, remise ligne 10 sur 4 d'entre elles → CA 4×90 + 2×100 = 560.
        dol = by_id[self.produit.id]
        self.assertEqual(dol['catttc'], 560.0)
        # Coûts : 3×60 + 1×50 + 2×60 = 350 → marge 210 (TVA 0 %).
        self.assertEqual(dol['marge'], 210.0)

    def test_lignes_sans_allocation_et_remise_globale(self):
        """Comme statistiques/ca_par_fournisseur : lignes sans allocation incluses
        (« Sans lot », coût au PMP) et remise globale répartie au prorata."""
        sans_fourn = Produit.objects.create(
            name="Test Glycemie", cip1="G001", selling_price=Decimal('1000'), pmp=Decimal('700'),
            tva=Decimal('0'),
        )
        f2 = Facture.objects.create(status=Facture.Status.PAYEE, date=timezone.now(), remise=Decimal('100'))
        FactureProduit.objects.create(
            facture=f2, produit=sans_fourn, quantity=2, selling_price=Decimal('1000'), tva=Decimal('0'),
        )

        res = self.client.get(URL, self.period)
        row = next(r for r in res.data if r['nom_produit'] == "Test Glycemie")
        self.assertEqual(row['fournisseur'], "Fournisseur inconnu")
        self.assertEqual(row['lot'], "Sans lot")
        self.assertEqual(row['quantite'], 2)
        self.assertEqual(row['montant_vente'], 1900.0)  # 2000 − remise globale 100
        self.assertEqual(row['montant_achat'], 1400.0)  # 2 × PMP 700
        self.assertEqual(row['marge'], 500.0)

        # Le total du rapport = le total des stats fournisseur sur la même période.
        stats = self.client.get('/api/statistiques/ca_par_fournisseur/', self.period).data
        self.assertAlmostEqual(sum(r['montant_vente'] for r in res.data), sum(s['ca_ttc'] for s in stats), places=2)
        self.assertEqual(sum(r['quantite'] for r in res.data), sum(s['quantite_vendue'] for s in stats))

        detail = self.client.get(URL, {**self.period, 'vue': 'detail'}).data
        rows = detail['results'] if isinstance(detail, dict) else detail
        self.assertEqual(sum(r['quantite'] for r in rows), sum(r['quantite'] for r in res.data))

        # Stats fournisseur : coût des ventes sans lot au PMP, marge = CA HT − coût.
        inconnu = next(s for s in stats if s['id'] == 0)
        self.assertEqual(inconnu['cout_achat'], 1400.0)
        self.assertEqual(inconnu['marge_brute'], 500.0)
        self.assertAlmostEqual(
            sum(s['cout_achat'] for s in stats), sum(r['montant_achat'] for r in res.data), places=2
        )
        self.assertAlmostEqual(sum(s['marge_brute'] for s in stats), sum(r['marge'] for r in res.data), places=2)

        # Produits les plus vendus : la vente sans lot est comptée.
        top = self.client.get('/api/rapports/top_selling_products/', self.period).data
        top_rows = top['results'] if isinstance(top, dict) else top
        glycemie = next(r for r in top_rows if r['name'] == "Test Glycemie")
        self.assertEqual(glycemie['qty'], 2)
        self.assertEqual(glycemie['catttc'], 1900.0)
        self.assertEqual(glycemie['marge'], 500.0)

    def test_marge_facture_avec_ligne_sans_lot(self):
        from ..services.margin_service import MarginService

        p = Produit.objects.create(name="Sans lot", selling_price=Decimal('100'), pmp=Decimal('70'), tva=Decimal('0'))
        f = Facture.objects.create(status=Facture.Status.PAYEE, date=timezone.now(), total_ht=Decimal('300'))
        FactureProduit.objects.create(facture=f, produit=p, quantity=3, selling_price=Decimal('100'), tva=Decimal('0'))
        margins = MarginService.calculate_facture_margin(f)
        self.assertEqual(margins['cout_achat'], Decimal('210.00'))
        self.assertEqual(margins['marge_brute'], Decimal('90.00'))

    def test_parametres_invalides(self):
        self.assertEqual(self.client.get(URL, {'date_debut': self.period['date_debut']}).status_code, 400)
        self.assertEqual(self.client.get(URL, {**self.period, 'vue': 'xxx'}).status_code, 400)
