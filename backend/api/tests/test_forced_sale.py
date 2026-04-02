import pytest
from decimal import Decimal
from django.contrib.auth.models import User
from api.models import Produit, Facture, FactureProduit, Caisse
from api.services.sales_service import SalesService
from django.utils import timezone

@pytest.mark.django_db
def test_forced_sale_creates_negative_stock():
    # 1. Setup
    admin = User.objects.create_superuser(username='admin', password='password', email='admin@test.com')
    # Ensure profile has can_sell_negative_stock (superuser has it by default in logic)
    
    product = Produit.objects.create(
        name="Test Product",
        cip1="123456",
        stock=2,
        selling_price=Decimal('100.0'),
        cost_price=Decimal('50.0'),
        use_lot_management=False
    )
    
    # 2. Prepare Data for Forced Sale (Quantity 10 > Stock 2)
    data = {
        'produits': [
            {
                'produit': product.id,
                'quantity': 10,
                'selling_price': '100.0',
                'discount': '0',
                'tva': '0',
                'is_promis': False # This means force sale if qty > stock
            }
        ],
        'paiements': [
            {'mode': 'especes', 'montant': '1000.0'}
        ],
        'mode_paiement': 'especes'
    }
    
    # 3. Execute
    facture = SalesService.finalize_sale(admin, data)
    
    # 4. Verify
    product.refresh_from_db()
    assert product.stock == -8
    assert facture.status == Facture.Status.PAYEE
    assert FactureProduit.objects.filter(facture=facture).count() == 1
    assert Caisse.objects.filter(facture=facture).count() == 1
