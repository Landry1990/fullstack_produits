"""
Tests pour SaleFinalizer — finalisation d'une vente (facture, produits, promis, ordonnancier).
Purement additif : aucun impact sur le code existant.
"""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

from api.models import (
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    MouvementStock,
    Ordonnancier,
    PosteCaisse,
    PosteVente,
    Produit,
    Promis,
    StockLot,
    Caisse as CaisseModel,
)
from api.services.sale_finalizer import SaleFinalizer

User = get_user_model()


@pytest.mark.django_db
class TestSaleFinalizerValidateProducts:

    def _create_user_and_product(self):
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Paracétamol 500mg",
            selling_price=Decimal("500"),
            stock=100,
        )
        return user, produit

    def test_validate_products_valid(self):
        """Produits valides — ne lève pas d'erreur."""
        user, produit = self._create_user_and_product()
        produits_data = [
            {"produit": produit.id, "quantity": 2, "selling_price": "500"},
        ]
        SaleFinalizer._validate_products(produits_data)

    def test_validate_products_empty_list(self):
        """Liste vide de produits — ne lève pas (la vérification est dans finalize_sale)."""
        # _validate_products ne vérifie pas la vacuité, c'est finalize_sale qui le fait
        SaleFinalizer._validate_products([])

    def test_validate_products_nonexistent_product(self):
        """Produit inexistant — lève ValueError."""
        produits_data = [
            {"produit": 99999, "quantity": 1, "selling_price": "100"},
        ]
        with pytest.raises(ValueError, match="Produit introuvable"):
            SaleFinalizer._validate_products(produits_data)

    def test_validate_products_invalid_price(self):
        """Prix invalide — lève ValueError."""
        user, produit = self._create_user_and_product()
        produits_data = [
            {"produit": produit.id, "quantity": 1, "selling_price": "not-a-number"},
        ]
        with pytest.raises(ValueError, match="Prix de vente invalide"):
            SaleFinalizer._validate_products(produits_data)

    def test_validate_products_price_too_high(self):
        """Prix abusif (>= 10 milliards) — lève ValueError."""
        user, produit = self._create_user_and_product()
        produits_data = [
            {"produit": produit.id, "quantity": 1, "selling_price": "10000000000"},
        ]
        with pytest.raises(ValueError, match="hors limites"):
            SaleFinalizer._validate_products(produits_data)

    def test_validate_products_invalid_quantity(self):
        """Quantité invalide — lève ValueError."""
        user, produit = self._create_user_and_product()
        produits_data = [
            {"produit": produit.id, "quantity": "abc", "selling_price": "500"},
        ]
        with pytest.raises(ValueError, match="Quantité invalide"):
            SaleFinalizer._validate_products(produits_data)


@pytest.mark.django_db
class TestSaleFinalizerValidatePosteVente:

    def test_validate_poste_vente_no_active_poste(self):
        """Aucun poste de vente actif — lève ValueError."""
        user = User.objects.create_user(username="lonely", password="testpass123")
        with pytest.raises(ValueError, match="aucun point de vente"):
            SaleFinalizer._validate_poste_vente(user, None, centralized=False)

    def test_validate_poste_vente_inactive_id(self):
        """Poste de vente inactif — lève ValueError."""
        user = User.objects.create_user(username="seller", password="testpass123")
        poste = PosteVente.objects.create(
            vendeur=user,
            nom="Test",
            est_actif=False,
            mode_pos=False,
        )
        with pytest.raises(ValueError, match="pas actif"):
            SaleFinalizer._validate_poste_vente(user, poste.id, centralized=False)

    def test_validate_poste_vente_wrong_user_non_centralized(self):
        """Vendeur différent en mode non-centralisé — lève ValueError."""
        owner = User.objects.create_user(username="owner", password="testpass123")
        other = User.objects.create_user(username="other", password="testpass123")
        poste = PosteVente.objects.create(
            vendeur=owner,
            nom="Test",
            est_actif=True,
            mode_pos=False,
        )
        with pytest.raises(ValueError, match="Seul"):
            SaleFinalizer._validate_poste_vente(other, poste.id, centralized=False)

    def test_validate_poste_vente_superuser_bypass(self):
        """Superuser peut utiliser le poste d'un autre vendeur."""
        owner = User.objects.create_user(username="owner", password="testpass123")
        admin = User.objects.create_superuser(username="admin", password="adminpass123", email="admin@test.com")
        poste = PosteVente.objects.create(
            vendeur=owner,
            nom="Test",
            est_actif=True,
            mode_pos=False,
        )
        result = SaleFinalizer._validate_poste_vente(admin, poste.id, centralized=False)
        assert result is not None
        assert result.id == poste.id

    def test_validate_poste_vente_centralized_mode(self):
        """En mode centralisé, n'importe quel vendeur peut utiliser le poste."""
        owner = User.objects.create_user(username="owner", password="testpass123")
        other = User.objects.create_user(username="other", password="testpass123")
        poste = PosteVente.objects.create(
            vendeur=owner,
            nom="Test",
            est_actif=True,
            mode_pos=False,
        )
        result = SaleFinalizer._validate_poste_vente(other, poste.id, centralized=True)
        assert result is not None
        assert result.id == poste.id


