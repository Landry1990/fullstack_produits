import os
import sys
import django

sys.path.append('c:\\Projet Fullstack\\fullstack_produits\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture

def check_duplicates():
    dupes = Facture.objects.filter(numero_facture='FAC-000090')
    print(f"Count for FAC-000090: {dupes.count()}")
    for d in dupes:
        print(f"ID: {d.id}, Date: {d.date}, Status: {d.status}, CreatedBy: {d.created_by.username if d.created_by else 'None'}")

if __name__ == "__main__":
    check_duplicates()
