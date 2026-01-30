import os
import sys
import django

sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Facture

def check_stuff():
    # 1. Check nkaha
    try:
        u = User.objects.get(username='nkaha')
        print(f"User: {u.username}, ID: {u.id}, First: '{u.first_name}', Last: '{u.last_name}'")
    except User.DoesNotExist:
        print("User 'nkaha' not found!")

    # 2. Check ANY invoice with created_by=None and status not ANN
    others = Facture.objects.filter(created_by__isnull=True).exclude(status='ANN')
    print(f"\nNon-Cancelled Invoices without Creator: {others.count()}")
    for i in others:
        print(f"- {i.numero_facture} ({i.status})")

if __name__ == "__main__":
    check_stuff()
