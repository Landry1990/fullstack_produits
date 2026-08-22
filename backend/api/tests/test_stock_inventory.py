
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


class StockInventoryTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_inv_test', password='password')
        self.client.force_authenticate(user=self.user)
        # Use force_login or authenticate for non-API direct calls if needed, 
        # Create unique suppliers first
        f1 = self.factory.create_fournisseur(name="S1", email="s1@test.com", phone="111111111")
        f2 = self.factory.create_fournisseur(name="S2", email="s2@test.com", phone="222222222")
        
        # Products
        self.p1 = self.factory.create_produit(name="Product 1", stock=50, use_lot_management=True, fournisseur=f1)
        self.lot1 = self.factory.create_stock_lot(produit=self.p1, quantity=50, lot_name="LOT-INV-01")
        
        self.p2 = self.factory.create_produit(name="Product 2", stock=20, use_lot_management=False, fournisseur=f2)
        
    def test_complete_inventory_flow(self):
        """Test full flow: Create -> Pre-populate -> Edit -> Validate."""
        # 1. Create Inventory
        url_create = reverse('inventaire-list')
        res_create = self.client.post(url_create, {'description': 'Test Inv', 'inventory_type': 'RAYON'})
        print(f"DEBUG: CREATE RESPONSE DATA = {res_create.data}")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        inv_id = res_create.data['id']
        
        # Vérification manuelle en base
        inv_check = Inventaire.objects.get(id=inv_id)
        print(f"DEBUG: DB CHECK - is_active={inv_check.is_active}, status={inv_check.status}")
        
        # 2. Pre-populate (for p1's category)
        url_pop = reverse('inventaire-pre-populate', args=[inv_id])
        print(f"DEBUG: URL POP = {url_pop}")
        res_pop = self.client.post(url_pop, {'rayon_id': self.p1.rayon.id})
        if res_pop.status_code != 200:
            print(f"DEBUG: RESPONSE CONTENT = {res_pop.content}")
        self.assertEqual(res_pop.status_code, status.HTTP_200_OK)
        
        # Check that a line was created for p1
        self.assertTrue(LigneInventaire.objects.filter(inventaire_id=inv_id, produit=self.p1).exists())
        line_p1 = LigneInventaire.objects.get(inventaire_id=inv_id, produit=self.p1)
        self.assertEqual(line_p1.stock_theorique, 50)
        
        # 3. Add p2 manually
        url_lines = reverse('inventaire-lignes', args=[inv_id])
        res_add = self.client.post(url_lines, {'produit': self.p2.id, 'quantite_physique': 18}) # Ecart -2
        self.assertEqual(res_add.status_code, status.HTTP_201_CREATED)
        
        # 4. Modify p1 quantity (Ecart +5)
        line_p1.quantite_physique = 55
        line_p1.save()
        
        # 5. Validate
        url_val = reverse('inventaire-validate', args=[inv_id])
        # Note: validate_sudo_mode might require sudo password if configured, 
        # but for superuser it might be bypassed or handled. 
        # Let's check if the view allows superuser without extra password in tests.
        res_val = self.client.post(url_val, {'sudo_password': 'password'}) # Added just in case
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)
        
        # 6. Verify stock updates
        self.p1.refresh_from_db()
        self.p2.refresh_from_db()
        self.assertEqual(self.p1.stock, 55)
        self.assertEqual(self.p2.stock, 18)
        
        # Verify lot update for p1
        self.lot1.refresh_from_db()
        self.assertEqual(self.lot1.quantity_remaining, 55)
        
        # Verify traceability
        self.assertTrue(MouvementStock.objects.filter(produit=self.p1, quantite=5).exists())
        self.assertTrue(MouvementStock.objects.filter(produit=self.p2, quantite=-2).exists())
        self.assertTrue(StockAdjustment.objects.filter(produit=self.p1, quantity_change=5).exists())

    # ------------------------------------------------------------------
    # Inventaire avec ecart positif (quantite physique > stock theorique)
    # ------------------------------------------------------------------
    def test_inventory_positive_gap_creates_positive_adjustment_movement(self):
        """Un inventaire avec quantite physique > stock theorique doit
        creer un MouvementStock de type AJUSTEMENT avec quantite positive."""
        # Produit avec stock theorique = 30
        produit = self.factory.create_produit(
            name="PosGap Product", stock=30, use_lot_management=True,
            fournisseur=self.p1.fournisseur,
        )
        self.factory.create_stock_lot(produit=produit, quantity=30, lot_name="LOT-POSGAP")

        # 1. Creer l'inventaire
        res_create = self.client.post(
            reverse('inventaire-list'),
            {'description': 'Inv ecart positif', 'inventory_type': 'RAYON'},
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        inv_id = res_create.data['id']

        # 2. Pre-populer
        res_pop = self.client.post(
            reverse('inventaire-pre-populate', args=[inv_id]),
            {'rayon_id': produit.rayon.id},
        )
        self.assertEqual(res_pop.status_code, status.HTTP_200_OK)

        # 3. Modifier la quantite physique (40 > 30 theorique => ecart +10)
        ligne = LigneInventaire.objects.get(inventaire_id=inv_id, produit=produit)
        ligne.quantite_physique = 40
        ligne.save()

        # 4. Valider
        res_val = self.client.post(
            reverse('inventaire-validate', args=[inv_id]),
            {'sudo_password': 'password'},
        )
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)

        # 5. Verifier le MouvementStock AJUSTEMENT avec quantite positive
        mvt = MouvementStock.objects.filter(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
        ).order_by('-date').first()
        self.assertIsNotNone(mvt, "Un MouvementStock AJUSTEMENT doit etre cree")
        self.assertEqual(mvt.quantite, 10, "La quantite du mouvement doit etre +10 (ecart positif)")
        self.assertGreater(mvt.quantite, 0, "La quantite doit etre positive pour un ecart positif")

        # 6. Verifier que le stock a ete mis a jour
        produit.refresh_from_db()
        self.assertEqual(produit.stock, 40)

    # ------------------------------------------------------------------
    # Inventaire avec ecart negatif (quantite physique < stock theorique)
    # ------------------------------------------------------------------
    def test_inventory_negative_gap_creates_negative_adjustment_movement(self):
        """Un inventaire avec quantite physique < stock theorique doit
        creer un MouvementStock de type AJUSTEMENT avec quantite negative."""
        # Produit avec stock theorique = 50
        produit = self.factory.create_produit(
            name="NegGap Product", stock=50, use_lot_management=True,
            fournisseur=self.p1.fournisseur,
        )
        self.factory.create_stock_lot(produit=produit, quantity=50, lot_name="LOT-NEGGAP")

        # 1. Creer l'inventaire
        res_create = self.client.post(
            reverse('inventaire-list'),
            {'description': 'Inv ecart negatif', 'inventory_type': 'RAYON'},
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        inv_id = res_create.data['id']

        # 2. Pre-populer
        res_pop = self.client.post(
            reverse('inventaire-pre-populate', args=[inv_id]),
            {'rayon_id': produit.rayon.id},
        )
        self.assertEqual(res_pop.status_code, status.HTTP_200_OK)

        # 3. Modifier la quantite physique (35 < 50 theorique => ecart -15)
        ligne = LigneInventaire.objects.get(inventaire_id=inv_id, produit=produit)
        ligne.quantite_physique = 35
        ligne.save()

        # 4. Valider
        res_val = self.client.post(
            reverse('inventaire-validate', args=[inv_id]),
            {'sudo_password': 'password'},
        )
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)

        # 5. Verifier le MouvementStock AJUSTEMENT avec quantite negative
        mvt = MouvementStock.objects.filter(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
        ).order_by('-date').first()
        self.assertIsNotNone(mvt, "Un MouvementStock AJUSTEMENT doit etre cree")
        self.assertEqual(mvt.quantite, -15, "La quantite du mouvement doit etre -15 (ecart negatif)")
        self.assertLess(mvt.quantite, 0, "La quantite doit etre negative pour un ecart negatif")

        # 6. Verifier que le stock a ete mis a jour
        produit.refresh_from_db()
        self.assertEqual(produit.stock, 35)

    # ------------------------------------------------------------------
    # Validation d'inventaire sans permission -> 403
    # ------------------------------------------------------------------
    def test_inventory_validation_without_permission_returns_403(self):
        """Un utilisateur non-superuser sans la permission can_adjust_stock
        ne peut pas valider un inventaire -> 403 Forbidden."""
        # Creer un utilisateur normal sans permission can_adjust_stock
        regular_user = self.factory.create_user(
            username='regular_user_inv', password='userpass123',
        )
        # can_adjust_stock est False par defaut sur le Profile
        self.assertFalse(regular_user.profile.can_adjust_stock)
        self.assertFalse(regular_user.is_superuser)

        # Authentifier en tant qu'utilisateur normal
        self.client.force_authenticate(user=regular_user)

        # Creer un produit et un inventaire
        produit = self.factory.create_produit(
            name="PermTest Product", stock=20, use_lot_management=False,
            fournisseur=self.p1.fournisseur,
        )

        res_create = self.client.post(
            reverse('inventaire-list'),
            {'description': 'Inv permission test', 'inventory_type': 'RAYON'},
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        inv_id = res_create.data['id']

        # Pre-populer
        res_pop = self.client.post(
            reverse('inventaire-pre-populate', args=[inv_id]),
            {'rayon_id': produit.rayon.id},
        )
        self.assertEqual(res_pop.status_code, status.HTTP_200_OK)

        # Modifier la quantite physique
        ligne = LigneInventaire.objects.get(inventaire_id=inv_id, produit=produit)
        ligne.quantite_physique = 18
        ligne.save()

        # Tenter de valider SANS sudo_password (utilise request.user directement)
        res_val = self.client.post(
            reverse('inventaire-validate', args=[inv_id]),
            {},
        )
        self.assertEqual(
            res_val.status_code, status.HTTP_403_FORBIDDEN,
            "La validation sans permission can_adjust_stock doit retourner 403",
        )

        # Verifier que l'inventaire n'a pas ete valide
        inv = Inventaire.objects.get(id=inv_id)
        self.assertEqual(inv.status, Inventaire.Status.EN_COURS)
