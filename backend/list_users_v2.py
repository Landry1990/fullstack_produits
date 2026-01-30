import os
import sys
import django

# Add project root to sys.path
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')

# Set environment variable
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django
django.setup()

from django.contrib.auth.models import User

def list_users():
    try:
        users = User.objects.filter(is_active=True)
        print("Active Users:")
        for u in users:
            print(f"- {u.username} (ID: {u.id})")
    except Exception as e:
        print(f"Error listing users: {e}")

if __name__ == "__main__":
    list_users()
