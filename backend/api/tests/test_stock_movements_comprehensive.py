from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Avoir,
    CommandeProduit,
    Facture,
    LigneAvoir,
    LigneInventaire,
    MouvementStock,
    RelationTransformation,
)
from api.tests.factories import TestDataFactory


class StockMovementsComprehensiveTestCase(TestCase):
    """
    Vérifie que chaque action métier qui doit bouger le stock :
    - modifie bien la quantité produit / lot / réserve
    - crée le MouvementStock attendu (type + quantité + stock_apres cohérent)
    """

    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(
            username="admin_stock_comp", password="adminpass123"
        )
        self.client.force_authenticate(user=self.user)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _latest_mvt(self, produit, type_mouvement):
        return (
            MouvementStock.objects.filter(produit=produit, type_mouvement=type_mouvement)
            .order_by("-date")
            .first()
        )

    def _get_latest_mvt(self, produit, type_mouvement):
        mvt = self._latest_mvt(produit, type_mouvement)
        self.assertIsNotNone(mvt)
        assert mvt is not None
        return mvt

    def _make_sale(self, produit, quantity=3, centralized=False):
        session = self.factory.create_session_caisse(user=self.user)
        client = self.factory.create_client()
        payload = {
            "client": client.id,
            "produits": [
                {
                    "produit": produit.id,
                    "quantity": quantity,
                    "selling_price": str(produit.selling_price),
                    "discount": "0",
                    "tva": "0",
                }
            ],
            "paiements": [{"mode": "especes", "montant": str(produit.selling_price * quantity)}],
            "remise": "0",
            "type": "STD",
            "centralized_cash_register": centralized,
        }
        if centralized:
            payload["session_caisse"] = session.id
        response = self.client.post(reverse("facture-finaliser"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        facture = Facture.objects.order_by("-id").first()
        self.assertIsNotNone(facture)
        assert facture is not None
        return facture

    # ------------------------------------------------------------------
    # 1. Réception commande fournisseur -> ENTREE
    # ------------------------------------------------------------------
    def test_commande_cloture_cree_entree_et_augmente_stock(self):
        produit = self.factory.create_produit(stock=0)
        fournisseur = produit.fournisseur
        commande = self.factory.create_commande(fournisseur=fournisseur, status="PREP")
        CommandeProduit.objects.create(
            commande=commande, produit=produit, quantity=40, price=produit.cost_price, price_cost=produit.cost_price
        )

        response = self.client.post(reverse("commande-cloturer", kwargs={"pk": commande.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 40)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.ENTREE)
        self.assertEqual(mvt.quantite, 40)
        self.assertEqual(mvt.stock_apres, 40)

    # ------------------------------------------------------------------
    # 2. Annulation réception commande -> AJUSTEMENT négatif
    # ------------------------------------------------------------------
    def test_commande_annuler_reception_cree_ajustement_negatif(self):
        produit = self.factory.create_produit(stock=0)
        fournisseur = produit.fournisseur
        commande = self.factory.create_commande(fournisseur=fournisseur, status="PREP")
        CommandeProduit.objects.create(
            commande=commande, produit=produit, quantity=25, price=produit.cost_price, price_cost=produit.cost_price, lot="LOT-ANN-01"
        )
        self.client.post(reverse("commande-cloturer", kwargs={"pk": commande.pk}))
        produit.refresh_from_db()
        self.assertEqual(produit.stock, 25)

        response = self.client.post(reverse("commande-annuler-reception", kwargs={"pk": commande.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 0)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertEqual(mvt.quantite, -25)
        self.assertEqual(mvt.stock_apres, 0)

    # ------------------------------------------------------------------
    # 3. Ajustement manuel -> AJUSTEMENT
    # ------------------------------------------------------------------
    def test_ajustement_stock_cree_ajustement(self):
        produit = self.factory.create_produit(stock=100)

        response = self.client.post(
            reverse("produit-adjust-stock", kwargs={"pk": produit.pk}),
            {"new_quantity": 85, "reason_type": "INVENTAIRE"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 85)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertEqual(mvt.quantite, -15)
        self.assertEqual(mvt.stock_apres, 85)

    # ------------------------------------------------------------------
    # 4. Transfert réserve -> rayon -> REAPPRO_INTERSTOCK (entrée + sortie)
    # ------------------------------------------------------------------
    def test_transfert_reserve_rayon_cree_reappro_et_bouge_reserves(self):
        produit = self.factory.create_produit(stock=0, stock_reserve=0, has_reserve_storage=True)
        fournisseur = produit.fournisseur
        commande = self.factory.create_commande(fournisseur=fournisseur, status="PREP")
        CommandeProduit.objects.create(
            commande=commande, produit=produit, quantity=50, price=produit.cost_price, price_cost=produit.cost_price
        )
        self.client.post(reverse("commande-cloturer", kwargs={"pk": commande.pk}))
        produit.refresh_from_db()

        response = self.client.post(
            reverse("produit-transfer-to-shelf", kwargs={"pk": produit.pk}),
            {"quantity": 20},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 20)
        self.assertEqual(produit.stock_reserve, 30)

        mvts = MouvementStock.objects.filter(
            produit=produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK
        )
        quantites = [m.quantite for m in mvts]
        self.assertIn(20, quantites)
        self.assertIn(-20, quantites)

    # ------------------------------------------------------------------
    # 5. Transformation -> TRANSFORMATION_SORTIE + TRANSFORMATION_ENTREE
    # ------------------------------------------------------------------
    def test_transformation_cree_sortie_et_entree_transformation(self):
        source = self.factory.create_produit(name="Source Box", stock=10, use_lot_management=True)
        self.factory.create_stock_lot(produit=source, quantity=10, lot_name="LOT-SOURCE")
        dest = self.factory.create_produit(name="Dest Plate", stock=0, use_lot_management=True)
        relation = RelationTransformation.objects.create(
            produit_source=source, produit_destination=dest, ratio=10
        )

        response = self.client.post(
            reverse("relationtransformation-transformer", args=[relation.id]),
            {"quantite": 2},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        source.refresh_from_db()
        dest.refresh_from_db()
        self.assertEqual(source.stock, 8)
        self.assertEqual(dest.stock, 20)

        mvt_sortie = self._get_latest_mvt(source, MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE)
        self.assertEqual(mvt_sortie.quantite, -2)

        mvt_entree = self._get_latest_mvt(dest, MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE)
        self.assertEqual(mvt_entree.quantite, 20)

    # ------------------------------------------------------------------
    # 6. Promis créé -> SORTIE (réservation du stock)
    # ------------------------------------------------------------------
    def test_promis_creation_reserve_stock_et_cree_sortie(self):
        produit = self.factory.create_produit(stock=20, use_lot_management=False)
        client = self.factory.create_client()
        response = self.client.post(
            reverse("promis-list"),
            {"produit": produit.id, "quantite": 5, "client": client.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 15)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.SORTIE)
        self.assertEqual(mvt.quantite, -5)
        self.assertEqual(mvt.stock_apres, 15)

    # ------------------------------------------------------------------
    # 7. Promis délivré -> confirmation sans nouveau mouvement (déjà réservé)
    # ------------------------------------------------------------------
    def test_promis_delivre_conserve_reservation(self):
        produit = self.factory.create_produit(stock=20, use_lot_management=False)
        client = self.factory.create_client()
        create_resp = self.client.post(
            reverse("promis-list"),
            {"produit": produit.id, "quantite": 5, "client": client.id},
            format="json",
        )
        promis_id = create_resp.data["id"]

        response = self.client.post(reverse("promis-delivrer", kwargs={"pk": promis_id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 15)
        self.assertEqual(
            MouvementStock.objects.filter(
                produit=produit, type_mouvement=MouvementStock.TypeMouvement.SORTIE
            ).count(),
            1,
        )

    # ------------------------------------------------------------------
    # 8. Promis annulé -> RETOUR (libération de la réservation)
    # ------------------------------------------------------------------
    def test_promis_annule_reintegre_stock_et_cree_retour(self):
        produit = self.factory.create_produit(stock=20, use_lot_management=False)
        client = self.factory.create_client()
        create_resp = self.client.post(
            reverse("promis-list"),
            {"produit": produit.id, "quantite": 5, "client": client.id},
            format="json",
        )
        promis_id = create_resp.data["id"]

        response = self.client.post(
            reverse("promis-annuler-et-reintegrer", kwargs={"pk": promis_id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 20)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.RETOUR)
        self.assertEqual(mvt.quantite, 5)
        self.assertEqual(mvt.stock_apres, 20)

    # ------------------------------------------------------------------
    # 9. Vente finalisée -> SORTIE
    # ------------------------------------------------------------------
    def test_vente_finalisee_diminue_stock_et_cree_sortie(self):
        produit = self.factory.create_produit(stock=50)
        self.factory.create_stock_lot(produit=produit, quantity=50, lot_name="LOT-VENTE")
        facture = self._make_sale(produit, quantity=3)
        self.assertIn(facture.status, [Facture.Status.VALIDEE, Facture.Status.PAYEE])

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 47)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.SORTIE)
        self.assertEqual(mvt.quantite, -3)
        self.assertEqual(mvt.stock_apres, 47)

    # ------------------------------------------------------------------
    # 10. Annulation vente -> RETOUR
    # ------------------------------------------------------------------
    def test_annulation_vente_restitue_stock_et_cree_retour(self):
        produit = self.factory.create_produit(stock=50)
        self.factory.create_stock_lot(produit=produit, quantity=50, lot_name="LOT-ANN-VENTE")
        facture = self._make_sale(produit, quantity=4)
        produit.refresh_from_db()
        self.assertEqual(produit.stock, 46)

        response = self.client.post(
            reverse("facture-annuler", kwargs={"pk": facture.pk}),
            {"motif": "erreur de saisie"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 50)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.RETOUR)
        self.assertEqual(mvt.quantite, 4)
        self.assertEqual(mvt.stock_apres, 50)

    # ------------------------------------------------------------------
    # 11. Avoir fournisseur déchargé -> AVOIR (sortie négative)
    # ------------------------------------------------------------------
    def test_avoir_fournisseur_decharge_diminue_stock_et_cree_avoir(self):
        produit = self.factory.create_produit(stock=30, use_lot_management=False)
        fournisseur = produit.fournisseur
        avoir = Avoir.objects.create(fournisseur=fournisseur, type_avoir="AUTRE", created_by=self.user)
        LigneAvoir.objects.create(avoir=avoir, produit=produit, quantity=5, price=produit.cost_price)

        response = self.client.post(reverse("avoir-decharger-stock", kwargs={"pk": avoir.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 25)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.AVOIR)
        self.assertEqual(mvt.quantite, -5)
        self.assertEqual(mvt.stock_apres, 25)

    # ------------------------------------------------------------------
    # 12. Sortie lot périmé -> AVOIR
    # ------------------------------------------------------------------
    def test_sortie_perimee_diminue_stock_et_cree_avoir(self):
        produit = self.factory.create_produit(stock=0, use_lot_management=True)
        lot = self.factory.create_stock_lot(produit=produit, quantity=12, lot_name="LOT-PERIME")
        produit.calculate_stock_from_lots()

        response = self.client.post(reverse("stocklot-sortir-perimes", kwargs={"pk": lot.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        lot.refresh_from_db()
        produit.refresh_from_db()
        self.assertEqual(lot.quantity_remaining, 0)
        self.assertEqual(produit.stock, 0)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.AVOIR)
        self.assertEqual(mvt.quantite, -12)

    # ------------------------------------------------------------------
    # 13. Inventaire validé -> AJUSTEMENT
    # ------------------------------------------------------------------
    def test_inventaire_valide_cree_ajustement_et_corrige_stock(self):
        produit = self.factory.create_produit(stock=100, use_lot_management=False)
        response = self.client.post(
            reverse("inventaire-list"), {"description": "Inventaire test", "inventory_type": "RAYON"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inv_id = response.data["id"]

        response = self.client.post(
            reverse("inventaire-pre-populate", args=[inv_id]),
            {"rayon_id": produit.rayon.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ligne = LigneInventaire.objects.get(inventaire_id=inv_id, produit=produit)
        ligne.quantite_physique = 92
        ligne.save()

        response = self.client.post(
            reverse("inventaire-validate", args=[inv_id]),
            {"sudo_password": "adminpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 92)

        mvt = self._get_latest_mvt(produit, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertEqual(mvt.quantite, -8)
        self.assertEqual(mvt.stock_apres, 92)

    # ------------------------------------------------------------------
    # 14. Proforma centralisée -> aucun mouvement de stock
    # ------------------------------------------------------------------
    def test_proforma_centralisee_ne_mouvemente_pas_le_stock(self):
        produit = self.factory.create_produit(stock=50)
        self.factory.create_stock_lot(produit=produit, quantity=50, lot_name="LOT-PROF")
        facture = self._make_sale(produit, quantity=3, centralized=True)
        self.assertEqual(facture.status, Facture.Status.PROFORMA)

        produit.refresh_from_db()
        self.assertEqual(produit.stock, 50)
        self.assertFalse(
            MouvementStock.objects.filter(produit=produit, facture=facture).exists()
        )
