import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Client, Facture
from decimal import Decimal

print("--- DIAGNOSTIC DEBT ---")

# 1. Init
clients = Client.objects.all()

for client in clients:
    # Calculate using current logic (only VALIDEE)
    current_logic_debt = client.current_debt
    
    # Calculate manual logic: All VALIDEE + PAYEE with 'en_compte' or remaining
    # We look specifically for invoices that are PAYEE but have 'en_compte' payments
    # which implies they are 'paid by credit', so the invoice is closed but debt exists.
    
    # Invoices that are PAYEE
    payee_invoices = client.facture_set.filter(status='PAYEE')
    
    hidden_debt = Decimal('0.00')
    relevant_invoices = []
    
    for inv in payee_invoices:
        # Check if it has 'en_compte' payment
        en_compte = inv.paiements.filter(mode_paiement='en_compte').exists()
        if en_compte:
            # If it was paid by credit, the AMOUNT of that credit is the debt
            # (Assuming mixed payments possible, we sum only en_compte amounts)
            credit_amount = sum(p.montant for p in inv.paiements.filter(mode_paiement='en_compte'))
            hidden_debt += credit_amount
            relevant_invoices.append(f"#{inv.id} ({credit_amount})")
            
    if hidden_debt > 0:
        print(f"Client: {client.name}")
        print(f"  Current DB Logic Debt: {current_logic_debt}")
        print(f"  Hidden Debt (PAYEE with credit): {hidden_debt}")
        print(f"  Total Real Debt: {current_logic_debt + hidden_debt}")
        print(f"  Invoices ignored: {', '.join(relevant_invoices)}")
        print("-" * 30)

print("--- END DIAGNOSTIC ---")
