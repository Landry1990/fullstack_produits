"""
Tests de non-régression pour les optimisations du module inventaire :
- POST /api/inventaires/{id}/lignes/bulk/ : N+1 corrigé + lignes renvoyées
- POST /api/inventaires/{id}/pre_populate/ : N+1 corrigé (prefetch filtré)
- POST /api/inventaires/{id}/import-csv/ : parsing serveur + matching CIP
"""
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Inventaire, LigneInventaire
from api.tests.factories import TestDataFactory

# Borne haute de requêtes SQL tolérée pour un bulk de ~10 lignes :
# auth + middleware + pré-chargements + bulk_create/bulk_update + audit.
# L'ancien code faisait ~2 requêtes PAR ligne (filter().first() + save()).
MAX_BULK_QUERIES = 40
# Borne pour pre_populate : produits + prefetch lots + lignes existantes
# + bulk_create + audit. L'ancien code faisait 1 requête PAR produit à lots.
MAX_PREPOPULATE_QUERIES = 25


class InventaireBulkLignesTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_bulk_test', password='password')
        self.client.force_authenticate(user=self.user)
        self.fournisseur = self.factory.create_fournisseur(name='FB', email='fb@test.com', phone='333333333')
        self.rayon = self.factory.create_rayon()
        self.inventaire = Inventaire.objects.create(
            description='Inv bulk', inventory_type=Inventaire.TypeStock.RAYON
        )
        self.produits = [
            self.factory.create_produit(
                name=f'ProdBulk {i}', stock=10 + i,
                use_lot_management=False,
                fournisseur=self.fournisseur,
                rayon=self.rayon,
            )
            for i in range(10)
        ]
        self.url = reverse('inventaire-bulk-lignes', args=[self.inventaire.id])

    def test_bulk_returns_created_lignes(self):
        """La réponse du bulk contient les lignes sérialisées (pas de refetch client)."""
        payload = {'lignes': [
            {'produit': p.id, 'quantite_physique': 7} for p in self.produits[:3]
        ]}
        res = self.client.post(self.url, payload, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['imported'], 3)
        self.assertIn('lignes', res.data)
        self.assertEqual(len(res.data['lignes']), 3)

        returned_ids = {l['id'] for l in res.data['lignes']}
        db_ids = set(
            LigneInventaire.objects
            .filter(inventaire=self.inventaire)
            .values_list('id', flat=True)
        )
        self.assertEqual(returned_ids, db_ids)

        ligne = res.data['lignes'][0]
        for field in ('id', 'produit', 'produit_nom', 'stock_theorique',
                      'quantite_physique', 'ecart'):
            self.assertIn(field, ligne)
        self.assertEqual(ligne['quantite_physique'], 7)

    def test_bulk_merges_existing_lignes_in_one_update(self):
        """Les lignes déjà présentes sont fusionnées et renvoyées mises à jour."""
        for p in self.produits:
            LigneInventaire.objects.create(
                inventaire=self.inventaire, produit=p,
                stock_theorique=10, quantite_physique=10,
            )

        payload = {'lignes': [
            {'produit': p.id, 'quantite_physique': 2} for p in self.produits
        ]}
        res = self.client.post(self.url, payload, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data['lignes']), 10)
        for p in self.produits:
            ligne = LigneInventaire.objects.get(inventaire=self.inventaire, produit=p)
            self.assertEqual(ligne.quantite_physique, 12)  # 10 + 2 cumulé

    def test_bulk_duplicate_keys_in_payload_merge(self):
        """Deux entrées du payload pour le même produit cumulent sur une seule ligne."""
        p = self.produits[0]
        payload = {'lignes': [
            {'produit': p.id, 'quantite_physique': 3},
            {'produit': p.id, 'quantite_physique': 4},
        ]}
        res = self.client.post(self.url, payload, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        ligne = LigneInventaire.objects.get(inventaire=self.inventaire, produit=p)
        self.assertEqual(ligne.quantite_physique, 7)
        self.assertEqual(LigneInventaire.objects.filter(inventaire=self.inventaire).count(), 1)

    def test_bulk_query_count_is_bounded(self):
        """N+1 régression : le nombre de requêtes ne doit pas croître avec les lignes."""
        for p in self.produits:
            LigneInventaire.objects.create(
                inventaire=self.inventaire, produit=p,
                stock_theorique=10, quantite_physique=10,
            )
        payload = {'lignes': [
            {'produit': p.id, 'quantite_physique': 1} for p in self.produits
        ]}

        # Warm-up : middleware, caches de licence, etc.
        self.client.post(self.url, {'lignes': []}, format='json')

        with CaptureQueriesContext(connection) as ctx:
            res = self.client.post(self.url, payload, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertLess(
            len(ctx), MAX_BULK_QUERIES,
            f'Trop de requêtes pour 10 lignes : {len(ctx)}'
        )


class InventairePrePopulateTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_prepop_test', password='password')
        self.client.force_authenticate(user=self.user)
        self.fournisseur = self.factory.create_fournisseur(name='FP', email='fp@test.com', phone='444444444')
        self.rayon = self.factory.create_rayon()

        # 8 produits gérés par lot, 2 lots chacun → ancien code = 8 requêtes N+1
        for i in range(8):
            produit = self.factory.create_produit(
                name=f'ProdLot {i}', stock=20,
                use_lot_management=True,
                fournisseur=self.fournisseur,
                rayon=self.rayon,
            )
            for j in range(2):
                self.factory.create_stock_lot(
                    produit, quantity=10, lot_name=f'LOT-{i}-{j}',
                )

    def test_pre_populate_creates_lignes_without_n_plus_1(self):
        # Inventaire de warm-up : remplit les caches éventuels du middleware
        warmup_inv = Inventaire.objects.create(inventory_type=Inventaire.TypeStock.RAYON)
        self.client.post(
            reverse('inventaire-pre-populate', args=[warmup_inv.id]), {}, format='json'
        )

        inventaire = Inventaire.objects.create(inventory_type=Inventaire.TypeStock.RAYON)
        url = reverse('inventaire-pre-populate', args=[inventaire.id])

        with CaptureQueriesContext(connection) as ctx:
            res = self.client.post(url, {'rayon_id': self.rayon.id}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # 8 produits × 2 lots = 16 lignes
        self.assertEqual(
            LigneInventaire.objects.filter(inventaire=inventaire).count(), 16
        )
        self.assertLess(
            len(ctx), MAX_PREPOPULATE_QUERIES,
            f'Trop de requêtes pour pre_populate : {len(ctx)}'
        )


class InventaireImportCsvTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_csv_test', password='password')
        self.client.force_authenticate(user=self.user)
        self.fournisseur = self.factory.create_fournisseur(name='FC', email='fc@test.com', phone='555555555')
        self.rayon = self.factory.create_rayon()
        self.inventaire = Inventaire.objects.create(
            description='Inv csv', inventory_type=Inventaire.TypeStock.RAYON
        )
        self.p1 = self.factory.create_produit(
            name='ProdCsv1', stock=10, use_lot_management=False,
            fournisseur=self.fournisseur, rayon=self.rayon, cip1='3400912345678'
        )
        self.p2 = self.factory.create_produit(
            name='ProdCsv2', stock=20, use_lot_management=False,
            fournisseur=self.fournisseur, rayon=self.rayon, cip1='03400987654321'
        )
        self.url = reverse('inventaire-import-csv', args=[self.inventaire.id])

    def _upload(self, content: str):
        f = SimpleUploadedFile('import.csv', content.encode('utf-8'), content_type='text/csv')
        return self.client.post(self.url, {'file': f}, format='multipart')

    def test_import_csv_with_headers(self):
        res = self._upload('cip;quantite\n3400912345678;5\n')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['imported'], 1)
        self.assertIn('lignes', res.data)
        self.assertEqual(len(res.data['lignes']), 1)
        ligne = LigneInventaire.objects.get(inventaire=self.inventaire, produit=self.p1)
        self.assertEqual(ligne.quantite_physique, 5)

    def test_import_csv_headerless_positional(self):
        """Fichier sans en-tête : la première ligne est une donnée, pas un header."""
        res = self._upload('3400912345678;5\n03400987654321;4\n')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['imported'], 2)
        self.assertEqual(LigneInventaire.objects.filter(inventaire=self.inventaire).count(), 2)

    def test_import_csv_normalizes_cip(self):
        """CIP avec espaces/tirets ou sans zéros de tête doivent matcher."""
        res = self._upload('3400 912 345-678;3\n3400987654321;2\n')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['imported'], 2)
        ligne1 = LigneInventaire.objects.get(inventaire=self.inventaire, produit=self.p1)
        ligne2 = LigneInventaire.objects.get(inventaire=self.inventaire, produit=self.p2)
        self.assertEqual(ligne1.quantite_physique, 3)
        self.assertEqual(ligne2.quantite_physique, 2)  # match via zéros de tête supprimés

    def test_import_csv_not_found_and_merge_existing(self):
        """CIP inconnu → not_found pour le rapport ; CIP existant → fusion."""
        LigneInventaire.objects.create(
            inventaire=self.inventaire, produit=self.p1,
            stock_theorique=10, quantite_physique=10,
        )
        res = self._upload('cip;quantite\n3400912345678;3\n9999999999999;7\n')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        ligne = LigneInventaire.objects.get(inventaire=self.inventaire, produit=self.p1)
        self.assertEqual(ligne.quantite_physique, 13)  # 10 + 3 fusionné
        self.assertEqual(res.data['not_found'], [{'cip': '9999999999999', 'quantite': 7}])
        self.assertEqual(len(res.data['lignes']), 1)

    def test_import_csv_rejected_on_validated_inventaire(self):
        self.inventaire.status = Inventaire.Status.VALIDEE
        self.inventaire.save(update_fields=['status'])
        res = self._upload('cip;quantite\n3400912345678;5\n')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_import_csv_no_valid_product(self):
        res = self._upload('cip;quantite\n9999999999999;7\n')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['not_found'], [{'cip': '9999999999999', 'quantite': 7}])
