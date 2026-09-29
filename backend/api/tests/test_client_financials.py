"""
Tests complets de la couche financière client — zone hypersensible.

Couvre :
- Plafond de crédit (clients PROFESSIONNEL)
- Dette client (current_debt / solde_factures dénormalisé)
- Dépôts clients (DEPOT/RETRAIT/ACHAT/ANNULATION_ACHAT, solde_depot)
- Fidélité (points gagnés/utilisés, remise automatique par seuil)
- Tiers payant (taux_couverture → part_client → AUTO-CREDIT en_compte)
- Paiement en mode 'depot' (ne doit jamais passer le solde en négatif)
"""
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    AyantDroit,
    Caisse,
    Client,
    DepotClient,
    Facture,
    LoyaltyHistory,
    LoyaltySetting,
    MouvementCaisse,
)
from api.tests.factories import TestDataFactory


class ClientFinancialsTestCase(TestCase):
    """Base : utilisateur admin + session de caisse ouverte."""

    def setUp(self):
        self.client_api = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(
            username="admin_client_fin", password="adminpass123"
        )
        self.client_api.force_authenticate(user=self.user)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _open_session(self):
        return self.factory.create_session_caisse(user=self.user)

    def _make_sale(self, client, produit, quantity=1, prix=None,
                   paiements=None, extra=None):
        """Finalise une vente via l'endpoint facture-finaliser."""
        self._open_session()
        prix = prix if prix is not None else produit.selling_price
        if paiements is None:
            paiements = [{"mode": "especes", "montant": str(prix * quantity)}]
        payload = {
            "client": client.id if client else None,
            "produits": [{
                "produit": produit.id,
                "quantity": quantity,
                "selling_price": str(prix),
                "discount": "0",
                "tva": "0",
            }],
            "paiements": paiements,
            "remise": "0",
            "type": "STD",
        }
        if extra:
            payload.update(extra)
        return self.client_api.post(
            reverse("facture-finaliser"), payload, format="json"
        )

    def _validated_facture(self, client, produit, quantity=1, prix=None):
        resp = self._make_sale(client, produit, quantity, prix)
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        return Facture.objects.order_by("-id").first()


