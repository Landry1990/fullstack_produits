import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit

def test_margins():
    print("Testing margin calculation...")
    
    # Create a product with known cost and selling price
    p = Produit(
        name="TEST_MARGE",
        stock=10,
        cost_price=Decimal('100.00'),
        selling_price=Decimal('150.00'),
        tva=Decimal('19.25')
    )
    p.save()
    
    # Refresh from DB
    p.refresh_from_db()
    
    print(f"Product: {p.name}")
    print(f"Cost Price: {p.cost_price}")
    print(f"Selling Price: {p.selling_price}")
    print(f"TVA: {p.tva}")
    print(f"Taux Marge (Expected 50.00): {p.taux_marge}")
    print(f"Pourcentage Marge (Expected 33.33): {p.pourcentage_marge}")
    
    assert p.taux_marge == Decimal('50.00'), f"Taux Marge incorrect: {p.taux_marge}"
    # 33.3333... rounded to 2 decimal places is 33.33
    assert abs(p.pourcentage_marge - Decimal('33.33')) < Decimal('0.01'), f"Pourcentage Marge incorrect: {p.pourcentage_marge}"
    
    print("Margin calculation test PASSED!")
    
    # Clean up
    p.delete()

if __name__ == "__main__":
    test_margins()
