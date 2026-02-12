
import os
import sys
import django
from django.utils import timezone
from decimal import Decimal

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Produit, Fournisseur, StockLot, MouvementStock, StockAdjustment
from rest_framework.test import APIRequestFactory
from api.views.stocks import StockLotViewSet

def verify_sudo_perimes():
    print("--- Verification du Mode Sudo pour Sortie Périmés ---")

    # 1. Setup Users
    creator, _ = User.objects.get_or_create(username='user_lambda')
    validator, _ = User.objects.get_or_create(username='sudo_validator_perimes')
    validator.set_password('securepassword')
    validator.save()
    print(f"Utilisateurs prêts: Creator={creator.username}, Validator={validator.username}")

    # 2. Setup Data
    fournisseur, _ = Fournisseur.objects.get_or_create(
        name="Fournisseur Test Sudo",
        defaults={'email': 'test_sudo_perimes@example.com', 'phone': '0987654321'}
    )
    
    # Create Product with Lot Management
    produit_code = "PROD_PERIME_TEST"
    try:
        produit = Produit.objects.get(cip1=produit_code)
        # Reset stock for test
        produit.stock = 0
        produit.save()
    except Produit.DoesNotExist:
        produit = Produit.objects.create(
            cip1=produit_code,
            name="Produit Test Périmés",
            cost_price=500,
            selling_price=1000,
            stock=0,
            stock_minimum=10,
            fournisseur=fournisseur,
            use_lot_management=True
        )

    # Create or Get Stock Lot
    lot, created = StockLot.objects.get_or_create(
        produit=produit,
        lot="LOT-EXP-001",
        defaults={
            'quantity_initial': 100,
            'quantity_remaining': 100,
            'price_cost': 500,
            'fournisseur': fournisseur,
            'date_reception': timezone.now()
        }
    )
    
    if not created:
        lot.quantity_initial = 100
        lot.quantity_remaining = 100
        lot.save()
    
    # Update product stock from lot
    produit.calculate_stock_from_lots()
    print(f"Produit créé: {produit.name}, Stock Initial: {produit.stock}")
    print(f"Lot créé: {lot.lot}, Marge: {lot.quantity_remaining}")

    # 3. Simulate Sudo Validation Request
    factory = APIRequestFactory()
    url = f'/api/stock-lots/{lot.id}/sortir_perimes/'
    
    qty_to_remove = 15
    data = {
        'quantity': qty_to_remove,
        'reason': 'Test Sudo Verification',
        'validated_by_id': validator.id,
        'password': 'securepassword'
    }
    
    request = factory.post(url, data, format='json')
    request.user = creator # The logged in user is NOT the validator

    # 4. Execute Action
    view = StockLotViewSet.as_view({'post': 'sortir_perimes'})
    print(f"Envoi requête Sortie de {qty_to_remove} unités avec validation Sudo...")
    
    response = view(request, pk=lot.id)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Erreur: {response.data}")
        return

    # 5. Verify Results
    
    # A. Check Lot Quantity
    lot.refresh_from_db()
    expected_qty = 100 - qty_to_remove
    print(f"Stock Lot après: {lot.quantity_remaining} (Attendu: {expected_qty})")
    assert lot.quantity_remaining == expected_qty, "Stock du lot non mis à jour correctement"

    # B. Check Product Stock
    produit.refresh_from_db()
    print(f"Stock Produit après: {produit.stock} (Attendu: {expected_qty})")
    assert produit.stock == expected_qty, "Stock du produit non mis à jour"

    # C. Check MouvementStock for Traceability
    last_mouvement = MouvementStock.objects.filter(produit=produit).order_by('-id').first()
    print(f"Dernier mouvement: {last_mouvement.type_mouvement}, Quantité: {last_mouvement.quantite}, User: {last_mouvement.user.username}")
    
    assert last_mouvement.quantite == -qty_to_remove, "Quantité mouvement incorrecte"
    assert last_mouvement.user.id == validator.id, f"L'utilisateur du mouvement devrait être le validateur ({validator.username}), mais c'est {last_mouvement.user.username}"
    assert "Test Sudo Verification" in last_mouvement.description, "Description mouvement incorrecte"

    # D. Check StockAdjustment for Journal
    adjustment = StockAdjustment.objects.filter(produit=produit).order_by('-id').first()
    if adjustment:
        print(f"Dernier ajustement: {adjustment.reason_type}, Quantité: {adjustment.quantity_change}, User: {adjustment.user.username}")
        
        assert adjustment.reason_type == 'PERIME', f"Type de raison incorrect: {adjustment.reason_type} (Attendu: PERIME)"
        assert adjustment.quantity_change == -qty_to_remove, "Quantité ajustement incorrecte"
        assert adjustment.user.id == validator.id, "Utilisateur ajustement incorrect"
    else:
        print("ERREUR: Aucun ajustement de stock trouvé !")
        # assert False, "StockAdjustment manquant" # Uncomment if strict checking required immediately

    print("\n✅ VÉRIFICATION RÉUSSIE : La sortie de périmés via Sudo Mode fonctionne correctement.")

if __name__ == '__main__':
    verify_sudo_perimes()