# ======================================================================
# 1. PLAFOND DE CRÉDIT
# ======================================================================
class PlafondCreditTestCase(ClientFinancialsTestCase):

    def _pro_client(self, plafond):
        return self.factory.create_client(
            name="Client Pro", client_type="PROFESSIONNEL",
            plafond=Decimal(str(plafond)),
        )

    def test_pro_sous_plafond_ok(self):
        """Dette 0 + vente 500 <= plafond 1000 → OK."""
        client = self._pro_client(1000)
        produit = self.factory.create_produit(stock=50, selling_price=100)
        resp = self._make_sale(client, produit, quantity=5,
                               paiements=[{"mode": "en_compte", "montant": "0"}])
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

    def test_pro_plafond_depasse_refuse(self):
        """Dette 800 + nouvelle vente 500 non payée > plafond 1000 → refus."""
        client = self._pro_client(1000)
        produit = self.factory.create_produit(stock=50, selling_price=100)

        # Dette existante : facture validée impayée de 800
        f1 = self._validated_facture(client, produit, quantity=8)
        Caisse.objects.filter(facture=f1).delete()
        client.recalculate_solde()
        client.refresh_from_db()
        self.assertEqual(client.current_debt, Decimal("800"))

        # Vente 500 SANS paiement immédiat → incrément dette = 500
        resp = self._make_sale(client, produit, quantity=5, paiements=[])
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("plafond", str(resp.data).lower())

    def test_pro_plafond_moins_un_illimite(self):
        """plafond = -1 → crédit illimité."""
        client = self._pro_client(-1)
        produit = self.factory.create_produit(stock=500, selling_price=100)
        resp = self._make_sale(client, produit, quantity=100)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

    def test_particulier_jamais_bloque(self):
        """Un PARTICULIER n'est jamais bloqué par un plafond."""
        client = self.factory.create_client(
            name="Particulier", client_type="PARTICULIER",
            plafond=Decimal("0"),
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        resp = self._make_sale(client, produit, quantity=10)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

    def test_paiement_immediat_reduit_increment_dette(self):
        """Paiement immédiat partiel ramène sous le plafond → OK."""
        client = self._pro_client(1000)
        produit = self.factory.create_produit(stock=50, selling_price=100)

        # Dette existante 800
        f1 = self._validated_facture(client, produit, quantity=8)
        Caisse.objects.filter(facture=f1).delete()
        client.recalculate_solde()

        # Nouvelle vente 500, mais paiement immédiat 400 → incrément = 100
        resp = self._make_sale(
            client, produit, quantity=5,
            paiements=[{"mode": "especes", "montant": "400"}],
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)


# ======================================================================
# 2. DETTE CLIENT (current_debt / solde_factures)
# ======================================================================
class DetteClientTestCase(ClientFinancialsTestCase):

    def test_dette_facture_impayee(self):
        """Facture validée impayée → current_debt = total_ttc."""
        client = self.factory.create_client()
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=5)
        Caisse.objects.filter(facture=facture).delete()

        client.refresh_from_db()
        client.derniere_mise_a_jour_solde = None
        debt = client._compute_debt_from_factures()
        self.assertEqual(debt["total"], facture.total_ttc)
        self.assertEqual(debt["count"], 1)

    def test_dette_zero_si_tout_paye(self):
        client = self.factory.create_client()
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=5)
        # En mode caisse centrale, les paiements passent par l'endpoint caisse
        self._open_session()
        resp = self.client_api.post(
            reverse("caisse-list"),
            {"facture": facture.id, "mode_paiement": "especes",
             "montant": str(facture.total_ttc), "statut": "completee"},
            format="json",
        )
        self.assertIn(resp.status_code, (200, 201), resp.data)
        client.derniere_mise_a_jour_solde = None
        self.assertEqual(client._compute_debt_from_factures()["total"], Decimal("0"))

    def test_en_compte_compte_comme_dette(self):
        """Un paiement 'en_compte' ne réduit PAS la dette (c'est la dette)."""
        client = self.factory.create_client()
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=5)
        Caisse.objects.filter(facture=facture).delete()
        self.factory.create_caisse(
            facture=facture, montant=facture.total_ttc,
            mode_paiement="en_compte", user=self.user,
        )
        client.derniere_mise_a_jour_solde = None
        self.assertEqual(
            client._compute_debt_from_factures()["total"], facture.total_ttc
        )

    def test_recalculate_solde_met_a_jour_champs(self):
        client = self.factory.create_client()
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=3)
        Caisse.objects.filter(facture=facture).delete()

        info = client.recalculate_solde()
        client.refresh_from_db()
        self.assertEqual(client.solde_factures, facture.total_ttc)
        self.assertEqual(client.nombre_factures_impayees, 1)
        self.assertEqual(info["total"], facture.total_ttc)


