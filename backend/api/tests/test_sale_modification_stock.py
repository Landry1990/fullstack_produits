"""
Tests de la modification de vente validée — zone hypersensible.

Vérifie que la rectification d'une facture (endpoint `facture-modifier`) :
- restaure bien le stock de l'ancienne version,
- ré-alloue / décrémente le stock de la nouvelle version,
- crée les MouvementStock différentiels attendus (RETOUR si quantité réduite,
  SORTIE si augmentée),
- reste cohérente pour les produits gérés par lots
  (Produit.stock == somme des StockLot.quantity_remaining).
"""
from django.db.models import Sum
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Facture, FactureProduitAllocation, MouvementStock, StockLot
from api.tests.factories import TestDataFactory


class SaleModificationStockTestCase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(
            username="admin_modif_stock", password="adminpass123"
        )
        self.client.force_authenticate(user=self.user)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _make_sale(self, produit, quantity=3, prix=None):
        self.factory.create_session_caisse(user=self.user)
        client = self.factory.create_client()
        prix = prix if prix is not None else produit.selling_price
        payload = {
            "client": client.id,
            "produits": [
                {
                    "produit": produit.id,
                    "quantity": quantity,
                    "selling_price": str(prix),
                    "discount": "0",
                    "tva": "0",
                }
            ],
            "paiements": [{"mode": "especes", "montant": str(prix * quantity)}],
            "remise": "0",
            "type": "STD",
        }
        response = self.client.post(reverse("facture-finaliser"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        facture = Facture.objects.order_by("-id").first()
        self.assertIsNotNone(facture)
        assert facture is not None
        return facture

    def _modify(self, facture, lignes):
        payload = {
            "produits": [
                {
                    "produit": l["produit"].id,
                    "quantity": l["quantity"],
                    "selling_price": str(l.get("prix", l["produit"].selling_price)),
                    "discount": "0",
                    "tva": "0",
                }
                for l in lignes
            ],
            "remise": "0",
        }
        return self.client.post(
            reverse("facture-modifier", kwargs={"pk": facture.pk}),
            payload,
            format="json",
        )

    def _mvt(self, produit, type_mouvement):
        return (
            MouvementStock.objects.filter(produit=produit, type_mouvement=type_mouvement)
            .order_by("-date")
            .first()
        )

    # ------------------------------------------------------------------
    # 1. Augmentation de quantité -> SORTIE supplémentaire
    # ------------------------------------------------------------------
    def test_modification_augmente_quantite_cree_sortie(self):
        produit = self.factory.create_produit(stock=50)
        facture = self._make_sale(produit, quantity=3)
        produit.refresh_from_db()
        self.assertEqual(produit.stock, 47)

        response = self._modify(facture, [{"produit": produit, "quantity": 5}])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 45)

        mvt = self._mvt(produit, MouvementStock.TypeMouvement.SORTIE)
        self.assertIsNotNone(mvt)
        self.assertEqual(mvt.quantite, -2)
        self.assertEqual(mvt.facture_id, facture.id)

    # ------------------------------------------------------------------
    # 2. Diminution de quantité -> RETOUR
    # ------------------------------------------------------------------
    def test_modification_diminue_quantite_cree_retour(self):
        produit = self.factory.create_produit(stock=50)
        facture = self._make_sale(produit, quantity=5)
        produit.refresh_from_db()
        self.assertEqual(produit.stock, 45)

        response = self._modify(facture, [{"produit": produit, "quantity": 2}])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 48)

        mvt = self._mvt(produit, MouvementStock.TypeMouvement.RETOUR)
        self.assertIsNotNone(mvt)
        self.assertEqual(mvt.quantite, 3)
        self.assertEqual(mvt.facture_id, facture.id)

    # ------------------------------------------------------------------
    # 3. Remplacement produit A -> produit B
    # ------------------------------------------------------------------
    def test_modification_remplace_produit_restitue_a_et_sort_b(self):
        produit_a = self.factory.create_produit(name="Produit A", stock=30)
        produit_b = self.factory.create_produit(name="Produit B", stock=20)
        facture = self._make_sale(produit_a, quantity=4)
        produit_a.refresh_from_db()
        self.assertEqual(produit_a.stock, 26)

        response = self._modify(facture, [{"produit": produit_b, "quantity": 2}])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produit_a.refresh_from_db()
        produit_b.refresh_from_db()
        self.assertEqual(produit_a.stock, 30)
        self.assertEqual(produit_b.stock, 18)

        mvt_a = self._mvt(produit_a, MouvementStock.TypeMouvement.RETOUR)
        self.assertIsNotNone(mvt_a)
        self.assertEqual(mvt_a.quantite, 4)

        mvt_b = self._mvt(produit_b, MouvementStock.TypeMouvement.SORTIE)
        self.assertIsNotNone(mvt_b)
        self.assertEqual(mvt_b.quantite, -2)

    # ------------------------------------------------------------------
    # 4. Ajout d'un second produit à la facture
    # ------------------------------------------------------------------
    def test_modification_ajoute_produit_cree_sortie(self):
        produit_a = self.factory.create_produit(name="Produit A2", stock=30)
        produit_b = self.factory.create_produit(name="Produit B2", stock=20)
        facture = self._make_sale(produit_a, quantity=3)

        response = self._modify(
            facture,
            [
                {"produit": produit_a, "quantity": 3},
                {"produit": produit_b, "quantity": 4},
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produit_a.refresh_from_db()
        produit_b.refresh_from_db()
        self.assertEqual(produit_a.stock, 27)
        self.assertEqual(produit_b.stock, 16)

        mvt_b = self._mvt(produit_b, MouvementStock.TypeMouvement.SORTIE)
        self.assertIsNotNone(mvt_b)
        self.assertEqual(mvt_b.quantite, -4)

    # ------------------------------------------------------------------
    # 5. Produit géré par lots -> stock cohérent avec la somme des lots
    # ------------------------------------------------------------------
    def test_modification_produit_lots_stock_coherent(self):
        produit = self.factory.create_produit(stock=50, use_lot_management=True)
        self.factory.create_stock_lot(produit=produit, quantity=50, lot_name="LOT-MODIF")
        produit.calculate_stock_from_lots()
        facture = self._make_sale(produit, quantity=4)

        produit.refresh_from_db()
        total_lots = StockLot.objects.filter(produit=produit).aggregate(
            total=Sum("quantity_remaining")
        )["total"] or 0
        self.assertEqual(produit.stock, total_lots)
        self.assertEqual(produit.stock, 46)

        # Modifier : 4 -> 6
        response = self._modify(facture, [{"produit": produit, "quantity": 6}])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produit.refresh_from_db()
        total_lots = StockLot.objects.filter(produit=produit).aggregate(
            total=Sum("quantity_remaining")
        )["total"] or 0
        self.assertEqual(
            produit.stock,
            total_lots,
            f"Après modification: stock ({produit.stock}) != somme lots ({total_lots})",
        )
        self.assertEqual(produit.stock, 44)

        mvt = self._mvt(produit, MouvementStock.TypeMouvement.SORTIE)
        self.assertIsNotNone(mvt)
        self.assertEqual(mvt.quantite, -2)

    # ------------------------------------------------------------------
    # 6. Modification sans changement de quantité -> aucun mouvement nouveau
    # ------------------------------------------------------------------
    def test_modification_sans_changement_ne_cree_pas_mouvement(self):
        produit = self.factory.create_produit(stock=50)
        facture = self._make_sale(produit, quantity=3)

        nb_mouvements = MouvementStock.objects.filter(produit=produit).count()

        response = self._modify(facture, [{"produit": produit, "quantity": 3}])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 47)
        self.assertEqual(
            MouvementStock.objects.filter(produit=produit).count(),
            nb_mouvements,
            "Une modification sans delta ne doit pas créer de mouvement de stock",
        )

    # ------------------------------------------------------------------
    # 7. Annulation : les UG consommées sont restaurées exactement
    #    (pas d'UG fantôme quand la vente a pioché UG + payant)
    # ------------------------------------------------------------------
    def test_annulation_ne_cree_pas_ug_fantome(self):
        produit = self.factory.create_produit(stock=50, use_lot_management=True)
        # Lot : 50 unités dont 2 UG restantes (3 gratuites déjà vendues avant)
        lot = self.factory.create_stock_lot(
            produit=produit, quantity=50, lot_name="LOT-UG",
            quantity_paid=48, quantity_free=5, quantity_free_remaining=2,
        )
        produit.calculate_stock_from_lots()

        # Vente de 3 : consomme les 2 UG restantes + 1 payante
        facture = self._make_sale(produit, quantity=3)
        lot.refresh_from_db()
        self.assertEqual(lot.quantity_remaining, 47)
        self.assertEqual(lot.quantity_free_remaining, 0)

        # Vérifier que l'allocation a bien tracé 2 UG
        alloc = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        ).first()
        self.assertIsNotNone(alloc)
        self.assertEqual(alloc.quantity_free, 2)

        # Annulation : les 3 unités reviennent, mais seulement 2 UG
        response = self.client.post(
            reverse("facture-annuler", kwargs={"pk": facture.pk}),
            {"motif": "test"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        lot.refresh_from_db()
        self.assertEqual(lot.quantity_remaining, 50)
        self.assertEqual(
            lot.quantity_free_remaining, 2,
            "L'annulation ne doit restaurer que les 2 UG réellement consommées",
        )
