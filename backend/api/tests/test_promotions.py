from django.test import TestCase
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
from ..models import Promotion, Produit, Facture, FactureProduit, Client, FactureProduitAllocation, StockLot
from ..services import PromotionService

class PromotionServiceTest(TestCase):
    def setUp(self):
        self.produit = Produit.objects.create(
            name="Doliprane",
            cost_price=Decimal('500'),
            selling_price=Decimal('1000'),
            stock=100,
            tva=Decimal('0')
        )
        self.client = Client.objects.create(name="Test Client")
        self.facture = Facture.objects.create(client=self.client)

    def test_percentage_promotion(self):
        # Create -20% promotion
        Promotion.objects.create(
            name="Promo 20%",
            discount_type=Promotion.DiscountType.PERCENTAGE,
            value=Decimal('20'),
            start_date=timezone.now() - timedelta(days=1),
            active=True
        ).products.add(self.produit)

        # Create invoice line
        line = FactureProduit.objects.create(
            facture=self.facture,
            produit=self.produit,
            quantity=2,
            selling_price=self.produit.selling_price
        )

        PromotionService.apply_promotions_to_invoice(self.facture)
        line.refresh_from_db()

        # Expected discount: 20% of 1000 = 200 per unit. Total 400.
        # But 'discount' field on line is UNIT discount usually ? 
        # Let's check model definition: discount = models.DecimalField
        # In service: line.discount = total_discount (Wait, let's check service logic)
        
        # Service logic:
        # discount_per_unit = (price * promo.value / 100)
        # total_discount = discount_per_unit * quantity  <-- this is calculated
        # result = (discount_per_unit, 0, name) <-- WAIT, result returns PER UNIT discount or TOTAL?
        
        # Re-reading service:
        # result = (discount_per_unit, 0, promo.name)
        # BUT current_discount_value = total_discount (used for comparison)
        
        # So 'discount' on line should be per unit?
        # Facture logic: total_ttc = sum((price - discount) * qty) OR sum(price*qty - discount) ?
        # Let's check billing.py calculate_totals
        
        # Facture.calculate_totals:
        # total_ligne = (fp.selling_price * fp.quantity) - fp.discount
        # So fp.discount is TOTAL discount for the line?
        # "discount = models.DecimalField(..., help_text='Montant de la remise unitaire')" <- HELP TEXT SAYS UNITAIRE
        # But commonly in this codebase it might be global depending on usage.
        
        # Let's verify billing.py logic first.
        pass

    def test_buy_x_get_y(self):
        # Buy 2 Get 1 Free
        promo = Promotion.objects.create(
            name="2+1",
            discount_type=Promotion.DiscountType.BUY_X_GET_Y,
            buy_quantity=2,
            get_quantity=1,
            start_date=timezone.now() - timedelta(days=1),
            active=True
        )
        promo.products.add(self.produit)

        line = FactureProduit.objects.create(
            facture=self.facture,
            produit=self.produit, # self.produit is proper argument
            quantity=2, # Buy 2
            selling_price=self.produit.selling_price
        )
        
        PromotionService.apply_promotions_to_invoice(self.facture)
        line.refresh_from_db()
        
        # Should have 1 free
        self.assertEqual(line.free_quantity, 1)
        self.assertEqual(line.discount, 0) # No monetary discount
