"""
Tests pour les endpoints d'analyse des marges par produit
(FinanceStatsViewSet.marge_par_produit / impact_promotions).
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Client,
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    Fournisseur,
    Produit,
    StockLot,
)


class MargeParProduitTest(TestCase):
    """Tests de l'endpoint /api/finance-stats/marge_par_produit/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='admin_marges')
        self.user.profile.role = 'PHARMACIEN'
        self.user.profile.save()
        self.client.force_authenticate(user=self.user)

        self.test_client = Client.objects.create(name="Client Test")
        self.fournisseur = Fournisseur.objects.create(name="Fournisseur Test")

        # Produit A : vendu via une allocation de lot (marge basée sur cost_price du lot)
        self.produit_a = Produit.objects.create(
            name="Produit A", cost_price=Decimal('50.00'), selling_price=Decimal('100.00'),
            pmp=Decimal('50.00'), cip1="A001", tva=Decimal('0.00')
        )
        # Produit B : vendu sans allocation (marge basée sur le pmp du produit)
        self.produit_b = Produit.objects.create(
            name="Produit B", cost_price=Decimal('80.00'), selling_price=Decimal('120.00'),
            pmp=Decimal('80.00'), cip1="B001", tva=Decimal('0.00')
        )
        # Produit C : vendu à perte (marge négative)
        self.produit_c = Produit.objects.create(
            name="Produit C", cost_price=Decimal('90.00'), selling_price=Decimal('60.00'),
            pmp=Decimal('90.00'), cip1="C001", tva=Decimal('0.00')
        )

        self.facture = Facture.objects.create(
            client=self.test_client,
            status=Facture.Status.VALIDEE,
            date=timezone.now(),
        )
        # Facture VALIDEE sans paiement est exclue par get_validated_invoices_queryset() ;
        # on ajoute donc un paiement minimal pour que la facture soit comptabilisée.
        self.facture.paiements.create(montant=Decimal('1.00'), mode_paiement='ESPECES')

        # Ligne A : allocation (2 unités, cost_price=50, selling_price=100 -> marge=100)
        fp_a = FactureProduit.objects.create(
            facture=self.facture, produit=self.produit_a, quantity=2,
            selling_price=Decimal('100.00'), tva=Decimal('0.00')
        )
        self.lot_a = StockLot.objects.create(
            produit=self.produit_a, fournisseur=self.fournisseur, lot="LOT-A",
            quantity_initial=10, quantity_remaining=8, price_cost=Decimal('50.00'),
            selling_price=Decimal('100.00'), date_reception=timezone.now(),
            date_expiration=timezone.now().date(),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp_a, stock_lot=self.lot_a, quantity=2,
            cost_price=Decimal('50.00'), selling_price=Decimal('100.00')
        )

        # Ligne B : sans allocation (3 unités, pmp=80, selling_price=120 -> marge=120)
        FactureProduit.objects.create(
            facture=self.facture, produit=self.produit_b, quantity=3,
            selling_price=Decimal('120.00'), tva=Decimal('0.00')
        )

        # Ligne C : sans allocation, vendue à perte (1 unité, pmp=90, selling_price=60 -> marge=-30)
        FactureProduit.objects.create(
            facture=self.facture, produit=self.produit_c, quantity=1,
            selling_price=Decimal('60.00'), tva=Decimal('0.00')
        )

    def test_marge_par_produit_totaux(self):
        response = self.client.get('/api/finance-stats/marge_par_produit/', {'periode': 'mois'})
        self.assertEqual(response.status_code, 200)
        data = response.data

        self.assertEqual(data['total_produits'], 3)
        # CA total = (2*100) + (3*120) + (1*60) = 200 + 360 + 60 = 620
        self.assertEqual(data['total_ca'], 620.0)
        # Marge totale = 100 + 120 - 30 = 190
        self.assertEqual(data['total_marge'], 190.0)

    def test_marge_par_produit_allocation_vs_pmp(self):
        """Le produit alloué doit utiliser le cost_price du lot, pas le pmp du produit."""
        response = self.client.get('/api/finance-stats/marge_par_produit/', {'periode': 'mois'})
        data = response.data
        by_id = {p['id']: p for p in data['top_20']}

        produit_a_stats = by_id[self.produit_a.id]
        self.assertEqual(produit_a_stats['marge'], 100.0)
        self.assertEqual(produit_a_stats['ca'], 200.0)
        self.assertEqual(produit_a_stats['taux_marge'], 50.0)

        produit_b_stats = by_id[self.produit_b.id]
        self.assertEqual(produit_b_stats['marge'], 120.0)
        self.assertEqual(produit_b_stats['ca'], 360.0)

    def test_marge_par_produit_detecte_marge_negative(self):
        response = self.client.get('/api/finance-stats/marge_par_produit/', {'periode': 'mois'})
        data = response.data

        negatifs = data['negative_margin']
        self.assertEqual(len(negatifs), 1)
        self.assertEqual(negatifs[0]['id'], self.produit_c.id)
        self.assertEqual(negatifs[0]['marge'], -30.0)

    def test_marge_par_produit_tri_top_bottom(self):
        response = self.client.get('/api/finance-stats/marge_par_produit/', {'periode': 'mois'})
        data = response.data

        # Le meilleur produit (marge la plus haute) doit être en tête du top_20
        self.assertEqual(data['top_20'][0]['id'], self.produit_b.id)
        # Le pire produit (marge la plus basse, ici négative) doit être en tête du bottom_20
        self.assertEqual(data['bottom_20'][0]['id'], self.produit_c.id)

    def test_marge_par_produit_periode_hors_plage_exclut_facture(self):
        """Une facture hors période ne doit pas apparaître dans le calcul."""
        old_facture = Facture.objects.create(
            client=self.test_client, status=Facture.Status.VALIDEE,
        )
        Facture.objects.filter(id=old_facture.id).update(
            date=timezone.now() - timezone.timedelta(days=400)
        )
        old_facture.refresh_from_db()
        old_facture.paiements.create(montant=Decimal('1.00'), mode_paiement='ESPECES')
        FactureProduit.objects.create(
            facture=old_facture, produit=self.produit_a, quantity=99,
            selling_price=Decimal('100.00'), tva=Decimal('0.00')
        )

        response = self.client.get('/api/finance-stats/marge_par_produit/', {'periode': 'mois'})
        data = response.data
        # Le total ne doit pas inclure les 99 unités de la facture ancienne
        self.assertEqual(data['total_ca'], 620.0)


