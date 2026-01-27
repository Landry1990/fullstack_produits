
from django.test import TestCase
from api.models import Produit, Substance, DrugInteraction
from api.clinical_service import ClinicalService

class ClinicalServiceTest(TestCase):
    def setUp(self):
        # Create Substances
        self.sub_aspirine = Substance.objects.create(nom="Aspirine")
        self.sub_warfarine = Substance.objects.create(nom="Warfarine")
        self.sub_paracetamol = Substance.objects.create(nom="Paracétamol")

        # Create Interaction
        self.interaction = DrugInteraction.objects.create(
            substance_a=self.sub_aspirine,
            substance_b=self.sub_warfarine,
            gravity="CONTRE_INDIQUE",
            description="Risque hémorragique accru"
        )

        # Create Products
        self.prod_aspirine = Produit.objects.create(
            name="Aspirine 500", stock=10, cost_price=100, selling_price=200
        )
        self.prod_aspirine.substances.add(self.sub_aspirine)

        self.prod_warfarine = Produit.objects.create(
            name="Coumadine", stock=10, cost_price=1000, selling_price=2000
        )
        self.prod_warfarine.substances.add(self.sub_warfarine)

        self.prod_doliprane = Produit.objects.create(
            name="Doliprane", stock=100, cost_price=500, selling_price=1000
        )
        self.prod_doliprane.substances.add(self.sub_paracetamol)

    def test_detection_interaction(self):
        # Test with interacting products
        product_ids = [self.prod_aspirine.id, self.prod_warfarine.id]
        alerts = ClinicalService.check_interactions(product_ids)
        
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]['type'], 'INTERACTION')
        self.assertEqual(alerts[0]['gravity'], 'CONTRE_INDIQUE')
        self.assertIn("Aspirine", alerts[0]['title'])
        self.assertIn("Warfarine", alerts[0]['title'])

    def test_no_interaction(self):
        # Test with safe products
        product_ids = [self.prod_aspirine.id, self.prod_doliprane.id]
        alerts = ClinicalService.check_interactions(product_ids)
        
        self.assertEqual(len(alerts), 0)

    def test_empty_list(self):
        alerts = ClinicalService.check_interactions([])
        self.assertEqual(len(alerts), 0)

    def test_single_product(self):
        alerts = ClinicalService.check_interactions([self.prod_aspirine.id])
        self.assertEqual(len(alerts), 0)
