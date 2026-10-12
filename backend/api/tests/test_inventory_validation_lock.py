"""
Tests de non-régression : validation d'inventaire et intégrité des écritures.

Le chemin d'erreur (inventaire déjà validé, inventaire vide) ne doit
persister aucune écriture partielle : le return depuis le bloc
transaction.atomic() doit être précédé de transaction.set_rollback(True).
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Inventaire,
    LigneInventaire,
    MouvementStock,
    StockAdjustment,
)
from api.tests.factories import TestDataFactory


class InventoryValidationLockTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(
            username='admin_inv_lock', password='password'
        )
        self.client.force_authenticate(user=self.user)
        self.fournisseur = self.factory.create_fournisseur(
            name="F-Lock", email="flock@test.com", phone="999999999"
        )
        self.produit = self.factory.create_produit(
            name="Lock Product", stock=50, use_lot_management=True,
            fournisseur=self.fournisseur,
        )
        self.lot = self.factory.create_stock_lot(
            produit=self.produit, quantity=50, lot_name="LOT-LOCK-01"
        )

    def _create_inventory_with_line(self, quantite_physique):
        inventaire = Inventaire.objects.create(created_by=self.user)
        LigneInventaire.objects.create(
            inventaire=inventaire,
            produit=self.produit,
            stock_lot=self.lot,
            stock_theorique=50,
            quantite_physique=quantite_physique,
        )
        return inventaire

    def test_double_validation_does_not_persist_partial_writes(self):
        """Valider un inventaire → 200 ; re-valider le même → erreur propre
        et aucune écriture partielle (quantités/lots inchangés)."""
        inventaire = self._create_inventory_with_line(60)
        url = reverse('inventaire-validate', args=[inventaire.id])

        # 1ère validation : succès, stock/lot réécrits sur la valeur physique
        res1 = self.client.post(url, {'sudo_password': 'password'})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        self.produit.refresh_from_db()
        self.lot.refresh_from_db()
        self.assertEqual(self.produit.stock, 60)
        self.assertEqual(self.lot.quantity_remaining, 60)

        mouvements_count = MouvementStock.objects.filter(inventaire=inventaire).count()
        adjustments_count = StockAdjustment.objects.filter(produit=self.produit).count()
        self.assertGreater(mouvements_count, 0)
        self.assertGreater(adjustments_count, 0)

        # 2e validation : le check de statut (sous select_for_update) doit
        # renvoyer une erreur propre...
        res2 = self.client.post(url, {'sudo_password': 'password'})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', res2.data)

        # ...et ne rien réécrire : ni quantités, ni traçabilité en double.
        self.produit.refresh_from_db()
        self.lot.refresh_from_db()
        inventaire.refresh_from_db()
        self.assertEqual(self.produit.stock, 60)
        self.assertEqual(self.lot.quantity_remaining, 60)
        self.assertEqual(inventaire.status, Inventaire.Status.VALIDEE)
        self.assertEqual(
            MouvementStock.objects.filter(inventaire=inventaire).count(),
            mouvements_count,
        )
        self.assertEqual(
            StockAdjustment.objects.filter(produit=self.produit).count(),
            adjustments_count,
        )

    def test_validate_empty_inventory_returns_error_without_writes(self):
        """Un inventaire sans lignes → 400 ; l'inventaire reste EN_COURS
        et aucun mouvement/ajustement n'est créé."""
        inventaire = Inventaire.objects.create(created_by=self.user)
        url = reverse('inventaire-validate', args=[inventaire.id])

        res = self.client.post(url, {'sudo_password': 'password'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        inventaire.refresh_from_db()
        self.assertEqual(inventaire.status, Inventaire.Status.EN_COURS)
        self.assertFalse(MouvementStock.objects.filter(inventaire=inventaire).exists())
        self.assertFalse(StockAdjustment.objects.filter(produit=self.produit).exists())
