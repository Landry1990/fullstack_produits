from decimal import Decimal

from django.test import TestCase

from api.models import Client, DepotClient, LoyaltyHistory
from api.services.client_merger import find_duplicate_candidates, merge_clients
from api.tests.factories import TestDataFactory


class ClientMergeTests(TestCase):
    """Tests unitaires du service de fusion de clients."""

    def test_merge_clients_combines_points_depot_and_disables_source(self):
        """La fusion doit cumuler points/dépôt/fidélité et désactiver le client source."""
        source = TestDataFactory.create_client(
            name='Alice Dupont',
            phone='0699999999',
            points_fidelite=50,
            solde_depot=Decimal('5000.00'),
        )
        target = TestDataFactory.create_client(
            name='Alice D.',
            phone='0699999999',
            points_fidelite=30,
            solde_depot=Decimal('2000.00'),
        )

        # Créer un historique de fidélité et un dépôt liés à la source
        LoyaltyHistory.objects.create(
            client=source,
            type_transaction=LoyaltyHistory.TYPE_GAIN,
            points=50,
            solde_apres=50,
        )
        DepotClient.objects.create(
            client=source,
            type=DepotClient.Type.DEPOT,
            montant=Decimal('5000.00'),
        )

        merged_target, result = merge_clients(source.id, target.id)

        source.refresh_from_db()
        target.refresh_from_db()

        # Vérification des cumuls
        self.assertEqual(target.points_fidelite, 80)
        self.assertEqual(target.solde_depot, Decimal('7000.00'))

        # Vérification du résultat métier
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['target_id'], target.id)
        self.assertEqual(result['source_id'], source.id)

        # Le source est inactif et pointe vers la cible
        self.assertFalse(source.is_active)
        self.assertEqual(source.merged_into_id, target.id)
        self.assertIn(source, target.merged_from.all())

        # Les historiques ont été déplacés
        self.assertEqual(LoyaltyHistory.objects.filter(client=target).count(), 1)
        self.assertEqual(DepotClient.objects.filter(client=target).count(), 1)
        self.assertEqual(LoyaltyHistory.objects.filter(client=source).count(), 0)
        self.assertEqual(DepotClient.objects.filter(client=source).count(), 0)

    def test_find_duplicate_candidates_by_phone(self):
        """La détection par téléphone doit retourner le client existant."""
        existing = TestDataFactory.create_client(
            name='Bob Martin',
            phone='0611223344',
        )
        candidates = find_duplicate_candidates(name='Bob', phone='0611223344')

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]['id'], existing.id)
        self.assertEqual(candidates[0]['name'], existing.name)
