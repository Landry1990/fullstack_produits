from django.test import TestCase
from decimal import Decimal
from .models import Produit, Rayon, Fournisseur, Facture, FactureProduit, Client

class FactureTVATests(TestCase):
    def setUp(self):
        self.rayon = Rayon.objects.create(name='Divers')
        self.fournisseur = Fournisseur.objects.create(name='Fournisseur Test', phone='0000000000', email='test@test.com')
        
        # Produit A: 1000F TTC (TVA 19.25%)
        # HT = 1000 / 1.1925 = 838.57
        # TVA = 1000 - 838.57 = 161.43
        self.produit_a = Produit.objects.create(
            name='Produit A', stock=100, cost_price=500, selling_price=1000, 
            tva=Decimal('19.25'), rayon=self.rayon, fournisseur=self.fournisseur
        )
        
        # Produit B: 2000F TTC (TVA 0%)
        self.produit_b = Produit.objects.create(
            name='Produit B', stock=100, cost_price=1000, selling_price=2000, 
            tva=Decimal('0.00'), rayon=self.rayon, fournisseur=self.fournisseur
        )
        
        self.client = Client.objects.create(name='Client Test', phone='1111111111', email='client@test.com')

    def test_tva_analysis_standard(self):
        '''Test TVA analysis without global discount'''
        facture = Facture.objects.create(client=self.client)
        FactureProduit.objects.create(facture=facture, produit=self.produit_a, quantity=1, selling_price=self.produit_a.selling_price)
        FactureProduit.objects.create(facture=facture, produit=self.produit_b, quantity=1, selling_price=self.produit_b.selling_price)
        
        facture.calculate_totals() 
        
        analysis = facture.get_tva_analysis()
        
        # Check 19.25%
        tva_19 = analysis.get(Decimal('19.25'))
        self.assertIsNotNone(tva_19)
        self.assertAlmostEqual(tva_19['base_ht'], Decimal('838.57'), places=2)
        self.assertAlmostEqual(tva_19['montant_tva'], Decimal('161.43'), places=2)
        
        # Check 0%
        tva_0 = analysis.get(Decimal('0.00'))
        self.assertIsNotNone(tva_0)
        self.assertAlmostEqual(tva_0['base_ht'], Decimal('2000.00'), places=2)
        self.assertAlmostEqual(tva_0['montant_tva'], Decimal('0.00'), places=2)

    def test_tva_analysis_with_global_discount(self):
        '''Test TVA analysis with global discount on TTC'''
        facture = Facture.objects.create(client=self.client, remise=Decimal('300.00')) # Remise de 300F sur le TTC total (3000F)
        FactureProduit.objects.create(facture=facture, produit=self.produit_a, quantity=1, selling_price=self.produit_a.selling_price)
        FactureProduit.objects.create(facture=facture, produit=self.produit_b, quantity=1, selling_price=self.produit_b.selling_price)
        
        facture.calculate_totals()
        
        # Total Initial = 3000 F TTC
        # Remise = 300 F (10%)
        # Total Final = 2700 F TTC
        # Ratio = 0.9
        
        analysis = facture.get_tva_analysis()
        
        # Check 19.25% (Should be reduced by 10%)
        tva_19 = analysis.get(Decimal('19.25'))
        # Original HT: 838.57 -> New: ~754.71
        # Original TVA: 161.43 -> New: ~145.29
        self.assertAlmostEqual(tva_19['base_ht'], Decimal('838.57') * Decimal('0.9'), places=2)
        self.assertAlmostEqual(tva_19['montant_tva'], Decimal('161.43') * Decimal('0.9'), places=2)