class ImpactPromotionsTest(TestCase):
    """Tests de l'endpoint /api/finance-stats/impact_promotions/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='admin_promo')
        self.user.profile.role = 'PHARMACIEN'
        self.user.profile.save()
        self.client.force_authenticate(user=self.user)

        self.test_client = Client.objects.create(name="Client Test")
        self.fournisseur = Fournisseur.objects.create(name="Fournisseur Test")

        self.produit = Produit.objects.create(
            name="Produit Promo", cost_price=Decimal('50.00'), selling_price=Decimal('100.00'),
            pmp=Decimal('50.00'), cip1="P001", tva=Decimal('0.00')
        )
        self.lot = StockLot.objects.create(
            produit=self.produit, fournisseur=self.fournisseur, lot="LOT-P",
            quantity_initial=20, quantity_remaining=20, price_cost=Decimal('50.00'),
            selling_price=Decimal('100.00'), date_reception=timezone.now(),
            date_expiration=timezone.now().date(),
        )

        self.facture = Facture.objects.create(
            client=self.test_client, status=Facture.Status.VALIDEE, date=timezone.now(),
        )
        self.facture.paiements.create(montant=Decimal('1.00'), mode_paiement='ESPECES')

        # Ligne AVEC remise (discount=10 par unité, 2 unités)
        fp_promo = FactureProduit.objects.create(
            facture=self.facture, produit=self.produit, quantity=2,
            selling_price=Decimal('100.00'), discount=Decimal('10.00'), tva=Decimal('0.00')
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp_promo, stock_lot=self.lot, quantity=2,
            cost_price=Decimal('50.00'), selling_price=Decimal('100.00')
        )

        # Ligne SANS remise (5 unités)
        fp_normal = FactureProduit.objects.create(
            facture=self.facture, produit=self.produit, quantity=5,
            selling_price=Decimal('100.00'), discount=Decimal('0.00'), tva=Decimal('0.00')
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp_normal, stock_lot=self.lot, quantity=5,
            cost_price=Decimal('50.00'), selling_price=Decimal('100.00')
        )

    def test_impact_promotions_repartition_avec_sans(self):
        response = self.client.get('/api/finance-stats/impact_promotions/', {'periode': 'mois'})
        self.assertEqual(response.status_code, 200)
        data = response.data

        # Avec promo : (100-10)*2 = 180 de CA, marge = (90-50)*2 = 80
        self.assertEqual(data['avec_promotion']['ca'], 180.0)
        self.assertEqual(data['avec_promotion']['marge'], 80.0)
        self.assertEqual(data['avec_promotion']['quantite'], 2)

        # Sans promo : 100*5 = 500 de CA, marge = (100-50)*5 = 250
        self.assertEqual(data['sans_promotion']['ca'], 500.0)
        self.assertEqual(data['sans_promotion']['marge'], 250.0)
        self.assertEqual(data['sans_promotion']['quantite'], 5)

    def test_impact_promotions_ne_classe_pas_ligne_remisee_comme_normale(self):
        """
        Régression : filtre `without_promo` — la précédence de '&'/'|' faisait que
        toute ligne pouvait être comptée dans 'sans_promotion' via la clause
        `remise__isnull=True`, même avec une remise ligne > 0. On vérifie ici que la
        somme des quantités avec + sans promo correspond bien au total réel (pas de
        double comptage ni de ligne mal classée).
        """
        response = self.client.get('/api/finance-stats/impact_promotions/', {'periode': 'mois'})
        data = response.data

        total_quantite = data['avec_promotion']['quantite'] + data['sans_promotion']['quantite']
        self.assertEqual(total_quantite, 7)  # 2 + 5, sans double comptage
        self.assertEqual(data['avec_promotion']['quantite'], 2)

    def test_impact_promotions_ca_perdu_remises(self):
        response = self.client.get('/api/finance-stats/impact_promotions/', {'periode': 'mois'})
        data = response.data
        # CA perdu = remise unitaire * quantité = 10 * 2 = 20 (pas de remise globale ici)
        self.assertEqual(data['ca_perdu_remises'], 20.0)

    def test_impact_promotions_ecart_taux_marge(self):
        response = self.client.get('/api/finance-stats/impact_promotions/', {'periode': 'mois'})
        data = response.data
        # taux_marge sans promo = 250/500*100 = 50.0 ; avec promo = 80/180*100 = 44.4
        self.assertEqual(data['sans_promotion']['taux_marge'], 50.0)
        self.assertEqual(data['avec_promotion']['taux_marge'], 44.4)
        self.assertAlmostEqual(data['ecart_taux_marge'], 5.6, delta=0.1)
