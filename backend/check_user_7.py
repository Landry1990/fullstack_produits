import os
import django
import json

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User

def check_user(user_id):
    try:
        u = User.objects.get(id=user_id)
        print(f"User: {u.username}")
        print(f"Email: {u.email}")
        print(f"Is Superuser: {u.is_superuser}")
        print(f"Is Active: {u.is_active}")
        
        if hasattr(u, 'profile'):
            p = u.profile
            print(f"Profile Role: {p.role}")
            print(f"Allowed Menus: {p.allowed_menus}")
            print(f"Max Discount: {p.max_discount_rate}")
        else:
            print("No Profile found!")
            
    except User.DoesNotExist:
        print(f"User {user_id} not found.")

if __name__ == "__main__":
    check_user(7)