@pytest.mark.django_db
class TestSaleFinalizerCreateFactureProduits:

    def test_create_facture_produits_basic(self):
        """Création de lignes FactureProduit en bulk."""
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Ibuprofène 400mg",
            selling_price=Decimal("800"),
            stock=50,
        )
        facture = Facture.objects.create(
            created_by=user,
            validated_by=user,
            status=Facture.Status.BROUILLON,
        )
        produits_data = [
            {"produit": produit.id, "quantity": 3, "selling_price": "800", "discount": "0", "tva": "0"},
            {"produit": produit.id, "quantity": 2, "selling_price": "800", "discount": "50", "tva": "0"},
        ]

        SaleFinalizer._create_facture_produits(facture, produits_data)

        lines = FactureProduit.objects.filter(facture=facture).order_by("id")
        assert lines.count() == 2
        assert lines[0].quantity == 3
        assert lines[0].selling_price == Decimal("800.00")
        assert lines[1].quantity == 2
        assert lines[1].discount == Decimal("50.00")


@pytest.mark.django_db
class TestSaleFinalizerHandlePromis:

    def test_handle_promis_creates_entries(self):
        """Les produits marqués is_promis créent des entrées Promis."""
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Médicament Promis",
            selling_price=Decimal("1000"),
            stock=10,
        )
        facture = Facture.objects.create(
            created_by=user,
            validated_by=user,
            status=Facture.Status.BROUILLON,
        )
        produits_data = [
            {"produit": produit.id, "is_promis": True, "promis_quantity": 5, "promis_phone": "690000000"},
            {"produit": produit.id, "is_promis": False, "promis_quantity": 0},
        ]

        SaleFinalizer._handle_promis(facture, produits_data, client_id=None, client_name_override="Client Test", validation_user=user)

        promis = Promis.objects.filter(facture=facture)
        assert promis.count() == 1
        assert promis[0].quantite == 5
        assert promis[0].client_phone == "690000000"

    def test_handle_promis_no_promis_products(self):
        """Aucun produit promis — aucune entrée créée."""
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Normal Product",
            selling_price=Decimal("500"),
            stock=10,
        )
        facture = Facture.objects.create(
            created_by=user,
            validated_by=user,
            status=Facture.Status.BROUILLON,
        )
        produits_data = [
            {"produit": produit.id, "is_promis": False, "promis_quantity": 0},
        ]

        SaleFinalizer._handle_promis(facture, produits_data, client_id=None, client_name_override="", validation_user=user)

        assert Promis.objects.filter(facture=facture).count() == 0


@pytest.mark.django_db
class TestSaleFinalizerHandleOrdonnancier:

    def test_handle_ordonnancier_creates_entry(self):
        """Création d'un ordonnancier avec ses lignes."""
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Amoxicilline 500mg",
            selling_price=Decimal("1200"),
            stock=20,
        )
        facture = Facture.objects.create(
            created_by=user,
            validated_by=user,
            status=Facture.Status.BROUILLON,
        )
        ordonnance_data = {
            "patient_nom": "Jean Dupont",
            "prescripteur_nom": "Dr. Martin",
            "lignes": [
                {"produit_id": produit.id, "produit_nom": "Amoxicilline 500mg", "quantite": 3},
                {"produit_id": produit.id, "produit_nom": "Amoxicilline 500mg", "quantite": 2},
            ],
        }

        SaleFinalizer._handle_ordonnancier(ordonnance_data, facture, user, image_file=None)

        ordonnanciers = Ordonnancier.objects.filter(facture=facture)
        assert ordonnanciers.count() == 1
        assert ordonnanciers[0].patient_nom == "Jean Dupont"
        assert ordonnanciers[0].prescripteur_nom == "Dr. Martin"
        assert ordonnanciers[0].lignes.count() == 2


