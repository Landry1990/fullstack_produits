import os
import sys
import django

sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Profile

def check_roles():
    print("Checking roles for key users...")
    
    for username in ['nkaha', 'laure', 'admin']:
        try:
            u = User.objects.get(username=username)
            role = "No Profile"
            if hasattr(u, 'profile'):
                role = u.profile.role
            print(f"User: {username:<10} Role: {role}")
        except User.DoesNotExist:
            print(f"User: {username:<10} Not Found")

if __name__ == "__main__":
    check_roles()
