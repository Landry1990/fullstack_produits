"""
Tests for the Challenges module.
Covers: creation (CA, BOITES, POINTS), teams, point tiers, ranking endpoint,
        anti-peremption auto-population, retrocompatibility.
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Challenge,
    ChallengeEquipe,
    ChallengePointTier,
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    Produit,
    StockLot,
)
from .factories import TestDataFactory


class ChallengeBaseSetup:
    """Shared setUp for challenge tests."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.seller1 = TestDataFactory.create_user(username='seller1')
        self.seller2 = TestDataFactory.create_user(username='seller2')
        self.seller3 = TestDataFactory.create_user(username='seller3')
        self.produit1 = TestDataFactory.create_produit(name='Produit A', stock=50)
        self.produit2 = TestDataFactory.create_produit(name='Produit B', stock=30)
        self.today = timezone.now().date()
        self.date_debut = self.today - timedelta(days=5)
        self.date_fin = self.today + timedelta(days=25)


class ChallengeCreationTests(ChallengeBaseSetup, APITestCase):
    """Tests for challenge CRUD and nested data (teams, point tiers)."""

    def test_create_challenge_ca_with_teams(self):
        """Creating a CA challenge with equipes_data should persist teams."""
        payload = {
            'nom': 'Challenge CA Equipes',
            'date_debut': self.date_debut.isoformat(),
            'date_fin': self.date_fin.isoformat(),
            'statut': 'ENC',
            'type_objectif': 'CA',
            'mode': 'EQUIPES',
            'all_users': True,
            'equipes_data': [
                {'nom': 'Equipe A', 'membres': [self.seller1.id, self.seller2.id]},
                {'nom': 'Equipe B', 'membres': [self.seller3.id]},
            ],
        }
        resp = self.client.post('/api/challenges/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['mode'], 'EQUIPES')
        self.assertEqual(resp.data['type_objectif'], 'CA')
        # Teams should be in the response
        equipes = resp.data.get('equipes', [])
        self.assertEqual(len(equipes), 2, f"Expected 2 teams, got {len(equipes)}: {equipes}")
        # Verify teams persisted in DB
        challenge_id = resp.data['id']
        self.assertEqual(ChallengeEquipe.objects.filter(challenge_id=challenge_id).count(), 2)
        # Verify members
        eq_a = ChallengeEquipe.objects.get(challenge_id=challenge_id, nom='Equipe A')
        self.assertEqual(eq_a.membres.count(), 2)

    def test_create_challenge_points_with_tiers(self):
        """Creating a POINTS challenge with point_tiers_data should persist tiers."""
        payload = {
            'nom': 'Chasse au Tresor',
            'date_debut': self.date_debut.isoformat(),
            'date_fin': self.date_fin.isoformat(),
            'statut': 'ENC',
            'type_objectif': 'POINTS',
            'mode': 'EQUIPES',
            'all_users': True,
            'source_produits': 'AUTO_PEREMPTION',
            'peremption_mois': 6,
            'point_tiers_data': [
                {'mois_max': 1, 'points': 50},
                {'mois_max': 3, 'points': 20},
                {'mois_max': 6, 'points': 5},
            ],
        }
        resp = self.client.post('/api/challenges/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['type_objectif'], 'POINTS')
        self.assertEqual(resp.data['source_produits'], 'AUTO_PEREMPTION')
        self.assertEqual(resp.data['peremption_mois'], 6)
        # Tiers should be in the response
        tiers = resp.data.get('point_tiers', [])
        self.assertEqual(len(tiers), 3, f"Expected 3 tiers, got {len(tiers)}: {tiers}")
        # Verify tiers persisted in DB
        challenge_id = resp.data['id']
        self.assertEqual(ChallengePointTier.objects.filter(challenge_id=challenge_id).count(), 3)

    def test_create_challenge_boites_individual(self):
        """Creating a BOITES challenge in INDIVIDUEL mode."""
        payload = {
            'nom': 'Challenge Boites',
            'date_debut': self.date_debut.isoformat(),
            'date_fin': self.date_fin.isoformat(),
            'statut': 'ENC',
            'type_objectif': 'BOITES',
            'mode': 'INDIVIDUEL',
            'all_users': True,
        }
        resp = self.client.post('/api/challenges/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['type_objectif'], 'BOITES')
        self.assertEqual(resp.data['mode'], 'INDIVIDUEL')

    def test_update_challenge_replaces_teams(self):
        """Updating equipes_data should sync (add/update/remove) teams."""
        # Create with 2 teams
        challenge = Challenge.objects.create(
            nom='Test Update', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='CA', mode='EQUIPES', all_users=True,
            created_by=self.user,
        )
        eq1 = ChallengeEquipe.objects.create(challenge=challenge, nom='Old Team 1')
        eq1.membres.add(self.seller1)
        eq2 = ChallengeEquipe.objects.create(challenge=challenge, nom='Old Team 2')
        eq2.membres.add(self.seller2)

        # Update: keep Old Team 1, remove Old Team 2, add New Team 3
        payload = {
            'nom': 'Test Updated',
            'equipes_data': [
                {'nom': 'Old Team 1', 'membres': [self.seller1.id, self.seller3.id]},
                {'nom': 'New Team 3', 'membres': [self.seller2.id]},
            ],
        }
        resp = self.client.patch(f'/api/challenges/{challenge.id}/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        equipes = resp.data.get('equipes', [])
        noms = {eq['nom'] for eq in equipes}
        self.assertEqual(noms, {'Old Team 1', 'New Team 3'})
        # Old Team 2 should be deleted
        self.assertFalse(ChallengeEquipe.objects.filter(challenge=challenge, nom='Old Team 2').exists())
        # Old Team 1 should now have 2 members
        eq1.refresh_from_db()
        self.assertEqual(eq1.membres.count(), 2)

    def test_update_challenge_replaces_tiers(self):
        """Updating point_tiers_data should sync tiers by mois_max."""
        challenge = Challenge.objects.create(
            nom='Test Tiers Update', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='POINTS', mode='EQUIPES', all_users=True,
            source_produits='AUTO_PEREMPTION', peremption_mois=6,
            created_by=self.user,
        )
        ChallengePointTier.objects.create(challenge=challenge, mois_max=1, points=50)
        ChallengePointTier.objects.create(challenge=challenge, mois_max=6, points=5)

        # Update: keep mois_max=1 (change points), remove mois_max=6, add mois_max=3
        payload = {
            'point_tiers_data': [
                {'mois_max': 1, 'points': 100},
                {'mois_max': 3, 'points': 30},
            ],
        }
        resp = self.client.patch(f'/api/challenges/{challenge.id}/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        tiers = {t['mois_max']: t['points'] for t in resp.data.get('point_tiers', [])}
        self.assertEqual(tiers, {1: 100, 3: 30})
        # mois_max=6 should be deleted
        self.assertFalse(ChallengePointTier.objects.filter(challenge=challenge, mois_max=6).exists())


class ChallengeClassementTests(ChallengeBaseSetup, APITestCase):
    """Tests for the classement (ranking) endpoint."""

    def _create_paid_facture(self, seller, produit, quantity, selling_price=None):
        """Helper: create a paid invoice with one product line."""
        client = TestDataFactory.create_client()
        facture = Facture.objects.create(
            client=client,
            status=Facture.Status.PAYEE,
            total_ttc=Decimal(str(quantity * (selling_price or produit.selling_price))),
            created_by=seller,
            date=timezone.now(),
        )
        FactureProduit.objects.create(
            facture=facture,
            produit=produit,
            quantity=quantity,
            selling_price=Decimal(str(selling_price or produit.selling_price)),
        )
        return facture

    def test_classement_ca_individual(self):
        """CA ranking in INDIVIDUEL mode should aggregate by seller."""
        challenge = Challenge.objects.create(
            nom='CA Individual', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='CA', mode='INDIVIDUEL', all_users=True,
            created_by=self.user,
        )
        challenge.produits.add(self.produit1)
        # seller1 sells 3 x 100 = 300
        self._create_paid_facture(self.seller1, self.produit1, 3)
        # seller2 sells 5 x 100 = 500
        self._create_paid_facture(self.seller2, self.produit1, 5)

        resp = self.client.get(f'/api/challenges/{challenge.id}/classement/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        classement = resp.data['classement']
        self.assertEqual(len(classement), 2)
        # seller2 should be rank 1 (500 > 300)
        self.assertEqual(classement[0]['entity_name'], 'seller2')
        self.assertEqual(float(classement[0]['ca']), 500.0)
        self.assertEqual(classement[1]['entity_name'], 'seller1')
        self.assertEqual(float(classement[1]['ca']), 300.0)

    def test_classement_boites_with_objectif(self):
        """BOITES ranking with objectif_valeur should include progression."""
        challenge = Challenge.objects.create(
            nom='Boites Objectif', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='BOITES', mode='INDIVIDUEL', all_users=True,
            objectif_valeur=Decimal('10'),
            created_by=self.user,
        )
        challenge.produits.add(self.produit1)
        self._create_paid_facture(self.seller1, self.produit1, 3)
        self._create_paid_facture(self.seller2, self.produit1, 7)

        resp = self.client.get(f'/api/challenges/{challenge.id}/classement/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        classement = resp.data['classement']
        # seller2: 7 boites, objectif 10 → 70%, not reached
        entry2 = next(e for e in classement if e['entity_name'] == 'seller2')
        self.assertEqual(entry2['nb_boites'], 7)
        self.assertEqual(entry2['objectif'], 10.0)
        self.assertAlmostEqual(entry2['progression'], 70.0, places=1)
        self.assertFalse(entry2['atteint'])

    def test_classement_equipes_aggregates_members(self):
        """EQUIPES mode should sum sales across team members."""
        challenge = Challenge.objects.create(
            nom='CA Equipes', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='CA', mode='EQUIPES', all_users=True,
            created_by=self.user,
        )
        challenge.produits.add(self.produit1)
        eq_a = ChallengeEquipe.objects.create(challenge=challenge, nom='Equipe A')
        eq_a.membres.add(self.seller1, self.seller2)
        eq_b = ChallengeEquipe.objects.create(challenge=challenge, nom='Equipe B')
        eq_b.membres.add(self.seller3)
        # Equipe A: seller1 (300) + seller2 (500) = 800
        self._create_paid_facture(self.seller1, self.produit1, 3)
        self._create_paid_facture(self.seller2, self.produit1, 5)
        # Equipe B: seller3 (200)
        self._create_paid_facture(self.seller3, self.produit1, 2)

        resp = self.client.get(f'/api/challenges/{challenge.id}/classement/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        classement = resp.data['classement']
        self.assertEqual(len(classement), 2)
        # Equipe A should be rank 1
        self.assertEqual(classement[0]['entity_name'], 'Equipe A')
        self.assertEqual(float(classement[0]['ca']), 800.0)
        self.assertEqual(classement[1]['entity_name'], 'Equipe B')
        self.assertEqual(float(classement[1]['ca']), 200.0)

    def test_classement_points_auto_peremption(self):
        """POINTS + AUTO_PEREMPTION should auto-populate products from near-expiry lots."""
        # Create a lot expiring in 20 days (< 1 month → tier 1 mois_max=1)
        lot = TestDataFactory.create_stock_lot(
            produit=self.produit1,
            quantity=10,
            quantity_remaining=10,
            date_expiration=self.today + timedelta(days=20),
        )
        challenge = Challenge.objects.create(
            nom='Chasse Tresor', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='POINTS', mode='EQUIPES', all_users=True,
            source_produits='AUTO_PEREMPTION', peremption_mois=6,
            created_by=self.user,
        )
        ChallengePointTier.objects.create(challenge=challenge, mois_max=1, points=50)
        ChallengePointTier.objects.create(challenge=challenge, mois_max=3, points=20)
        ChallengePointTier.objects.create(challenge=challenge, mois_max=6, points=5)
        eq_a = ChallengeEquipe.objects.create(challenge=challenge, nom='Equipe A')
        eq_a.membres.add(self.seller1)

        # Create a paid invoice with an allocation on the near-expiry lot
        client = TestDataFactory.create_client()
        facture = Facture.objects.create(
            client=client, status=Facture.Status.PAYEE,
            total_ttc=Decimal('300'), created_by=self.seller1, date=timezone.now(),
        )
        fp = FactureProduit.objects.create(
            facture=facture, produit=self.produit1, quantity=3,
            selling_price=Decimal('100'),
        )
        FactureProduitAllocation.objects.create(
            facture_produit=fp, stock_lot=lot, quantity=3,
            cost_price=lot.price_cost, selling_price=Decimal('100'),
        )

        resp = self.client.get(f'/api/challenges/{challenge.id}/classement/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # produits_count should be auto-calculated (at least produit1)
        self.assertGreaterEqual(resp.data['challenge']['produits_count'], 1)
        # point_tiers should be returned
        self.assertEqual(len(resp.data['challenge']['point_tiers']), 3)
        classement = resp.data['classement']
        # Equipe A should have 3 boites × 50 pts = 150 points
        entry_a = next(e for e in classement if e['entity_name'] == 'Equipe A')
        self.assertEqual(entry_a['points'], 150)

    def test_classement_retrocompatibility_old_challenge(self):
        """A challenge created without source_produits (default MANUEL) should still work."""
        challenge = Challenge.objects.create(
            nom='Old Style', date_debut=self.date_debut, date_fin=self.date_fin,
            statut='ENC', type_objectif='CA', mode='INDIVIDUEL', all_users=True,
            created_by=self.user,
        )
        challenge.produits.add(self.produit1)
        self._create_paid_facture(self.seller1, self.produit1, 2)

        resp = self.client.get(f'/api/challenges/{challenge.id}/classement/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['challenge']['source_produits'], 'MANUEL')
        self.assertEqual(len(resp.data['classement']), 1)

    def test_produits_peremption_endpoint(self):
        """The produits_peremption action should return near-expiry products."""
        # Lot expiring in 20 days (within 6 months)
        TestDataFactory.create_stock_lot(
            produit=self.produit1,
            quantity=10, quantity_remaining=10,
            date_expiration=self.today + timedelta(days=20),
        )
        # Lot expiring in 2 years (outside 6 months)
        TestDataFactory.create_stock_lot(
            produit=self.produit2,
            quantity=10, quantity_remaining=10,
            date_expiration=self.today + timedelta(days=730),
        )
        resp = self.client.get('/api/challenges/produits_peremption/', {'mois': '6'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data['count'], 1)
        produit_ids = [p['produit_id'] for p in resp.data['produits']]
        self.assertIn(self.produit1.id, produit_ids)
        self.assertNotIn(self.produit2.id, produit_ids)
