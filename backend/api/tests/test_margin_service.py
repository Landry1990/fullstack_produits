"""
Tests pour le service centralisé des marges
Valide les formules et la cohérence des calculs
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from datetime import datetime, timedelta
from api.services.margin_service import MarginService
from api.models import Produit, Facture, FactureProduit, FactureProduitAllocation, StockLot, Client, Fournisseur

class MarginServiceTestCase(TestCase):
    """Tests pour le service centralisé des marges"""
    
    def setUp(self):
        """Configuration des données de test"""
        self.margin_service = MarginService()
        
        # Produits de test
        self.produit1 = Produit.objects.create(
            name="Produit A",
            cost_price=Decimal('50.00'),
            selling_price=Decimal('100.00'),
            cip1="001"
        )
        
        self.produit2 = Produit.objects.create(
            name="Produit B", 
            cost_price=Decimal('80.00'),
            selling_price=Decimal('120.00'),
            cip1="002"
        )
        
        # Client et fournisseur
        self.test_client = Client.objects.create(
            name="Client Test",
            client_type="PARTICULIER"
        )
        
        self.fournisseur = Fournisseur.objects.create(
            name="Fournisseur Test"
        )
        
        # Lots de stock
        self.lot1 = StockLot.objects.create(
            produit=self.produit1,
            fournisseur=self.fournisseur,
            lot="LOT001",
            quantity=100,
            quantity_remaining=50,
            price_cost=Decimal('50.00'),
            selling_price=Decimal('100.00'),
            date_expiration=timezone.now() + timedelta(days=90)
        )
    
    def test_calculate_product_margin_normal_case(self):
        """Test calcul marge normal"""
        cost_price = Decimal('50.00')
        selling_price = Decimal('100.00')
        
        margins = MarginService.calculate_product_margin(cost_price, selling_price)
        
        self.assertEqual(margins['taux_marge'], Decimal('2.0000'))
        self.assertEqual(margins['pourcentage_marge'], Decimal('50.00'))
        self.assertEqual(margins['marge_unitaire'], Decimal('50.00'))
    
    def test_calculate_product_margin_zero_cost(self):
        """Test avec coût d'achat nul"""
        cost_price = Decimal('0.00')
        selling_price = Decimal('100.00')
        
        margins = MarginService.calculate_product_margin(cost_price, selling_price)
        
        self.assertEqual(margins['taux_marge'], Decimal('0.00'))
        self.assertEqual(margins['pourcentage_marge'], Decimal('0.00'))
        self.assertEqual(margins['marge_unitaire'], Decimal('0.00'))
    
    def test_calculate_product_margin_zero_price(self):
        """Test avec prix de vente nul"""
        cost_price = Decimal('50.00')
        selling_price = Decimal('0.00')
        
        margins = MarginService.calculate_product_margin(cost_price, selling_price)
        
        self.assertEqual(margins['taux_marge'], Decimal('0.00'))
        self.assertEqual(margins['pourcentage_marge'], Decimal('0.00'))
        self.assertEqual(margins['marge_unitaire'], Decimal('0.00'))
    
    def test_calculate_product_margin_none_values(self):
        """Test avec valeurs None"""
        margins = MarginService.calculate_product_margin(None, None)
        
        self.assertEqual(margins['taux_marge'], Decimal('0.00'))
        self.assertEqual(margins['pourcentage_marge'], Decimal('0.00'))
        self.assertEqual(margins['marge_unitaire'], Decimal('0.00'))
    
    def test_calculate_lot_margin(self):
        """Test calcul marge pour un lot"""
        margins = MarginService.calculate_lot_margin(self.lot1)
        
        self.assertEqual(margins['taux_marge'], Decimal('2.0000'))
        self.assertEqual(margins['pourcentage_marge'], Decimal('50.00'))
        self.assertEqual(margins['marge_unitaire'], Decimal('50.00'))
    
    def test_calculate_facture_margin(self):
        """Test calcul marge pour une facture"""
        # Créer une facture avec produits
        facture = Facture.objects.create(
            client=self.test_client,
            total_ht=Decimal('150.00'),
            total_ttc=Decimal('180.00'),
            status=Facture.Status.VALIDEE,
            date=timezone.now()
        )
        
        # Créer allocations (simule la vente)
        FactureProduitAllocation.objects.create(
            facture_produit__facture=facture,
            stock_lot=self.lot1,
            quantity=2,
            cost_price=Decimal('50.00'),
            selling_price=Decimal('100.00')
        )
        
        margins = MarginService.calculate_facture_margin(facture)
        
        # CA HT: 150.00, Coût achat: 100.00 (2 * 50), Marge: 50.00
        self.assertEqual(margins['cout_achat'], Decimal('100.00'))
        self.assertEqual(margins['marge_brute'], Decimal('50.00'))
        self.assertEqual(margins['marge_pct'], Decimal('33.33'))  # 50/150*100
    
    def test_calculate_period_margin(self):
        """Test calcul marge sur période"""
        # Créer factures sur une période
        date_debut = timezone.now().date() - timedelta(days=1)
        date_fin = timezone.now().date() + timedelta(days=1)
        
        facture1 = Facture.objects.create(
            client=self.test_client,
            total_ht=Decimal('100.00'),
            status=Facture.Status.VALIDEE,
            date=timezone.now()
        )
        
        margins = MarginService.calculate_period_margin(date_debut, date_fin)
        
        # Vérifie que les statistiques sont retournées
        self.assertIn('ca_ht_total', margins)
        self.assertIn('cout_achat_total', margins)
        self.assertIn('marge_brute', margins)
        self.assertIn('marge_pct', margins)
        self.assertIn('nb_factures', margins)
    
    def test_update_product_margins_all(self):
        """Test mise à jour marges de tous les produits"""
        # Mettre les marges à zéro
        self.produit1.taux_marge = Decimal('0.00')
        self.produit1.pourcentage_marge = Decimal('0.00')
        self.produit1.save()
        
        # Mettre à jour via le service
        count = MarginService.update_product_margins()
        
        # Vérifier la mise à jour
        self.produit1.refresh_from_db()
        self.assertEqual(self.produit1.taux_marge, Decimal('2.0000'))
        self.assertEqual(self.produit1.pourcentage_marge, Decimal('50.00'))
        self.assertGreater(count, 0)
    
    def test_update_product_margins_selected(self):
        """Test mise à jour marges pour produits sélectionnés"""
        product_ids = [self.produit1.id]
        
        # Mettre les marges à zéro
        self.produit1.taux_marge = Decimal('0.00')
        self.produit1.pourcentage_marge = Decimal('0.00')
        self.produit1.save()
        
        # Mettre à jour via le service
        count = MarginService.update_product_margins(product_ids)
        
        # Vérifier la mise à jour
        self.produit1.refresh_from_db()
        self.assertEqual(self.produit1.taux_marge, Decimal('2.0000'))
        self.assertEqual(self.produit1.pourcentage_marge, Decimal('50.00'))
        self.assertEqual(count, 1)
    
    def test_get_margin_variance_analysis(self):
        """Test analyse variance des marges"""
        date_debut = timezone.now().date() - timedelta(days=10)
        date_fin = timezone.now().date() - timedelta(days=5)
        
        variance = MarginService.get_margin_variance_analysis(date_debut, date_fin)
        
        # Vérifie la structure
        self.assertIn('period1', variance)
        self.assertIn('period2', variance)
        self.assertIn('variance_amount', variance)
        self.assertIn('variance_pct', variance)
        
        # Vérifie les périodes
        self.assertIn('label', variance['period1'])
        self.assertIn('stats', variance['period1'])
        self.assertIn('label', variance['period2'])
        self.assertIn('stats', variance['period2'])
    
    def test_get_products_with_anomalous_margins(self):
        """Test détection produits avec marges anormales"""
        # Créer un produit avec marge très élevée
        produit_anormal = Produit.objects.create(
            name="Produit Anormal",
            cost_price=Decimal('1.00'),
            selling_price=Decimal('100.00'),
            cip1="999"
        )
        
        # Créer des ventes pour ce produit
        facture = Facture.objects.create(
            client=self.test_client,
            total_ht=Decimal('100.00'),
            status=Facture.Status.VALIDEE,
            date=timezone.now()
        )
        
        FactureProduitAllocation.objects.create(
            facture_produit__facture=facture,
            stock_lot=self.lot1,
            quantity=1,
            cost_price=Decimal('1.00'),
            selling_price=Decimal('100.00')
        )
        
        # Tester avec un seuil bas pour détecter l'anomalie
        products = MarginService.get_products_with_anomalous_margins(threshold=50.0, min_ca=Decimal('10.00'))
        
        # Vérifie la structure des résultats
        self.assertIsInstance(products, list)
        if products:  # Si des produits sont détectés
            product = products[0]
            self.assertIn('produit_id', product)
            self.assertIn('produit_name', product)
            self.assertIn('avg_margin_pct', product)
            self.assertIn('total_ca', product)
            self.assertIn('nb_ventes', product)
    
    def test_margin_calculation_consistency(self):
        """Test cohérence des calculs de marge"""
        # Test différentes valeurs pour vérifier la cohérence
        test_cases = [
            (Decimal('10.00'), Decimal('20.00'), Decimal('2.0000'), Decimal('50.00')),
            (Decimal('25.00'), Decimal('50.00'), Decimal('2.0000'), Decimal('50.00')),
            (Decimal('100.00'), Decimal('150.00'), Decimal('1.5000'), Decimal('33.33')),
        ]
        
        for cost, price, expected_taux, expected_pct in test_cases:
            margins = MarginService.calculate_product_margin(cost, price)
            
            self.assertEqual(margins['taux_marge'], expected_taux, 
                           f"Taux incorrect pour cost={cost}, price={price}")
            self.assertEqual(margins['pourcentage_marge'], expected_pct,
                           f"Pourcentage incorrect pour cost={cost}, price={price}")
            self.assertEqual(margins['marge_unitaire'], price - cost,
                           f"Marge unitaire incorrecte pour cost={cost}, price={price}")
    
    def test_rounding_behavior(self):
        """Test comportement des arrondis"""
        cost_price = Decimal('33.3333')
        selling_price = Decimal('100.0000')
        
        # Sans arrondi
        margins_no_round = MarginService.calculate_product_margin(cost_price, selling_price, rounding=False)
        
        # Avec arrondi
        margins_round = MarginService.calculate_product_margin(cost_price, selling_price, rounding=True)
        
        # Vérifie que l'arrondi est appliqué
        self.assertEqual(margins_round['pourcentage_marge'], Decimal('66.67'))
        self.assertEqual(margins_round['marge_unitaire'], Decimal('66.67'))
        
        # Vérifie que sans arrondi, on a plus de décimales
        self.assertGreater(str(margins_no_round['pourcentage_marge']).count('.'), 
                          str(margins_round['pourcentage_marge']).count('.'))


