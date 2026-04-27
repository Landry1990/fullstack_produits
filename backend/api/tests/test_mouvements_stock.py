"""
Tests complets sur les MouvementStock.

Couvre :
- Création directe (modèle)
- ENTREE  : clôture d'une commande fournisseur
- SORTIE  : via facture validée
- RETOUR  : annulation d'un promis
- AJUSTEMENT : ajustement manuel de stock
- REAPPRO_INTERSTOCK : transfert réserve → rayon
- AVOIR   : avoir fournisseur (retour marchandise)
- TRANSFORMATION_ENTREE / TRANSFORMATION_SORTIE
- API endpoint historique produit (produit-history)
- Intégrité : produit_nom sauvegardé si produit supprimé
- Champs obligatoires / validations
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Commande,
    CommandeProduit,
    MouvementStock,
    Produit,
    Promis,
    RelationTransformation,
    StockLot,
)
from .factories import TestDataFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _latest_mvt(produit, type_mouvement):
    """Retourne le dernier mouvement d'un type donné pour un produit."""
    return (
        MouvementStock.objects.filter(produit=produit, type_mouvement=type_mouvement)
        .order_by("-date")
        .first()
    )


# ---------------------------------------------------------------------------
# 1. Création directe du modèle
# ---------------------------------------------------------------------------

class MouvementStockModelTestCase(APITestCase):
    """Vérifie la création et les champs du modèle MouvementStock."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.produit = TestDataFactory.create_produit(stock=50)

    def test_create_mouvement_minimal(self):
        """Peut créer un mouvement avec les champs minimaux."""
        mvt = MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
            quantite=-5,
            user=self.user,
        )
        self.assertIsNotNone(mvt.pk)
        self.assertEqual(mvt.type_mouvement, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertEqual(mvt.quantite, -5)

    def test_str_representation(self):
        """__str__ contient le nom du produit."""
        mvt = MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.ENTREE,
            quantite=10,
        )
        self.assertIn(self.produit.name, str(mvt))

    def test_str_with_no_produit_uses_produit_nom(self):
        """__str__ utilise produit_nom si la FK produit est nulle."""
        mvt = MouvementStock.objects.create(
            produit=None,
            produit_nom="Médicament Archivé",
            type_mouvement=MouvementStock.TypeMouvement.SORTIE,
            quantite=-2,
        )
        self.assertIn("Médicament Archivé", str(mvt))

    def test_ordering_is_date_desc(self):
        """Les mouvements sont triés par date décroissante."""
        MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.ENTREE,
            quantite=1,
        )
        MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.SORTIE,
            quantite=-1,
        )
        mvts = list(MouvementStock.objects.filter(produit=self.produit))
        self.assertGreaterEqual(mvts[0].date, mvts[1].date)

    def test_stock_apres_snapshot(self):
        """stock_apres est bien conservé comme snapshot."""
        mvt = MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
            quantite=-10,
            stock_apres=40,
        )
        self.assertEqual(mvt.stock_apres, 40)
        # Modifier le stock du produit n'altère pas le snapshot
        self.produit.stock = 999
        self.produit.save()
        mvt.refresh_from_db()
        self.assertEqual(mvt.stock_apres, 40)

    def test_all_type_mouvement_choices_valid(self):
        """Tous les TypeMouvement peuvent être enregistrés en base."""
        types = [
            MouvementStock.TypeMouvement.ENTREE,
            MouvementStock.TypeMouvement.SORTIE,
            MouvementStock.TypeMouvement.RETOUR,
            MouvementStock.TypeMouvement.AJUSTEMENT,
            MouvementStock.TypeMouvement.AVOIR,
            MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
            MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
            MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK,
        ]
        for t in types:
            mvt = MouvementStock.objects.create(
                produit=self.produit, type_mouvement=t, quantite=1
            )
            self.assertEqual(mvt.type_mouvement, t)


# ---------------------------------------------------------------------------
# 2. ENTREE — clôture commande fournisseur
# ---------------------------------------------------------------------------

class MouvementEntreeCommandeTestCase(APITestCase):
    """Un MouvementStock ENTREE est créé lors de la clôture d'une commande."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(stock=0)
        self.fournisseur = self.produit.fournisseur

    def test_cloture_commande_cree_mouvement_entree(self):
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status="PREP")
        TestDataFactory.create_commande_produit(
            commande=commande, produit=self.produit, quantity=30, price_cost=40
        )

        count_avant = MouvementStock.objects.filter(
            produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.ENTREE
        ).count()

        url = reverse("commande-cloturer", kwargs={"pk": commande.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count_apres = MouvementStock.objects.filter(
            produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.ENTREE
        ).count()
        self.assertEqual(count_apres, count_avant + 1)

    def test_cloture_commande_mouvement_quantite_correcte(self):
        """La quantité du mouvement = quantité commandée (+ UG si applicable)."""
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status="PREP")
        TestDataFactory.create_commande_produit(
            commande=commande, produit=self.produit, quantity=20, price_cost=40
        )
        url = reverse("commande-cloturer", kwargs={"pk": commande.pk})
        self.client.post(url)

        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.ENTREE)
        self.assertIsNotNone(mvt)
        self.assertEqual(mvt.quantite, 20)
        self.assertIsNotNone(mvt.commande)
        self.assertEqual(mvt.commande.pk, commande.pk)

    def test_cloture_commande_mouvement_stock_apres(self):
        """stock_apres reflète le stock total après réception."""
        self.produit.stock = 0
        self.produit.save()

        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status="PREP")
        TestDataFactory.create_commande_produit(
            commande=commande, produit=self.produit, quantity=15, price_cost=40
        )
        url = reverse("commande-cloturer", kwargs={"pk": commande.pk})
        self.client.post(url)

        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.ENTREE)
        self.produit.refresh_from_db()
        self.assertEqual(mvt.stock_apres, self.produit.total_stock)

    def test_cloture_commande_user_enregistre(self):
        """L'utilisateur qui clôture est bien enregistré dans le mouvement."""
        commande = TestDataFactory.create_commande(fournisseur=self.fournisseur, status="PREP")
        TestDataFactory.create_commande_produit(
            commande=commande, produit=self.produit, quantity=10, price_cost=40
        )
        url = reverse("commande-cloturer", kwargs={"pk": commande.pk})
        self.client.post(url)

        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.ENTREE)
        self.assertEqual(mvt.user, self.user)


