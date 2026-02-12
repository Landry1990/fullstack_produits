
import os
import django
import sys
import uuid
from decimal import Decimal

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Avoir, Fournisseur, Produit, LigneAvoir, MouvementStock
from rest_framework.test import APIRequestFactory
from api.views.commandes import AvoirViewSet

def verify_sudo_mode():
    print("--- Starting Sudo Mode Verification for Avoirs ---")
    
    # 1. Setup Users
    creator, _ = User.objects.get_or_create(username='creator_user')
    validator, _ = User.objects.get_or_create(username='sudo_validator')
    validator.set_password('securepassword')
    validator.save()
    print(f"Users: Creator={creator.username}, Validator={validator.username}")

    # 2. Setup Data
    fournisseur, _ = Fournisseur.objects.get_or_create(name="Test Supplier")
    
    produit = Produit.objects.first()
    if not produit:
        unique_suffix = str(uuid.uuid4())[:8]
        produit = Produit.objects.create(
            name=f"Test Product {unique_suffix}",
            stock=100,
            cost_price=10,
            cip=f"TEST-{unique_suffix}"
        )
        print(f"Created Product: {produit.name}")
    else:
        print(f"Using Existing Product: {produit.name} (Stock: {produit.stock})")

    original_stock = produit.stock

    # 3. Create Avoir
    unique_avoir_num = f"AVOIR-{str(uuid.uuid4())[:8]}"
    avoir = Avoir.objects.create(
        numero=unique_avoir_num,
        fournisseur=fournisseur,
        status='BROUILLON',
        created_by=creator
    )
    # Remove 'total' from create call if it's a property
    LigneAvoir.objects.create(
        avoir=avoir,
        produit=produit,
        produit_nom=produit.name,
        quantity=5, 
        price=10
    )
    print(f"Created Avoir {avoir.numero} with 5 items (Target Stock: {original_stock - 5})")

    # 4. Simulate Validation Request with Sudo Credentials
    factory = APIRequestFactory()
    url = f'/api/avoirs/{avoir.id}/valider/'
    data = {
        'validated_by_id': validator.id,
        'password': 'securepassword'
    }
    request = factory.post(url, data, format='json')
    request.user = creator 

    # 5. Execute Action
    view = AvoirViewSet.as_view({'post': 'valider'})
    
    try:
        response = view(request, pk=avoir.id)
    except Exception as e:
        print(f"View execution failed: {e}")
        return

    print(f"Validation Response Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.data}")
        return

    # 6. Verify Results
    avoir.refresh_from_db()
    produit.refresh_from_db()
    
    print(f"Avoir Status: {avoir.status}")
    print(f"Avoir Validated By: {avoir.validated_by.username if avoir.validated_by else 'None'}")
    print(f"Product Stock: {produit.stock} (Expected {original_stock - 5})")

    # 7. Check Audit / Movement
    last_movement = MouvementStock.objects.filter(produit=produit).order_by('-id').first()
    if last_movement:
        print(f"Last Movement User: {last_movement.user.username}")
        if last_movement.user == validator:
             print("SUCCESS: Movement was recorded with Sudo Validator user.")
        else:
             print(f"FAILURE: Movement recorded with {last_movement.user.username}, expected {validator.username}")
    else:
        print("FAILURE: No stock movement found.")

    if avoir.validated_by == validator and produit.stock == (original_stock - 5):
        print("SUCCESS: Avoir validated correctly with Sudo Mode.")
    else:
        print("FAILURE: Validation state incorrect. Note: Stock might not strictly decrease if logic differs.")
        
    # Cleanup
    try:
        avoir.delete()
        print("Cleanup: Avoir deleted.")
    except:
        pass

if __name__ == '__main__':
    try:
        verify_sudo_mode()
    except Exception as e:
        print(f"An error occurred: {e}")
