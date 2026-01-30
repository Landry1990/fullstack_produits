import os
import django
import sys
from django.contrib.auth.models import User

# Setup Django environment
sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
django.setup()

def list_users():
    users = User.objects.filter(is_active=True)
    print("Active Users:")
    for u in users:
        print(f"- {u.username} (ID: {u.id})")

if __name__ == "__main__":
    list_users()