@pytest.mark.django_db
class TestSaleFinalizerFinalizeSale:

    def test_finalize_sale_empty_products_raises(self):
        """Finalisation avec liste de produits vide — lève ValueError."""
        user = User.objects.create_user(username="seller", password="testpass123")
        with pytest.raises(ValueError, match="vide"):
            SaleFinalizer.finalize_sale(user, {"produits": []}, centralized=False)

    def test_finalize_sale_no_poste_vente_raises(self):
        """Finalisation sans poste de vente actif — lève ValueError."""
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Test Product",
            selling_price=Decimal("500"),
            stock=10,
        )
        data = {
            "produits": [{"produit": produit.id, "quantity": 1, "selling_price": "500"}],
        }
        with pytest.raises(ValueError, match="point de vente"):
            SaleFinalizer.finalize_sale(user, data, centralized=False)

    def test_finalize_sale_centralized_no_caisse_raises(self):
        """Mode centralisé sans caisse ouverte — lève ValueError."""
        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Test Product",
            selling_price=Decimal("500"),
            stock=10,
        )
        PosteVente.objects.create(
            vendeur=user,
            nom="POS Test",
            est_actif=True,
            mode_pos=True,
            caisse=None,
        )
        data = {
            "produits": [{"produit": produit.id, "quantity": 1, "selling_price": "500"}],
            "poste_vente_id": None,
        }
        with pytest.raises(ValueError, match="point de caisse"):
            SaleFinalizer.finalize_sale(user, data, centralized=True)


@pytest.mark.django_db
class TestSaleFinalizerMultiLotPayload:
    """Tests pour la finalisation d'une vente multi-lots."""

    def test_finalize_sale_multi_lot_creates_lignes_and_movements(self):
        """
        Payload multi-lots : une entree par lot avec lot_id, quantite, prix_unitaire.
        On verifie la creation de LigneFacture + MouvementStock SORTIE par lot.
        """
        from datetime import datetime, date

        user = User.objects.create_user(username="seller", password="testpass123")
        produit = Produit.objects.create(
            name="Doliprane 1000mg",
            selling_price=Decimal("500"),
            stock=50,
            use_lot_management=True,
        )
        # Creer 2 lots
        lot1 = StockLot.objects.create(
            produit=produit,
            lot="LOT-FIN-1",
            quantity_initial=30,
            quantity_remaining=30,
            price_cost=Decimal("200"),
            selling_price=Decimal("500"),
            date_reception=datetime(2025, 1, 1),
            date_expiration=date(2025, 12, 31),
        )
        lot2 = StockLot.objects.create(
            produit=produit,
            lot="LOT-FIN-2",
            quantity_initial=20,
            quantity_remaining=20,
            price_cost=Decimal("220"),
            selling_price=Decimal("500"),
            date_reception=datetime(2025, 2, 1),
            date_expiration=date(2026, 6, 30),
        )
        produit.refresh_from_db()

        # Creer un poste de caisse + poste de vente actif
        poste_caisse = PosteCaisse.objects.create(nom="Caisse Test", code="C-TEST-01")
        PosteVente.objects.create(
            vendeur=user,
            nom="POS Multi-Lot",
            est_actif=True,
            mode_pos=False,
            caisse=poste_caisse,
        )

        # Payload multi-lots : une entree par lot
        data = {
            "client": None,
            "client_name_override": "Client Multi-Lot",
            "remise": "0",
            "produits": [
                {
                    "produit": produit.id,
                    "quantity": 3,
                    "selling_price": "500",
                    "discount": "0",
                    "tva": "0",
                    "lot_id": lot1.id,
                },
                {
                    "produit": produit.id,
                    "quantity": 2,
                    "selling_price": "500",
                    "discount": "0",
                    "tva": "0",
                    "lot_id": lot2.id,
                },
            ],
            "paiements": [{"mode": "especes", "montant": "2500"}],
            "centralized_cash_register": False,
        }

        facture = SaleFinalizer.finalize_sale(user, data, centralized=False)

        # Verifier que la facture est creee et validee
        assert facture is not None
        assert facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]

        # Verifier que 2 LigneFacture sont creees avec stock_lot differents
        lines = FactureProduit.objects.filter(facture=facture).order_by("id")
        assert lines.count() == 2, "2 LigneFacture doivent etre creees (une par lot)"
        assert lines[0].stock_lot_id == lot1.id
        assert lines[1].stock_lot_id == lot2.id
        assert lines[0].quantity == 3
        assert lines[1].quantity == 2

        # Verifier que les allocations sont creees pour chaque lot
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        )
        assert allocations.count() == 2
        alloc_lot_ids = set(allocations.values_list("stock_lot_id", flat=True))
        assert alloc_lot_ids == {lot1.id, lot2.id}

        # Verifier que les MouvementStock SORTIE sont crees
        mouvements = MouvementStock.objects.filter(facture=facture)
        assert mouvements.count() >= 2, (
            "Au moins 2 mouvements de stock SORTIE doivent etre crees (un par lot)"
        )
        for mvt in mouvements:
            assert mvt.type_mouvement == MouvementStock.TypeMouvement.SORTIE
            assert mvt.quantite < 0  # les sorties sont negatives

        # Verifier que les lots ont ete decrements
        lot1.refresh_from_db()
        lot2.refresh_from_db()
        assert lot1.quantity_remaining == 27  # 30 - 3
        assert lot2.quantity_remaining == 18  # 20 - 2
