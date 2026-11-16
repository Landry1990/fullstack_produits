from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Commande,
    CommandeProduit,
    FactureProduitAllocation,
    MouvementStock,
    PaiementFournisseur,
    StockLot,
)
from api.tests.factories import TestDataFactory


class AnnulationPartielleReceptionTestCase(TestCase):
    """Annulation partielle de réception : item_ids, updates, delete_item_ids."""

    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(
            username="admin_annul_part", password="adminpass123"
        )
        self.client.force_authenticate(user=self.user)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _make_closed_commande(self, quantities):
        """Crée une commande clôturée avec `quantities` lignes (produits
        en gestion par lots → StockLot liés à chaque CommandeProduit)."""
        produits = []
        items = []
        commande = None
        for i, qty in enumerate(quantities):
            produit = self.factory.create_produit(
                stock=0, use_lot_management=True,
                name=f"ProdAP_{i}_{qty}",
            )
            if commande is None:
                commande = self.factory.create_commande(
                    fournisseur=produit.fournisseur, status="PREP"
                )
            item = CommandeProduit.objects.create(
                commande=commande, produit=produit, quantity=qty,
                price=produit.cost_price, price_cost=produit.cost_price,
            )
            produits.append(produit)
            items.append(item)
        response = self.client.post(
            reverse("commande-cloturer", kwargs={"pk": commande.pk})
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        for p in produits:
            p.refresh_from_db()
        return commande, produits, items

    def _annuler(self, commande, payload=None):
        return self.client.post(
            reverse("commande-annuler-reception", kwargs={"pk": commande.pk}),
            payload or {}, format="json",
        )

    # ------------------------------------------------------------------
    # 1. Annuler une ligne parmi plusieurs : les autres sont intactes
    # ------------------------------------------------------------------
    def test_annuler_une_ligne_preserve_les_autres(self):
        commande, produits, items = self._make_closed_commande([20, 30])
        p1, p2 = produits
        self.assertEqual(p1.stock, 20)
        self.assertEqual(p2.stock, 30)

        response = self._annuler(commande, {"item_ids": [items[0].id]})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        p1.refresh_from_db()
        p2.refresh_from_db()
        items[0].refresh_from_db()
        items[1].refresh_from_db()
        commande.refresh_from_db()

        # Ligne annulée : stock retiré, lots supprimés, ligne marquée à 0
        self.assertEqual(p1.stock, 0)
        self.assertEqual(items[0].quantity_received, 0)
        self.assertEqual(items[0].unites_gratuites, 0)
        self.assertFalse(StockLot.objects.filter(commande_produit=items[0]).exists())

        # Ligne intacte
        self.assertEqual(p2.stock, 30)
        self.assertIsNone(items[1].quantity_received)
        self.assertTrue(StockLot.objects.filter(commande_produit=items[1]).exists())

        # La commande reste clôturée (il reste une ligne reçue)
        self.assertEqual(commande.status, Commande.Status.CLOTUREE)

        # Mouvement négatif uniquement sur le produit annulé
        mvt = MouvementStock.objects.filter(
            produit=p1, type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT
        ).order_by("-date").first()
        self.assertIsNotNone(mvt)
        self.assertEqual(mvt.quantite, -20)
        self.assertFalse(
            MouvementStock.objects.filter(
                produit=p2, type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT
            ).exists()
        )

    # ------------------------------------------------------------------
    # 2. Tout cocher = tout annuler → retour en préparation
    # ------------------------------------------------------------------
    def test_annuler_toutes_les_lignes_repasse_en_preparation(self):
        commande, produits, items = self._make_closed_commande([10, 15])

        response = self._annuler(
            commande, {"item_ids": [items[0].id, items[1].id]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        commande.refresh_from_db()
        self.assertEqual(commande.status, Commande.Status.EN_PREPARATION)
        for p in produits:
            p.refresh_from_db()
            self.assertEqual(p.stock, 0)

    # ------------------------------------------------------------------
    # 3. Blocage si le lot d'une ligne sélectionnée a été vendu
    # ------------------------------------------------------------------
    def test_blocage_lot_vendu(self):
        commande, produits, items = self._make_closed_commande([20, 30])
        lot1 = StockLot.objects.get(commande_produit=items[0])
        facture = self.factory.create_facture()
        fp = self.factory.create_facture_produit(facture, produits[0], quantity=2)
        FactureProduitAllocation.objects.create(
            facture_produit=fp, stock_lot=lot1, quantity=2,
            cost_price=produits[0].cost_price,
            selling_price=produits[0].selling_price,
        )

        response = self._annuler(commande, {"item_ids": [items[0].id]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vendue", response.data["detail"])

        # Rien n'a été touché
        produits[0].refresh_from_db()
        items[0].refresh_from_db()
        commande.refresh_from_db()
        self.assertEqual(produits[0].stock, 20)
        self.assertIsNone(items[0].quantity_received)
        self.assertEqual(commande.status, Commande.Status.CLOTUREE)
        self.assertTrue(StockLot.objects.filter(pk=lot1.pk).exists())

    # La vente d'une AUTRE ligne ne bloque pas la sélection
    def test_vente_ligne_non_selectionnee_ne_bloque_pas(self):
        commande, produits, items = self._make_closed_commande([20, 30])
        lot2 = StockLot.objects.get(commande_produit=items[1])
        facture = self.factory.create_facture()
        fp = self.factory.create_facture_produit(facture, produits[1], quantity=2)
        FactureProduitAllocation.objects.create(
            facture_produit=fp, stock_lot=lot2, quantity=2,
            cost_price=produits[1].cost_price,
            selling_price=produits[1].selling_price,
        )

        response = self._annuler(commande, {"item_ids": [items[0].id]})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        produits[0].refresh_from_db()
        self.assertEqual(produits[0].stock, 0)

    # ------------------------------------------------------------------
    # 4. Modification de quantité : le delta est retiré des lots
    # ------------------------------------------------------------------
    def test_update_quantite_recue_retire_le_delta(self):
        commande, produits, items = self._make_closed_commande([20, 30])
        lot1 = StockLot.objects.get(commande_produit=items[0])

        response = self._annuler(
            commande, {"updates": [{"id": items[0].id, "quantity_received": 8}]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produits[0].refresh_from_db()
        items[0].refresh_from_db()
        lot1.refresh_from_db()
        commande.refresh_from_db()

        self.assertEqual(items[0].quantity_received, 8)
        self.assertEqual(lot1.quantity_remaining, 8)
        self.assertEqual(produits[0].stock, 8)
        self.assertEqual(commande.status, Commande.Status.CLOTUREE)

        mvt = MouvementStock.objects.filter(
            produit=produits[0], type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT
        ).order_by("-date").first()
        self.assertEqual(mvt.quantite, -12)

    # Augmenter la quantité reçue est interdit
    def test_update_augmentation_refusee(self):
        commande, produits, items = self._make_closed_commande([20])
        response = self._annuler(
            commande, {"updates": [{"id": items[0].id, "quantity_received": 25}]}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Impossible de retirer plus que ce qui reste en stock
    def test_update_stock_consomme_bloque(self):
        commande, produits, items = self._make_closed_commande([20])
        lot1 = StockLot.objects.get(commande_produit=items[0])
        # Simuler 18 unités déjà consommées ailleurs (sans allocation → pas de vente)
        lot1.quantity_remaining = 2
        lot1.save(update_fields=["quantity_remaining"])

        response = self._annuler(
            commande, {"updates": [{"id": items[0].id, "quantity_received": 10}]}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # 5. Suppression complète d'une ligne
    # ------------------------------------------------------------------
    def test_delete_ligne_supprime_ligne_et_stock(self):
        commande, produits, items = self._make_closed_commande([20, 30])

        response = self._annuler(
            commande, {"delete_item_ids": [items[0].id]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        produits[0].refresh_from_db()
        commande.refresh_from_db()
        self.assertEqual(produits[0].stock, 0)
        self.assertFalse(CommandeProduit.objects.filter(pk=items[0].id).exists())
        self.assertFalse(StockLot.objects.filter(commande_produit_id=items[0].id).exists())
        self.assertEqual(commande.status, Commande.Status.CLOTUREE)

    # ------------------------------------------------------------------
    # 6. Garde-fous de validation
    # ------------------------------------------------------------------
    def test_id_etranger_refuse(self):
        commande, produits, items = self._make_closed_commande([20])
        autre = CommandeProduit.objects.create(
            commande=self.factory.create_commande(fournisseur=produits[0].fournisseur),
            produit=produits[0], quantity=5,
            price=produits[0].cost_price, price_cost=produits[0].cost_price,
        )
        response = self._annuler(commande, {"item_ids": [autre.id]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_chevauchement_cancel_update_refuse(self):
        commande, produits, items = self._make_closed_commande([20])
        response = self._annuler(commande, {
            "item_ids": [items[0].id],
            "updates": [{"id": items[0].id, "quantity_received": 5}],
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_commande_non_cloturee_refusee(self):
        produit = self.factory.create_produit(stock=0, use_lot_management=True)
        commande = self.factory.create_commande(fournisseur=produit.fournisseur, status="PREP")
        item = CommandeProduit.objects.create(
            commande=commande, produit=produit, quantity=10,
            price=produit.cost_price, price_cost=produit.cost_price,
        )
        response = self._annuler(commande, {"item_ids": [item.id]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # 7. Paiement automatique → annulation partielle refusée
    # ------------------------------------------------------------------
    def test_paiement_auto_bloque_annulation_partielle(self):
        commande, produits, items = self._make_closed_commande([20, 30])
        commande.is_mise_en_place = True
        commande.paye_a_la_cloture = True
        commande.save(update_fields=["is_mise_en_place", "paye_a_la_cloture"])
        paiement = PaiementFournisseur.objects.create(
            fournisseur=commande.fournisseur,
            montant=1000,
            notes=f"Paiement automatique - achat au comptant / mise en place (Commande #{commande.id})",
        )
        paiement.commandes.add(commande)

        response = self._annuler(commande, {"item_ids": [items[0].id]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paiement automatique", response.data["detail"].lower())

        # L'annulation totale reste possible et supprime le paiement
        response = self._annuler(commande)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(PaiementFournisseur.objects.filter(pk=paiement.pk).exists())
        commande.refresh_from_db()
        self.assertEqual(commande.status, Commande.Status.EN_PREPARATION)

    # ------------------------------------------------------------------
    # 8. Compatibilité : annulation totale sans paramètre (historique)
    # ------------------------------------------------------------------
    def test_annulation_totale_sans_parametre_inchangee(self):
        commande, produits, items = self._make_closed_commande([20])
        response = self._annuler(commande)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        commande.refresh_from_db()
        produits[0].refresh_from_db()
        self.assertEqual(commande.status, Commande.Status.EN_PREPARATION)
        self.assertEqual(produits[0].stock, 0)
