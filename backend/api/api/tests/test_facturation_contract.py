"""
Tests de contrat : valident que le payload frontend est accepte par l'endpoint
de finalisation (POST /api/factures/finaliser/).

Le payload frontend contient par ligne produit :
- produit (id)
- quantity
- selling_price (prix unitaire brut)
- discount (montant remise unitaire)
- tva (taux)
- lot_id (id du lot specifique, ou null)
- lot_allocations (liste d'allocations explicites par lot)

On verifie que l'endpoint accepte ce format et cree la facture correctement.
"""
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    MouvementStock,
    StockLot,
)
from .factories import TestDataFactory


class FacturationContractTests(APITestCase):
    """
    Tests de contrat frontend <-> backend pour l'endpoint finaliser.
    Simulent le payload exact envoye par useSaleCompletion.ts.
    """

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.rayon = TestDataFactory.create_rayon(name='Rayon Contract')
        self.fournisseur = TestDataFactory.create_fournisseur(
            name='Fournisseur Contract',
            email='contract-fournisseur@test.com',
            phone='0100000099',
        )
        self.produit = TestDataFactory.create_produit(
            name='Doliprane Contract', stock=50,
            cost_price=200, selling_price=500,
            rayon=self.rayon, fournisseur=self.fournisseur,
        )
        self.client_obj = TestDataFactory.create_client(
            name='Client Contract', email='contract@test.com', phone='0600000099',
        )
        # Session de caisse requise pour la finalisation
        self.session = TestDataFactory.create_session_caisse(user=self.user)

    def _frontend_payload(self, **overrides):
        """
        Construit un payload au format exact envoye par le frontend
        (cf. useSaleCompletion.ts -> finalPayload).
        """
        payload = {
            'client': self.client_obj.id,
            'client_name_override': None,
            'ayant_droit': None,
            'remise': '0',
            'produits': [{
                'produit': self.produit.id,
                'quantity': 3,
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
            'loyalty': {
                'use_pending_discount': False,
                'points_to_use': 0,
            },
            'ordonnance': None,
            'totals': {
                'totalTtc': 1500,
                'totalHt': 1500,
                'totalTva': 0,
            },
            'sudo': {
                'validated_by_id': None,
                'sudo_password': None,
            },
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

    def test_frontend_payload_accepted_creates_facture(self):
        """Le payload frontend standard est accepte et cree une facture validee."""
        url = reverse('facture-finaliser')
        payload = self._frontend_payload()
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        self.assertIsNotNone(facture)
        self.assertEqual(facture.status, Facture.Status.VALIDEE)
        self.assertTrue(facture.numero_facture.startswith('FAC-'))

        # Verifier la ligne de facture
        lines = FactureProduit.objects.filter(facture=facture)
        self.assertEqual(lines.count(), 1)
        self.assertEqual(lines.first().quantity, 3)
        self.assertEqual(lines.first().selling_price, Decimal('500.00'))

    def test_frontend_payload_with_lot_id(self):
        """Le payload frontend avec lot_id specifique cree une facture avec allocation de lot."""
        lot = TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=50, lot_name='LOT-CONTRACT-001',
        )
        self.produit.refresh_from_db()

        url = reverse('facture-finaliser')
        payload = self._frontend_payload(
            produits=[{
                'produit': self.produit.id,
                'quantity': 5,
                'selling_price': '500',
                'discount': '0',
                'tva': 0,
                'lot_id': lot.id,
                'lot_allocations': None,
                'is_promis': False,
                'promis_quantity': 0,
                'promis_phone': '',
            }],
            paiements=[{'mode': 'especes', 'montant': 2500}],
            totals={'totalTtc': 2500, 'totalHt': 2500, 'totalTva': 0},
            montant_verse='2500',
            montant_rendu='0',
        )
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        fp = FactureProduit.objects.filter(facture=facture).first()
        self.assertEqual(fp.stock_lot_id, lot.id)

        # L'allocation doit pointer vers le bon lot
        allocation = FactureProduitAllocation.objects.filter(facture_produit=fp).first()
        self.assertIsNotNone(allocation)
        self.assertEqual(allocation.stock_lot_id, lot.id)
        self.assertEqual(allocation.quantity, 5)

    def test_frontend_payload_multi_lot_with_lot_allocations(self):
        """
        Le payload frontend multi-lots avec lot_allocations explicites est accepte.
        Le frontend envoie une entree par lot avec lot_id et lot_allocations.
        """
        lot1 = TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=30, lot_name='LOT-CONTRACT-MULTI-1',
        )
        lot2 = TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=20, lot_name='LOT-CONTRACT-MULTI-2',
        )
        self.produit.refresh_from_db()

        url = reverse('facture-finaliser')
        # Le frontend envoie 2 entrees produit, une par lot
        payload = self._frontend_payload(
            produits=[
                {
                    'produit': self.produit.id,
                    'quantity': 3,
                    'selling_price': '500',
                    'discount': '0',
                    'tva': 0,
                    'lot_id': lot1.id,
                    'lot_allocations': [
                        {'lot_id': lot1.id, 'quantity': 3, 'selling_price': 500},
                    ],
                    'is_promis': False,
                    'promis_quantity': 0,
                    'promis_phone': '',
                },
                {
                    'produit': self.produit.id,
                    'quantity': 2,
                    'selling_price': '500',
                    'discount': '0',
                    'tva': 0,
                    'lot_id': lot2.id,
                    'lot_allocations': [
                        {'lot_id': lot2.id, 'quantity': 2, 'selling_price': 500},
                    ],
                    'is_promis': False,
                    'promis_quantity': 0,
                    'promis_phone': '',
                },
            ],
            paiements=[{'mode': 'especes', 'montant': 2500}],
            totals={'totalTtc': 2500, 'totalHt': 2500, 'totalTva': 0},
            montant_verse='2500',
            montant_rendu='0',
        )
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()

        # 2 lignes de facture avec des lots differents
        lines = FactureProduit.objects.filter(facture=facture).order_by('id')
        self.assertEqual(lines.count(), 2)
        self.assertEqual(lines[0].stock_lot_id, lot1.id)
        self.assertEqual(lines[1].stock_lot_id, lot2.id)

        # Allocations creees pour chaque lot
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        )
        self.assertEqual(allocations.count(), 2)
        alloc_lot_ids = set(allocations.values_list('stock_lot_id', flat=True))
        self.assertEqual(alloc_lot_ids, {lot1.id, lot2.id})

        # Mouvements de stock SORTIE crees
        mouvements = MouvementStock.objects.filter(facture=facture)
        self.assertGreaterEqual(mouvements.count(), 2)

    def test_frontend_payload_with_discount_and_tva(self):
        """Le payload frontend avec remise produit et TVA est accepte."""
        url = reverse('facture-finaliser')
        payload = self._frontend_payload(
            produits=[{
                'produit': self.produit.id,
                'quantity': 4,
                'selling_price': '500',
                'discount': '50',  # 50 F de remise unitaire
                'tva': 19.25,
                'lot_id': None,
                'lot_allocations': None,
                'is_promis': False,
                'promis_quantity': 0,
                'promis_phone': '',
            }],
            paiements=[{'mode': 'especes', 'montant': 1800}],
            totals={'totalTtc': 1800, 'totalHt': 1509, 'totalTva': 291},
            montant_verse='1800',
            montant_rendu='0',
        )
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        fp = FactureProduit.objects.filter(facture=facture).first()
        self.assertEqual(fp.quantity, 4)
        self.assertEqual(fp.selling_price, Decimal('500.00'))
        self.assertEqual(fp.discount, Decimal('50.00'))
        self.assertEqual(fp.tva, Decimal('19.25'))

    def test_frontend_payload_manual_client(self):
        """Le payload frontend avec client manuel (client=null, client_name_override) est accepte."""
        url = reverse('facture-finaliser')
        payload = self._frontend_payload(
            client=None,
            client_name_override='Client de passage',
        )
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        self.assertIsNone(facture.client)
        self.assertEqual(facture.client_name_override, 'Client de passage')

    def test_frontend_payload_with_global_remise(self):
        """Le payload frontend avec remise globale est accepte."""
        url = reverse('facture-finaliser')
        payload = self._frontend_payload(
            remise='300',
            paiements=[{'mode': 'especes', 'montant': 1200}],
            totals={'totalTtc': 1200, 'totalHt': 1200, 'totalTva': 0},
            montant_verse='1200',
            montant_rendu='0',
        )
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        facture = Facture.objects.order_by('-id').first()
        self.assertEqual(facture.remise, Decimal('300.00'))
        # 3 * 500 - 300 = 1200
        self.assertEqual(facture.total_ttc, Decimal('1200.00'))
