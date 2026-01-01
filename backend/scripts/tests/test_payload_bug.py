import os
import json
import django

# Setup Django first
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Then import DRF and models
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User
from api.models import Facture, Produit, FactureProduit, StockLot, Commande, CommandeProduit, Fournisseur

def test_payload_mismatch():
    print("Testing Payload Mismatch...")
    
    # Setup data
    user = User.objects.create_user(username='tester', password='password')
    produit = Produit.objects.create(name="TestProd", selling_price=1000, cost_price=500, stock=0)
    fournisseur = Fournisseur.objects.create(name="TestFournisseur")
    commande = Commande.objects.create(fournisseur=fournisseur)
    cp = CommandeProduit.objects.create(produit=produit, commande=commande, quantity=10, price=500)
    
    # Create a lot
    lot = StockLot.objects.create(
        produit=produit, commande_produit=cp, fournisseur=fournisseur,
        lot="TARGET-LOT", quantity_initial=10, quantity_remaining=10
    )
    
    client = APIClient()
    client.force_authenticate(user=user)
    
    # Create Facture
    facture = Facture.objects.create(status="BROU")
    
    # Attempt 1: Send 'stock_lot' (simulate current frontend)
    print("\nAttempt 1: Sending 'stock_lot'")
    response = client.post(
        '/api/facture-produits/',
        {
            'facture': facture.id,
            'produit': produit.id,
            'quantity': 1,
            'selling_price': '1000',
            'stock_lot': lot.id  # Frontend uses this key
        },
        format='json'
    )
    
    if response.status_code == 201:
        fp_id = response.data['id']
        fp = FactureProduit.objects.get(id=fp_id)
        if fp.stock_lot is None:
            print("FAIL: stock_lot was IGNORED (value is None). Frontend bug confirmed.")
        else:
            print(f"SUCCESS: stock_lot was accepted (value is {fp.stock_lot}).")
            
    # Attempt 2: Send 'stock_lot_id' (correct key?)
    print("\nAttempt 2: Sending 'stock_lot_id'")
    response2 = client.post(
        '/api/facture-produits/',
        {
            'facture': facture.id,
            'produit': produit.id,
            'quantity': 1,
            'selling_price': '1000',
            'stock_lot_id': lot.id  # Expected backend key
        },
        format='json'
    )
    
    if response2.status_code == 201:
        fp_id = response2.data['id']
        fp = FactureProduit.objects.get(id=fp_id)
        if fp.stock_lot is not None:
             print(f"SUCCESS: stock_lot_id successfully set the lot (value is {fp.stock_lot}).")
        else:
             print("FAIL: stock_lot_id was also ignored?")

if __name__ == "__main__":
    try:
        test_payload_mismatch()
    except Exception as e:
        print(f"Error: {e}")