class MarginServiceIntegrationTestCase(TestCase):
    """Tests d'intégration pour le service des marges"""
    
    def setUp(self):
        """Configuration pour les tests d'intégration"""
        self.produit = Produit.objects.create(
            name="Produit Integration",
            cost_price=Decimal('50.00'),
            selling_price=Decimal('100.00'),
            cip1="INTEGRATION"
        )
    
    def test_service_integration_with_produit_model(self):
        """Test intégration avec le modèle Produit"""
        # Mettre à jour les marges via le service
        MarginService.update_product_margins([self.produit.id])
        
        # Rafraîchir depuis la base
        self.produit.refresh_from_db()
        
        # Vérifier que les champs du modèle sont corrects
        self.assertEqual(self.produit.taux_marge, Decimal('2.0000'))
        self.assertEqual(self.produit.pourcentage_marge, Decimal('50.00'))
    
    def test_formula_consistency_with_existing_calculations(self):
        """Test cohérence avec les calculs existants"""
        # Simuler les anciens calculs
        old_taux = self.produit.selling_price / self.produit.cost_price
        old_pct = ((self.produit.selling_price - self.produit.cost_price) / self.produit.selling_price) * 100
        
        # Calculer avec le nouveau service
        margins = MarginService.calculate_product_margin(self.produit.cost_price, self.produit.selling_price, rounding=False)
        
        # Vérifier la cohérence
        self.assertEqual(float(margins['taux_marge']), float(old_taux))
        self.assertAlmostEqual(float(margins['pourcentage_marge']), float(old_pct), places=2)