# ======================================================================
# 3. DÉPÔTS CLIENTS
# ======================================================================
class DepotClientTestCase(ClientFinancialsTestCase):

    def _deposit_client(self, solde=Decimal("0")):
        return self.factory.create_client(
            name="Client Depot", is_deposit_enabled=True, solde_depot=solde,
        )

    def test_depot_credite_solde_et_mouvement_caisse(self):
        client = self._deposit_client()
        resp = self.client_api.post(
            reverse("client-add-depot", kwargs={"pk": client.pk}),
            {"montant": "5000", "type": "DEPOT", "mode_paiement": "ESP"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        client.refresh_from_db()
        self.assertEqual(client.solde_depot, Decimal("5000"))
        self.assertTrue(MouvementCaisse.objects.filter(
            type="ENTREE", montant=Decimal("5000")).exists())

    def test_retrait_debite_solde_et_mouvement_sortie(self):
        client = self._deposit_client(solde=Decimal("3000"))
        resp = self.client_api.post(
            reverse("client-add-depot", kwargs={"pk": client.pk}),
            {"montant": "2000", "type": "RETRAIT"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        client.refresh_from_db()
        self.assertEqual(client.solde_depot, Decimal("1000"))
        self.assertTrue(MouvementCaisse.objects.filter(
            type="SORTIE", montant=Decimal("2000")).exists())

    def test_retrait_superieur_au_solde_refuse(self):
        client = self._deposit_client(solde=Decimal("1000"))
        resp = self.client_api.post(
            reverse("client-add-depot", kwargs={"pk": client.pk}),
            {"montant": "5000", "type": "RETRAIT"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        client.refresh_from_db()
        self.assertEqual(client.solde_depot, Decimal("1000"))

    def test_depot_montant_invalide_refuse(self):
        client = self._deposit_client()
        for montant in ("0", "-500"):
            resp = self.client_api.post(
                reverse("client-add-depot", kwargs={"pk": client.pk}),
                {"montant": montant, "type": "DEPOT"},
                format="json",
            )
            self.assertEqual(resp.status_code, 400)

    def test_depot_type_invalide_refuse(self):
        client = self._deposit_client()
        resp = self.client_api.post(
            reverse("client-add-depot", kwargs={"pk": client.pk}),
            {"montant": "100", "type": "ACHAT"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_paiement_facture_par_depot_debite_solde(self):
        """Paiement 'depot' → DepotClient ACHAT + solde diminué."""
        client = self._deposit_client(solde=Decimal("10000"))
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=5)
        Caisse.objects.filter(facture=facture).delete()
        facture.status = Facture.Status.VALIDEE
        facture.save(update_fields=["status"])

        self._open_session()
        resp = self.client_api.post(
            reverse("caisse-list"),
            {"facture": facture.id, "mode_paiement": "depot",
             "montant": "500", "statut": "completee"},
            format="json",
        )
        self.assertIn(resp.status_code, (200, 201), resp.data)
        client.refresh_from_db()
        self.assertEqual(client.solde_depot, Decimal("9500"))
        self.assertTrue(DepotClient.objects.filter(
            client=client, type=DepotClient.Type.ACHAT,
            montant=Decimal("500"), facture=facture).exists())

    def test_annulation_vente_depot_recredite_solde(self):
        """Annulation d'une vente payée par dépôt → ANNULATION_ACHAT recrédite."""
        client = self._deposit_client(solde=Decimal("10000"))
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=5)
        Caisse.objects.filter(facture=facture).delete()
        facture.status = Facture.Status.VALIDEE
        facture.save(update_fields=["status"])

        self._open_session()
        self.client_api.post(
            reverse("caisse-list"),
            {"facture": facture.id, "mode_paiement": "depot",
             "montant": "500", "statut": "completee"},
            format="json",
        )
        client.refresh_from_db()
        self.assertEqual(client.solde_depot, Decimal("9500"))

        resp = self.client_api.post(
            reverse("facture-annuler", kwargs={"pk": facture.pk}),
            {"motif": "erreur"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        client.refresh_from_db()
        self.assertEqual(client.solde_depot, Decimal("10000"))
        self.assertTrue(DepotClient.objects.filter(
            client=client, type=DepotClient.Type.ANNULATION_ACHAT,
            montant=Decimal("500")).exists())

    def test_paiement_depot_sans_solde_ne_doit_pas_passer_negatif(self):
        """Paiement 'depot' supérieur au solde → doit être REFUSÉ (anti-découvert)."""
        client = self._deposit_client(solde=Decimal("100"))
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=5)
        Caisse.objects.filter(facture=facture).delete()
        facture.status = Facture.Status.VALIDEE
        facture.save(update_fields=["status"])

        self._open_session()
        resp = self.client_api.post(
            reverse("caisse-list"),
            {"facture": facture.id, "mode_paiement": "depot",
             "montant": "500", "statut": "completee"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.data)
        client.refresh_from_db()
        self.assertEqual(
            client.solde_depot, Decimal("100"),
            "Un dépôt insuffisant ne doit jamais débiter le solde",
        )


# ======================================================================
# 4. FIDÉLITÉ / REMISE AUTOMATIQUE PAR SEUIL
# ======================================================================
class FideliteTestCase(ClientFinancialsTestCase):

    def _setup_loyalty(self, threshold=0, percent=0):
        LoyaltySetting.objects.all().delete()
        return LoyaltySetting.objects.create(
            amount_per_point=Decimal("1000"),
            point_value=Decimal("10"),
            auto_reward_threshold=threshold,
            auto_reward_percent=Decimal(str(percent)),
        )

    def test_points_gagnes_a_la_vente(self):
        self._setup_loyalty()
        client = self.factory.create_client(
            name="Fidele", is_loyalty_member=True,
        )
        produit = self.factory.create_produit(stock=50, selling_price=1000)
        facture = self._validated_facture(client, produit, quantity=5)

        client.refresh_from_db()
        self.assertEqual(client.points_fidelite, 5)
        facture.refresh_from_db()
        self.assertEqual(facture.points_fidelite_gagnes, 5)
        self.assertTrue(LoyaltyHistory.objects.filter(
            client=client, type_transaction=LoyaltyHistory.TYPE_GAIN,
            points=5).exists())

    def test_points_utilises_deduits(self):
        self._setup_loyalty()
        client = self.factory.create_client(
            name="Fidele", is_loyalty_member=True, points_fidelite=50,
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self.factory.create_facture(
            client=client, status="BROU", total_ttc=Decimal("5000"))
        self.factory.create_facture_produit(
            facture=facture, produit=produit, quantity=50,
            selling_price=produit.selling_price)

        resp = self.client_api.post(
            reverse("facture-valider", kwargs={"pk": facture.pk}),
            {"mode_paiement": "especes", "points_to_use": 20},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        client.refresh_from_db()
        facture.refresh_from_db()
        # 50 - 20 utilisés + 5 gagnés (5000/1000) = 35
        self.assertEqual(client.points_fidelite, 35)
        self.assertEqual(facture.points_fidelite_utilises, 20)
        self.assertEqual(facture.montant_fidelite, Decimal("200"))

    def test_seuil_auto_declenche_remise_en_attente(self):
        self._setup_loyalty(threshold=50, percent=10)
        client = self.factory.create_client(
            name="Fidele", is_loyalty_member=True, points_fidelite=60,
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self.factory.create_facture(
            client=client, status="BROU", total_ttc=Decimal("1000"))
        self.factory.create_facture_produit(
            facture=facture, produit=produit, quantity=10,
            selling_price=produit.selling_price)

        resp = self.client_api.post(
            reverse("facture-valider", kwargs={"pk": facture.pk}),
            {"mode_paiement": "especes"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        client.refresh_from_db()
        # 60 + 1 gagné - 50 seuil = 11 pts, remise auto 10% en attente
        self.assertEqual(client.points_fidelite, 11)
        self.assertEqual(client.pending_discount, Decimal("10"))
        self.assertTrue(LoyaltyHistory.objects.filter(
            client=client,
            type_transaction=LoyaltyHistory.TYPE_REMISE_AUTO).exists())

    def test_use_pending_discount_consomme_la_remise(self):
        self._setup_loyalty()
        client = self.factory.create_client(
            name="Fidele", is_loyalty_member=True,
            pending_discount=Decimal("15"),
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self.factory.create_facture(
            client=client, status="BROU", total_ttc=Decimal("1000"))
        self.factory.create_facture_produit(
            facture=facture, produit=produit, quantity=10,
            selling_price=produit.selling_price)

        resp = self.client_api.post(
            reverse("facture-valider", kwargs={"pk": facture.pk}),
            {"mode_paiement": "especes", "use_pending_discount": True},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        client.refresh_from_db()
        self.assertEqual(client.pending_discount, Decimal("0"))

    def test_non_membre_pas_de_points(self):
        self._setup_loyalty()
        client = self.factory.create_client(
            name="Non membre", is_loyalty_member=False,
        )
        produit = self.factory.create_produit(stock=50, selling_price=1000)
        self._validated_facture(client, produit, quantity=5)
        client.refresh_from_db()
        self.assertEqual(client.points_fidelite, 0)
        self.assertFalse(LoyaltyHistory.objects.filter(client=client).exists())

    def test_professionnel_pas_de_points(self):
        self._setup_loyalty()
        client = self.factory.create_client(
            name="Pro", client_type="PROFESSIONNEL", is_loyalty_member=True,
        )
        produit = self.factory.create_produit(stock=50, selling_price=1000)
        self._validated_facture(client, produit, quantity=5)
        client.refresh_from_db()
        self.assertEqual(client.points_fidelite, 0)

    def test_clients_divers_pas_de_points(self):
        self._setup_loyalty()
        client = self.factory.create_client(
            name="CLIENTS DIVERS", is_loyalty_member=True,
        )
        produit = self.factory.create_produit(stock=50, selling_price=1000)
        self._validated_facture(client, produit, quantity=5)
        client.refresh_from_db()
        self.assertEqual(client.points_fidelite, 0)


# ======================================================================
# 5. TIERS PAYANT (taux_couverture → part_client → AUTO-CREDIT)
# ======================================================================
class TiersPayantTestCase(ClientFinancialsTestCase):

    def test_part_client_calcule_selon_couverture(self):
        client = self.factory.create_client(
            name="Assure", taux_couverture=Decimal("80"),
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=10)
        facture.refresh_from_db()
        self.assertEqual(facture.total_ttc, Decimal("1000"))
        self.assertEqual(facture.part_client, Decimal("200"))

    def test_auto_credit_en_compte_apres_part_patient(self):
        """Part patient payée → créance auto 'en_compte' pour le reste."""
        client = self.factory.create_client(
            name="Assure", taux_couverture=Decimal("80"),
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=10)
        Caisse.objects.filter(facture=facture).delete()
        facture.status = Facture.Status.VALIDEE
        facture.save(update_fields=["status"])

        self._open_session()
        resp = self.client_api.post(
            reverse("caisse-list"),
            {"facture": facture.id, "mode_paiement": "especes",
             "montant": "200", "statut": "completee"},
            format="json",
        )
        self.assertIn(resp.status_code, (200, 201), resp.data)

        auto = Caisse.objects.filter(
            facture=facture, mode_paiement="en_compte",
            statut="completee").first()
        self.assertIsNotNone(auto)
        self.assertEqual(auto.montant, Decimal("800"))
        self.assertEqual(auto.part_assurance, Decimal("800"))

        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.PAYEE)

    def test_dette_pro_creee_automatiquement(self):
        """Client PRO + tiers payant → dette auto pour la part assurance."""
        client = self.factory.create_client(
            name="Pro Assure", client_type="PROFESSIONNEL",
            taux_couverture=Decimal("70"), plafond=Decimal("-1"),
        )
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self._validated_facture(client, produit, quantity=10)
        facture.refresh_from_db()
        self.assertEqual(facture.part_client, Decimal("300"))
        self.assertTrue(Caisse.objects.filter(
            facture=facture, mode_paiement="en_compte",
            montant=Decimal("700")).exists())


# ======================================================================
# 6. REMISE GLOBALE
# ======================================================================
class RemiseTestCase(ClientFinancialsTestCase):

    def test_remise_superieure_au_total_refusee(self):
        client = self.factory.create_client()
        produit = self.factory.create_produit(stock=50, selling_price=100)
        facture = self.factory.create_facture(
            client=client, status="BROU")
        self.factory.create_facture_produit(
            facture=facture, produit=produit, quantity=5,
            selling_price=produit.selling_price)
        facture.remise = Decimal("99999")
        facture.calculate_totals(save=True)
        facture.remise = Decimal("99999")
        facture.save(update_fields=["remise"])
        facture.refresh_from_db()

        resp = self.client_api.post(
            reverse("facture-valider", kwargs={"pk": facture.pk}),
            {"mode_paiement": "especes"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("remise", str(resp.data).lower())


# ======================================================================
# 7. AYANTS DROIT
# ======================================================================
class AyantDroitTestCase(ClientFinancialsTestCase):

    def test_ayant_droit_lie_a_facture(self):
        client = self.factory.create_client(client_type="PROFESSIONNEL")
        ayant = AyantDroit.objects.create(
            client=client, matricule="MAT-001", nom="Employé X")
        produit = self.factory.create_produit(stock=50, selling_price=100)
        resp = self._make_sale(client, produit, quantity=2,
                               extra={"ayant_droit": ayant.id})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        facture = Facture.objects.order_by("-id").first()
        self.assertEqual(facture.ayant_droit_id, ayant.id)