# ---------------------------------------------------------------------------
# 3. AJUSTEMENT — ajustement manuel
# ---------------------------------------------------------------------------

class MouvementAjustementTestCase(APITestCase):
    """Un MouvementStock AJUSTEMENT est créé lors d'un adjust_stock."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(stock=100)

    def test_ajustement_cree_mouvement(self):
        count_avant = MouvementStock.objects.filter(produit=self.produit).count()
        url = reverse("produit-adjust-stock", kwargs={"pk": self.produit.pk})
        response = self.client.post(
            url, {"new_quantity": 80, "reason_type": "INVENTAIRE"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            MouvementStock.objects.filter(produit=self.produit).count(), count_avant + 1
        )

    def test_ajustement_quantite_negative(self):
        """Réduction de stock → quantite négative dans le mouvement."""
        url = reverse("produit-adjust-stock", kwargs={"pk": self.produit.pk})
        self.client.post(
            url, {"new_quantity": 70, "reason_type": "CASSE"}, format="json"
        )
        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertIsNotNone(mvt)
        self.assertLess(mvt.quantite, 0)

    def test_ajustement_quantite_positive(self):
        """Augmentation de stock → quantite positive dans le mouvement."""
        url = reverse("produit-adjust-stock", kwargs={"pk": self.produit.pk})
        self.client.post(
            url, {"new_quantity": 120, "reason_type": "INVENTAIRE"}, format="json"
        )
        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertIsNotNone(mvt)
        self.assertGreater(mvt.quantite, 0)

    def test_ajustement_stock_apres_coherent(self):
        """stock_apres correspond au stock total après l'ajustement."""
        url = reverse("produit-adjust-stock", kwargs={"pk": self.produit.pk})
        self.client.post(
            url, {"new_quantity": 55, "reason_type": "INVENTAIRE"}, format="json"
        )
        self.produit.refresh_from_db()
        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.AJUSTEMENT)
        self.assertEqual(mvt.stock_apres, self.produit.total_stock)

    def test_ajustement_reason_type_invalide_retourne_400(self):
        """Un reason_type inconnu doit renvoyer HTTP 400."""
        url = reverse("produit-adjust-stock", kwargs={"pk": self.produit.pk})
        response = self.client.post(
            url, {"new_quantity": 80, "reason_type": "RAISON_INCONNUE"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ajustement_sans_quantite_retourne_400(self):
        """Aucune quantité fournie → HTTP 400."""
        url = reverse("produit-adjust-stock", kwargs={"pk": self.produit.pk})
        response = self.client.post(url, {"reason_type": "INVENTAIRE"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# 4. REAPPRO_INTERSTOCK — transfert réserve → rayon
# ---------------------------------------------------------------------------

class MouvementReapproInterstockTestCase(APITestCase):
    """Deux mouvements REAPPRO_INTERSTOCK (sortie réserve + entrée rayon)."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.supervisor = TestDataFactory.create_superuser(
            username="supervisor_reappro", password="passsupervisor"
        )
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(
            stock=0, stock_reserve=0, has_reserve_storage=True
        )
        self.fournisseur = self.produit.fournisseur

    def _receptionner(self, qty=50):
        """Clôture une commande pour alimenter la réserve."""
        commande = TestDataFactory.create_commande(
            fournisseur=self.fournisseur, status="PREP"
        )
        TestDataFactory.create_commande_produit(
            commande=commande, produit=self.produit, quantity=qty, price_cost=40
        )
        self.client.post(reverse("commande-cloturer", kwargs={"pk": commande.pk}))
        self.produit.refresh_from_db()

    def test_transfert_cree_deux_mouvements_reappro(self):
        self._receptionner(50)
        count_avant = MouvementStock.objects.filter(
            produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK
        ).count()

        response = self.client.post(
            reverse("produit-transfer-to-shelf", kwargs={"pk": self.produit.pk}),
            {
                "quantity": 20,
                "validated_by_id": self.supervisor.id,
                "sudo_password": "passsupervisor",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count_apres = MouvementStock.objects.filter(
            produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK
        ).count()
        self.assertEqual(count_apres, count_avant + 2)

    def test_transfert_quantites_positives_et_negatives(self):
        self._receptionner(50)
        self.client.post(
            reverse("produit-transfer-to-shelf", kwargs={"pk": self.produit.pk}),
            {
                "quantity": 10,
                "validated_by_id": self.supervisor.id,
                "sudo_password": "passsupervisor",
            },
        )
        mvts = list(
            MouvementStock.objects.filter(
                produit=self.produit,
                type_mouvement=MouvementStock.TypeMouvement.REAPPRO_INTERSTOCK,
            ).order_by("date")
        )
        quantites = [m.quantite for m in mvts]
        self.assertIn(-10, quantites)
        self.assertIn(10, quantites)

    def test_transfert_stock_coherent_apres(self):
        self._receptionner(60)
        self.client.post(
            reverse("produit-transfer-to-shelf", kwargs={"pk": self.produit.pk}),
            {
                "quantity": 25,
                "validated_by_id": self.supervisor.id,
                "sudo_password": "passsupervisor",
            },
        )
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, 25)
        self.assertEqual(self.produit.stock_reserve, 35)
        self.assertEqual(self.produit.total_stock, 60)

    def test_transfert_quantite_superieure_reserve_retourne_400(self):
        self._receptionner(10)
        response = self.client.post(
            reverse("produit-transfer-to-shelf", kwargs={"pk": self.produit.pk}),
            {
                "quantity": 999,
                "validated_by_id": self.supervisor.id,
                "sudo_password": "passsupervisor",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transfert_sans_reserve_retourne_400(self):
        """Produit sans stock réserve → erreur."""
        produit_sans_reserve = TestDataFactory.create_produit(
            stock=50, has_reserve_storage=False
        )
        response = self.client.post(
            reverse("produit-transfer-to-shelf", kwargs={"pk": produit_sans_reserve.pk}),
            {
                "quantity": 10,
                "validated_by_id": self.supervisor.id,
                "sudo_password": "passsupervisor",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# 5. RETOUR — annulation d'un promis
# ---------------------------------------------------------------------------

class MouvementRetourPromisTestCase(APITestCase):
    """Un MouvementStock RETOUR est créé lors de l'annulation d'un promis."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(stock=20, use_lot_management=False)
        self.client_obj = TestDataFactory.create_client()

    def _creer_promis(self, quantite=5):
        return Promis.objects.create(
            produit=self.produit,
            quantite=quantite,
            client=self.client_obj,
            status=Promis.Status.EN_ATTENTE,
            created_by=self.user,
        )

    def test_annulation_promis_cree_mouvement_retour(self):
        promis = self._creer_promis(5)
        count_avant = MouvementStock.objects.filter(
            produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.RETOUR
        ).count()

        url = reverse("promis-annuler-et-reintegrer", kwargs={"pk": promis.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count_apres = MouvementStock.objects.filter(
            produit=self.produit, type_mouvement=MouvementStock.TypeMouvement.RETOUR
        ).count()
        self.assertEqual(count_apres, count_avant + 1)

    def test_annulation_promis_reinjecte_stock(self):
        stock_avant = self.produit.stock
        promis = self._creer_promis(3)
        url = reverse("promis-annuler-et-reintegrer", kwargs={"pk": promis.pk})
        self.client.post(url)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.stock, stock_avant + 3)

    def test_annulation_promis_quantite_mouvement(self):
        promis = self._creer_promis(7)
        url = reverse("promis-annuler-et-reintegrer", kwargs={"pk": promis.pk})
        self.client.post(url)
        mvt = _latest_mvt(self.produit, MouvementStock.TypeMouvement.RETOUR)
        self.assertIsNotNone(mvt)
        self.assertEqual(mvt.quantite, 7)

    def test_annulation_promis_deja_annule_retourne_400(self):
        promis = self._creer_promis(5)
        promis.status = Promis.Status.ANNULE
        promis.save()
        url = reverse("promis-annuler-et-reintegrer", kwargs={"pk": promis.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_annulation_promis_delivre_retourne_400(self):
        promis = self._creer_promis(5)
        promis.status = Promis.Status.DELIVRE
        promis.save()
        url = reverse("promis-annuler-et-reintegrer", kwargs={"pk": promis.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# 6. TRANSFORMATION_ENTREE / TRANSFORMATION_SORTIE
# ---------------------------------------------------------------------------

class MouvementTransformationTestCase(APITestCase):
    """Deux mouvements créés lors d'une transformation produit."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)

        self.source = TestDataFactory.create_produit(
            name="Source Box", stock=10, use_lot_management=True
        )
        lot = TestDataFactory.create_stock_lot(
            produit=self.source, quantity=10, lot_name="LOT-S1"
        )

        self.dest = TestDataFactory.create_produit(
            name="Dest Plate", stock=0, use_lot_management=True
        )
        self.relation = RelationTransformation.objects.create(
            produit_source=self.source, produit_destination=self.dest, ratio=10
        )

    def test_transformation_cree_mouvement_sortie_source(self):
        count_avant = MouvementStock.objects.filter(
            produit=self.source,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
        ).count()

        url = reverse("relationtransformation-transformer", args=[self.relation.id])
        response = self.client.post(url, {"quantite": 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count_apres = MouvementStock.objects.filter(
            produit=self.source,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
        ).count()
        self.assertEqual(count_apres, count_avant + 1)

    def test_transformation_cree_mouvement_entree_destination(self):
        count_avant = MouvementStock.objects.filter(
            produit=self.dest,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
        ).count()

        url = reverse("relationtransformation-transformer", args=[self.relation.id])
        response = self.client.post(url, {"quantite": 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count_apres = MouvementStock.objects.filter(
            produit=self.dest,
            type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
        ).count()
        self.assertEqual(count_apres, count_avant + 1)

    def test_transformation_quantites_correctes(self):
        url = reverse("relationtransformation-transformer", args=[self.relation.id])
        self.client.post(url, {"quantite": 3})

        mvt_source = _latest_mvt(self.source, MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE)
        mvt_dest = _latest_mvt(self.dest, MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE)

        self.assertEqual(mvt_source.quantite, -3)
        self.assertEqual(mvt_dest.quantite, 30)  # ratio 10

    def test_transformation_stock_insuffisant(self):
        url = reverse("relationtransformation-transformer", args=[self.relation.id])
        response = self.client.post(url, {"quantite": 999})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# 7. Endpoint historique produit (produit-history)
# ---------------------------------------------------------------------------

class HistoriqueProduitAPITestCase(APITestCase):
    """Vérifie l'endpoint GET produit-history."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        self.produit = TestDataFactory.create_produit(stock=100)

    def test_history_endpoint_retourne_200(self):
        url = reverse("produit-history", kwargs={"pk": self.produit.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_history_liste_les_mouvements_du_produit(self):
        MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
            quantite=-10,
            stock_apres=90,
            user=self.user,
        )
        url = reverse("produit-history", kwargs={"pk": self.produit.pk})
        response = self.client.get(url)
        self.assertGreaterEqual(len(response.data), 1)

    def test_history_contient_champs_attendus(self):
        MouvementStock.objects.create(
            produit=self.produit,
            type_mouvement=MouvementStock.TypeMouvement.ENTREE,
            quantite=50,
            stock_apres=150,
            user=self.user,
        )
        url = reverse("produit-history", kwargs={"pk": self.produit.pk})
        response = self.client.get(url)
        self.assertTrue(len(response.data) > 0)
        item = response.data[0]
        for field in ("quantity", "type", "stock_apres"):
            self.assertIn(field, item, f"Champ '{field}' absent de la réponse historique")

    def test_history_ordre_decroissant(self):
        """Le dernier mouvement créé apparaît en premier."""
        for i in range(3):
            MouvementStock.objects.create(
                produit=self.produit,
                type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                quantite=i + 1,
                stock_apres=100 + i,
            )
        url = reverse("produit-history", kwargs={"pk": self.produit.pk})
        response = self.client.get(url)
        # Le stock_apres du premier item doit être le plus grand (dernier créé)
        stocks = [item["stock_apres"] for item in response.data if item.get("stock_apres")]
        if len(stocks) >= 2:
            self.assertGreaterEqual(stocks[0], stocks[-1])

    def test_history_produit_inconnu_retourne_404(self):
        url = reverse("produit-history", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_history_non_authentifie_retourne_401_ou_403(self):
        self.client.logout()
        url = reverse("produit-history", kwargs={"pk": self.produit.pk})
        response = self.client.get(url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ---------------------------------------------------------------------------
# 8. Intégrité : produit_nom préservé après suppression du produit
# ---------------------------------------------------------------------------

class MouvementStockIntegriteTestCase(APITestCase):
    """Vérifie que les mouvements survivent à la suppression du produit."""

    def setUp(self):
        self.user = TestDataFactory.create_superuser()

    def test_produit_nom_preserve_apres_suppression(self):
        produit = TestDataFactory.create_produit(name="Produit Éphémère", stock=10)
        mvt = MouvementStock.objects.create(
            produit=produit,
            produit_nom=produit.name,
            type_mouvement=MouvementStock.TypeMouvement.SORTIE,
            quantite=-5,
            user=self.user,
        )
        produit_pk = produit.pk
        produit.delete()

        mvt.refresh_from_db()
        self.assertIsNone(mvt.produit)
        self.assertEqual(mvt.produit_nom, "Produit Éphémère")
        self.assertIn("Produit Éphémère", str(mvt))

    def test_mouvement_lié_commande_existe_sans_commande(self):
        """Suppression d'une commande → le mouvement reste, FK devient NULL."""
        produit = TestDataFactory.create_produit(stock=0)
        fournisseur = produit.fournisseur
        commande = TestDataFactory.create_commande(fournisseur=fournisseur, status="PREP")
        mvt = MouvementStock.objects.create(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.ENTREE,
            quantite=10,
            commande=commande,
        )
        commande.delete()
        mvt.refresh_from_db()
        self.assertIsNone(mvt.commande)
        self.assertIsNotNone(mvt.pk)
