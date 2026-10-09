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
    Promis,
    StockLot,
    StockObligation,
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

    def test_promis_marks_stock_negative_without_lots(self):
        self.produit.use_lot_management = False
        self.produit.stock = 1
        self.produit.save(update_fields=['use_lot_management', 'stock'])
        payload = self._frontend_payload(
            produits=[{
                'produit': self.produit.id,
                'quantity': 2,
                'selling_price': '500',
                'discount': '0',
                'tva': 0,
                'lot_id': None,
                'lot_allocations': None,
                'is_promis': True,
                'promis_quantity': 1,
                'promis_phone': '0600000099',
            }],
            paiements=[{'mode': 'especes', 'montant': 1000}],
            totals={'totalTtc': 1000, 'totalHt': 1000, 'totalTva': 0},
            montant_verse='1000',
        )

        response = self.client.post(reverse('facture-finaliser'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        facture = Facture.objects.order_by('-id').first()
        self.produit.refresh_from_db()
        self.assertEqual(FactureProduit.objects.get(facture=facture).quantity, 2)
        self.assertEqual(Promis.objects.get(facture=facture).quantite, 1)
        self.assertEqual(self.produit.stock, -1)
        self.assertEqual(MouvementStock.objects.get(facture=facture).quantite, -2)
        obligation = StockObligation.objects.get(facture=facture)
        self.assertEqual(obligation.type, StockObligation.TypeObligation.PROMIS)
        self.assertEqual(obligation.quantity_remaining, 1)
        self.assertTrue(obligation.stock_applied)

    def test_promis_marks_stock_negative_with_lot(self):
        self.produit.use_lot_management = True
        self.produit.stock = 0
        self.produit.save(update_fields=['use_lot_management', 'stock'])
        lot = TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=1, lot_name='LOT-PROMIS-001',
        )
        payload = self._frontend_payload(
            produits=[{
                'produit': self.produit.id,
                'quantity': 2,
                'selling_price': '500',
                'discount': '0',
                'tva': 0,
                'lot_id': lot.id,
                'lot_allocations': None,
                'is_promis': True,
                'promis_quantity': 1,
                'promis_phone': '0600000099',
            }],
            paiements=[{'mode': 'especes', 'montant': 1000}],
            totals={'totalTtc': 1000, 'totalHt': 1000, 'totalTva': 0},
            montant_verse='1000',
        )

        response = self.client.post(reverse('facture-finaliser'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        facture = Facture.objects.order_by('-id').first()
        lot.refresh_from_db()
        self.produit.refresh_from_db()
        delivered_allocation = FactureProduitAllocation.objects.get(
            facture_produit__facture=facture,
            stock_lot=lot,
        )
        pending_allocation = FactureProduitAllocation.objects.get(
            facture_produit__facture=facture,
            stock_lot__isnull=True,
        )
        self.assertEqual(FactureProduit.objects.get(facture=facture).quantity, 2)
        self.assertEqual(Promis.objects.get(facture=facture).quantite, 1)
        self.assertEqual(delivered_allocation.quantity, 1)
        self.assertEqual(pending_allocation.quantity, 1)
        self.assertTrue(pending_allocation.is_pending)
        self.assertEqual(lot.quantity_remaining, 0)
        self.assertEqual(self.produit.stock, -1)
        self.assertEqual(MouvementStock.objects.get(facture=facture).quantite, -2)
        obligation = StockObligation.objects.get(facture=facture)
        self.assertEqual(obligation.type, StockObligation.TypeObligation.PROMIS)
        self.assertEqual(obligation.quantity_remaining, 1)

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

    def _create_proforma(self, quantity=3, selling_price='500', stock_lot=None):
        """Cree un devis (PROFORMA) directement en base, comme handleProforma."""
        facture = Facture.objects.create(
            status=Facture.Status.PROFORMA,
            client=self.client_obj,
        )
        FactureProduit.objects.create(
            facture=facture,
            produit=self.produit,
            quantity=quantity,
            selling_price=Decimal(selling_price),
            discount=Decimal('0'),
            tva=Decimal('0'),
            stock_lot=stock_lot,
        )
        return facture

    def _payload_for_line(self, quantity=3, lot_id=None):
        return {
            'produit': self.produit.id,
            'quantity': quantity,
            'selling_price': '500',
            'discount': '0',
            'tva': 0,
            'lot_id': lot_id,
            'lot_allocations': None,
            'is_promis': False,
            'promis_quantity': 0,
            'promis_phone': '',
        }

    def test_proforma_conversion_in_place_dev_becomes_fac(self):
        """
        Rappel d'un devis : finaliser avec existing_id convertit le MEME
        document — DEV-XXXXXX -> FAC-XXXXXX, lignes remplacees (pas dupliquees),
        stock decremente une seule fois. Le numero FAC pris est le prochain
        de la sequence factures : un devis converti tardivement reste
        chronologique (un FAC emis entre-temps garde un numero inferieur).
        """
        proforma = self._create_proforma(quantity=3)
        self.assertTrue(proforma.numero_facture.startswith('DEV-'))
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 50)  # le devis ne touche pas le stock

        # Une vente normale entre la creation du devis et son retour
        response = self.client.post(
            reverse('facture-finaliser'), self._frontend_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        fac_entre_temps = Facture.objects.filter(status=Facture.Status.VALIDEE).order_by('-id').first()

        payload = self._frontend_payload(
            produits=[self._payload_for_line(quantity=4)],  # quantite modifiee au retour
            paiements=[{'mode': 'especes', 'montant': 2000}],
            totals={'totalTtc': 2000, 'totalHt': 2000, 'totalTva': 0},
            montant_verse='2000',
            existing_id=proforma.id,
        )
        response = self.client.post(reverse('facture-finaliser'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        proforma.refresh_from_db()
        self.assertEqual(proforma.status, Facture.Status.VALIDEE)
        self.assertTrue(proforma.numero_facture.startswith('FAC-'))
        # Le numero pris a la conversion est le SUIVANT de la sequence,
        # pas FAC-{id} — il est donc superieur a la facture emise entre-temps
        self.assertGreater(
            int(proforma.numero_facture.split('-')[1]),
            int(fac_entre_temps.numero_facture.split('-')[1]),
        )

        # Lignes remplacees, pas dupliquees
        lines = FactureProduit.objects.filter(facture=proforma)
        self.assertEqual(lines.count(), 1)
        self.assertEqual(lines.first().quantity, 4)

        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 43)

    def test_devis_and_facture_have_own_numbering(self):
        """DEV- et FAC- suivent chacun leur propre sequence."""
        d1 = self._create_proforma(quantity=1)
        d2 = self._create_proforma(quantity=2)
        self.assertTrue(d1.numero_facture.startswith('DEV-'))
        self.assertTrue(d2.numero_facture.startswith('DEV-'))
        # Sequence propre, croissante, independante des ids de factures
        self.assertGreater(
            int(d2.numero_facture.split('-')[1]),
            int(d1.numero_facture.split('-')[1]),
        )
        self.assertEqual(d1.numero_facture, 'DEV-000001')
        self.assertEqual(d2.numero_facture, 'DEV-000002')

        response = self.client.post(
            reverse('facture-finaliser'), self._frontend_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        facture = Facture.objects.filter(status=Facture.Status.VALIDEE).order_by('-id').first()
        self.assertEqual(facture.numero_facture, 'FAC-000001')

    def test_proforma_conversion_with_restored_lot(self):
        """Le lot choisi au devis est realloue a la conversion s'il est encore disponible."""
        self.produit.use_lot_management = True
        self.produit.stock = 0
        self.produit.save(update_fields=['use_lot_management', 'stock'])
        lot = TestDataFactory.create_stock_lot(
            produit=self.produit, quantity=10, lot_name='LOT-DEVIS-001',
        )
        proforma = self._create_proforma(quantity=2, stock_lot=lot)

        payload = self._frontend_payload(
            produits=[self._payload_for_line(quantity=2, lot_id=lot.id)],
            paiements=[{'mode': 'especes', 'montant': 1000}],
            totals={'totalTtc': 1000, 'totalHt': 1000, 'totalTva': 0},
            montant_verse='1000',
            existing_id=proforma.id,
        )
        response = self.client.post(reverse('facture-finaliser'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lot.refresh_from_db()
        self.assertEqual(lot.quantity_remaining, 8)
        allocation = FactureProduitAllocation.objects.get(facture_produit__facture=proforma)
        self.assertEqual(allocation.stock_lot_id, lot.id)
        self.assertEqual(allocation.quantity, 2)

    def test_proforma_double_conversion_rejected(self):
        """Un devis deja converti (statut VAL) ne peut pas etre re-finalise."""
        proforma = self._create_proforma(quantity=3)

        payload = self._frontend_payload(
            paiements=[{'mode': 'especes', 'montant': 1500}],
            existing_id=proforma.id,
        )
        response = self.client.post(reverse('facture-finaliser'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Seconde tentative de conversion sur la facture desormais validee
        response = self.client.post(reverse('facture-finaliser'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Le stock n'a ete decremente qu'une seule fois
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 47)

    def test_existing_id_on_validated_invoice_rejected(self):
        """existing_id pointant sur une facture payee/validee est rejete (garde statut)."""
        response = self.client.post(
            reverse('facture-finaliser'), self._frontend_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        facture = Facture.objects.order_by('-id').first()
        self.assertEqual(facture.status, Facture.Status.VALIDEE)

        payload = self._frontend_payload(existing_id=facture.id)
        response = self.client.post(reverse('facture-finaliser'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # La facture et son stock sont intacts
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.VALIDEE)
        self.assertEqual(FactureProduit.objects.filter(facture=facture).count(), 1)

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
