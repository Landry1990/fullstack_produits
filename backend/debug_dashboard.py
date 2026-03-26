
import os
import django
from django.db import connection, reset_queries
from django.test import RequestFactory
from django.contrib.auth.models import User
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pharma_stock.settings')
django.setup()

from api.models import Fournisseur, Commande, CommandeProduit, PaiementFournisseur
from api.views.dashboard import DashboardViewSet

def debug_dashboard_queries():
    # Setup data
    Fournisseur.objects.all().delete()
    User.objects.all().delete()
    
    user = User.objects.create_superuser('admin', 'admin@test.com', 'password')
    f1 = Fournisseur.objects.create(name="F1", email="f1@test.com", phone="123456789")
    f2 = Fournisseur.objects.create(name="F2", email="f2@test.com", phone="987654321")

    c1 = Commande.objects.create(fournisseur=f1, status='CLOT')
    CommandeProduit.objects.create(commande=c1, price=10, price_cost=10, quantity=10)
    PaiementFournisseur.objects.create(fournisseur=f1, montant=50)

    reset_queries()
    
    factory = RequestFactory()
    request = factory.get('/api/dashboard/supplier_debts/')
    request.user = user
    
    view = DashboardViewSet.as_view({'get': 'supplier_debts'})
    response = view(request)
    
    print(f"Status: {response.status_code}")
    print(f"Num queries: {len(connection.queries)}")
    for i, q in enumerate(connection.queries):
        print(f"Query {i+1}: {q['sql']}")

if __name__ == "__main__":
    debug_dashboard_queries()
