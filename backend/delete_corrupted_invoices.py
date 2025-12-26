"""Script pour supprimer les factures corrompues (marquées PAYÉES sans entrée Caisse)"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Caisse
from django.db import transaction

print("=" * 60)
print("RECHERCHE DES FACTURES CORROMPUES")
print("=" * 60)

# Trouver les factures VAL/PAY sans entrée Caisse
factures_corrompues = []
for f in Facture.objects.filter(status__in=['VAL', 'PAY']):
    if f.paiements.count() == 0:
        factures_corrompues.append(f)

print(f"\nFactures trouvées: {len(factures_corrompues)}")
print("\nDÉTAILS:")
for f in factures_corrompues:
    client_name = f.client.name if f.client else "Client de passage"
    print(f"  ID: {f.id:4d} | Client: {client_name:25s} | Total: {f.total_ttc:10.2f} F | Status: {f.status} | Date: {f.date}")

# Demander confirmation
print("\n" + "=" * 60)
response = input("Voulez-vous SUPPRIMER ces factures corrompues? (oui/non): ")

if response.lower() == 'oui':
    print("\nSUPPRESSION EN COURS...")
    
    with transaction.atomic():
        for f in factures_corrompues:
            facture_id = f.id
            client_name = f.client.name if f.client else "Passage"
            total = f.total_ttc
            
            # Supprimer la facture (en cascade: produits, allocations FIFO, etc.)
            f.delete()
            print(f"  ✓ Facture #{facture_id} supprimée ({client_name}, {total} F)")
    
    print(f"\n✅ {len(factures_corrompues)} facture(s) supprimée(s) avec succès!")
else:
    print("\n❌ Annulation. Aucune facture supprimée.")
