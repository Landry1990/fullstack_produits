from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from api.models import (
    AvoirClient,
    AyantDroit,
    Caisse,
    Client,
    DepotClient,
    Facture,
    LoyaltyHistory,
    Promis,
    RelevePaiement,
    SmsLog,
    TreatmentReminder,
)
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
        )
        target = TestDataFactory.create_client(
            name='Alice D.',
            phone='0699999999',
            points_fidelite=30,
            solde_depot=Decimal('2000.00'),
        )

        # Créer un historique de fidélité et un dépôt liés à la source
        # (le dépôt met à jour solde_depot via le signal post_save)
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

    def test_merge_professional_clients_transfers_billing_and_related_history(self):
        """Deux pros avec ventes doivent être consolidés sur la cible."""
        source = TestDataFactory.create_client(
            name='Pharmacie Source',
            client_type='PROFESSIONNEL',
            phone='0611111111',
            points_fidelite=10,
        )
        target = TestDataFactory.create_client(
            name='Pharmacie Cible',
            client_type='PROFESSIONNEL',
            phone='0622222222',
            points_fidelite=5,
        )
        produit = TestDataFactory.create_produit(selling_price=2500)
        target_produit = TestDataFactory.create_produit(selling_price=1500)
        user = TestDataFactory.create_user()

        source_invoice = TestDataFactory.create_facture(
            client=source,
            status=Facture.Status.VALIDEE,
        )
        TestDataFactory.create_facture_produit(source_invoice, produit, quantity=2)
        target_invoice = TestDataFactory.create_facture(
            client=target,
            status=Facture.Status.VALIDEE,
        )
        TestDataFactory.create_facture_produit(target_invoice, target_produit, quantity=2)
        Caisse.objects.create(
            facture=target_invoice,
            mode_paiement='especes',
            montant=Decimal('1000.00'),
            statut='completee',
            user=user,
        )
        releve = RelevePaiement.objects.create(
            client=source,
            total_amount=Decimal('5000.00'),
            reference='REL-MERGE-001',
            statut=RelevePaiement.Statut.EMIS,
            montant_du=Decimal('5000.00'),
        )
        releve.factures.add(source_invoice)
        promis = Promis.objects.create(
            client=source,
            produit=produit,
            produit_nom=produit.name,
            quantite=2,
        )
        avoir = AvoirClient.objects.create(
            client=source,
            facture_origine=source_invoice,
            montant_total=Decimal('500.00'),
            statut=AvoirClient.Statut.VALIDEE,
        )
        DepotClient.objects.create(
            client=source,
            type=DepotClient.Type.DEPOT,
            montant=Decimal('2500.00'),
        )
        LoyaltyHistory.objects.create(
            client=source,
            facture=source_invoice,
            type_transaction=LoyaltyHistory.TYPE_GAIN,
            points=10,
            solde_apres=10,
        )
        SmsLog.objects.create(
            client=source,
            recipient_number='0611111111',
            message='Rappel paiement',
            type=SmsLog.Type.RELANCE,
        )
        TreatmentReminder.objects.create(
            client=source,
            produit=produit,
            produit_nom=produit.name,
            date_debut=timezone.now().date(),
            duree_jours=10,
            date_fin_prevue=timezone.now().date() + timezone.timedelta(days=10),
        )

        source_beneficiary = AyantDroit.objects.create(
            client=source,
            matricule='MAT-001',
            nom='Employé Source',
        )
        target_beneficiary = AyantDroit.objects.create(
            client=target,
            matricule='MAT-001',
            nom='Employé Cible',
        )
        source_invoice.ayant_droit = source_beneficiary
        source_invoice.save(update_fields=['ayant_droit'])
        unique_beneficiary = AyantDroit.objects.create(
            client=source,
            matricule='MAT-002',
            nom='Autre bénéficiaire',
        )

        merged_target, result = merge_clients(source.id, target.id)

        source.refresh_from_db()
        target.refresh_from_db()
        source_invoice.refresh_from_db()
        target_invoice.refresh_from_db()
        releve.refresh_from_db()
        promis.refresh_from_db()
        avoir.refresh_from_db()
        unique_beneficiary.refresh_from_db()

        self.assertEqual(source_invoice.client_id, target.id)
        self.assertEqual(target_invoice.client_id, target.id)
        self.assertEqual(source_invoice.ayant_droit_id, target_beneficiary.id)
        self.assertEqual(unique_beneficiary.client_id, target.id)
        self.assertFalse(AyantDroit.objects.filter(id=source_beneficiary.id).exists())
        self.assertEqual(releve.client_id, target.id)
        self.assertEqual(promis.client_id, target.id)
        self.assertEqual(avoir.client_id, target.id)
        self.assertEqual(DepotClient.objects.filter(client=target).count(), 1)
        self.assertEqual(LoyaltyHistory.objects.filter(client=target).count(), 1)
        self.assertEqual(SmsLog.objects.filter(client=target).count(), 1)
        self.assertEqual(TreatmentReminder.objects.filter(client=target).count(), 1)

        self.assertFalse(source.is_active)
        self.assertEqual(source.merged_into_id, target.id)
        self.assertEqual(source.points_fidelite, 0)
        self.assertEqual(source.solde_depot, Decimal('0.00'))
        self.assertEqual(source.solde_factures, Decimal('0.00'))
        self.assertEqual(source.nombre_factures_impayees, 0)

        self.assertEqual(target.points_fidelite, 15)
        self.assertEqual(target.solde_depot, Decimal('2500.00'))
        self.assertEqual(target.solde_factures, Decimal('7000.00'))
        self.assertEqual(target.nombre_factures_impayees, 2)
        self.assertEqual(merged_target.id, target.id)
        self.assertEqual(result['transferred']['factures'], 1)
        self.assertEqual(result['transferred']['ayants_droit'], 1)
        self.assertEqual(result['transferred']['ayants_droit_dedupliques'], 1)

    def test_merge_clients_rejects_different_client_types(self):
        """Un particulier ne doit pas être fusionné dans un professionnel."""
        source = TestDataFactory.create_client(client_type='PARTICULIER')
        target = TestDataFactory.create_client(client_type='PROFESSIONNEL')

        with self.assertRaisesMessage(
            ValueError,
            'Seuls deux clients du même type peuvent être fusionnés.',
        ):
            merge_clients(source.id, target.id)

    def test_find_duplicate_candidates_filters_type_and_inactive(self):
        """Les candidats proposés doivent être actifs et du même type."""
        pro = TestDataFactory.create_client(
            name='Pharma Pro',
            client_type='PROFESSIONNEL',
            phone='0633333333',
        )
        TestDataFactory.create_client(
            name='Pharma Pro',
            client_type='PARTICULIER',
            phone='0633333333',
        )
        inactive = TestDataFactory.create_client(
            name='Pharma Pro Inactive',
            client_type='PROFESSIONNEL',
            phone='0644444444',
        )
        inactive.is_active = False
        inactive.save(update_fields=['is_active'])

        candidates = find_duplicate_candidates(
            name='Pharma Pro',
            phone='0633333333',
            client_type='PROFESSIONNEL',
        )

        self.assertEqual([candidate['id'] for candidate in candidates], [pro.id])
