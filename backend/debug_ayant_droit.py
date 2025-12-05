import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Client, AyantDroit
from django.utils import timezone

def test_create_ayant_droit():
    print("Creating test client...")
    try:
        client = Client.objects.create(
            name="Test Pro Client",
            email="testpro@example.com",
            phone="+123456789",
            address="Test Address",
            client_type="PROFESSIONNEL",
            plafond=100000
        )
        print(f"Client created: {client.id} - {client.name}")

        print("Creating Ayant Droit...")
        ad = AyantDroit.objects.create(
            client=client,
            matricule="MAT123",
            nom="Beneficiary Name",
            date_creation=timezone.now().date()
        )
        print(f"Ayant Droit created: {ad.id} - {ad.nom} ({ad.matricule})")
        
        # Clean up
        print("Cleaning up...")
        client.delete()
        print("Done.")
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_create_ayant_droit()
