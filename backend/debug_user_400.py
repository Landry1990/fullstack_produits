import os
import django
import json
from decimal import Decimal

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.serializers import UserSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

def test_patch_user(user_id):
    try:
        user = User.objects.get(id=user_id)
        # Exact payload from frontend based on my recent edit
        data = {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_active": user.is_active,
            "profile": {
                "role": user.profile.role if hasattr(user, 'profile') else "VENDEUR",
                "allowed_menus": user.profile.allowed_menus if hasattr(user, 'profile') else [],
                "can_do_returns": user.profile.can_do_returns if hasattr(user, 'profile') else False,
                "can_sell_negative_stock": user.profile.can_sell_negative_stock if hasattr(user, 'profile') else False,
                "can_cash_out": user.profile.can_cash_out if hasattr(user, 'profile') else True,
                "can_delete_product": user.profile.can_delete_product if hasattr(user, 'profile') else False,
                "can_adjust_stock": user.profile.can_adjust_stock if hasattr(user, 'profile') else False,
                "can_delete_fournisseur": user.profile.can_delete_fournisseur if hasattr(user, 'profile') else False,
                "can_delete_commande": user.profile.can_delete_commande if hasattr(user, 'profile') else False,
                "can_close_commande": user.profile.can_close_commande if hasattr(user, 'profile') else False,
                "can_generate_coupon": user.profile.can_generate_coupon if hasattr(user, 'profile') else False,
                "can_cancel_invoice": user.profile.can_cancel_invoice if hasattr(user, 'profile') else False,
                "can_cancel_promis": user.profile.can_cancel_promis if hasattr(user, 'profile') else False,
                "can_manage_perimes": user.profile.can_manage_perimes if hasattr(user, 'profile') else False,
                "can_manage_avoirs": user.profile.can_manage_avoirs if hasattr(user, 'profile') else False,
                "can_modify_price": user.profile.can_modify_price if hasattr(user, 'profile') else False,
                "can_modify_invoice": user.profile.can_modify_invoice if hasattr(user, 'profile') else False,
                "max_discount_rate": float(user.profile.max_discount_rate) if hasattr(user, 'profile') else 0
            }
        }
        
        # Simulating CURRENT_USER is NOT superuser but HAS admin rights
        # (Though in UserViewSet, ONLY superusers can list/create/update if configured that way)
        # Wait, get_permissions uses IsAdminUser which check is_staff.
        
        factory = APIRequestFactory()
        request = factory.patch(f'/api/users/{user_id}/', data, format='json')
        admin = User.objects.filter(is_superuser=True).first()
        request.user = admin
        
        print("DEBUG: Serializing...")
        serializer = UserSerializer(user, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            print("Serializer is VALID")
            serializer.save()
            print("Serializer saved successfully")
        else:
            print("Serializer is INVALID")
            print(json.dumps(serializer.errors, indent=2))
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_patch_user(7)
