import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.serializers import PaiementFournisseurSerializer
from api.models import Fournisseur, Commande

def test_validation():
    try:
        f = Fournisseur.objects.first()
        if not f:
            print("No supplier found to test with.")
            return

        # Mimic frontend payload
        payload = {
            "fournisseur": f.id,
            "montant": "5000",
            "mode_paiement": "ESP",
            "reference": "REF_TEST",
            "notes": "Test payment"
        }

        print(f"Testing payload: {payload}")

        serializer = PaiementFournisseurSerializer(data=payload)
        if serializer.is_valid():
            print("Validation SUCCESS!")
            print(serializer.validated_data)
        else:
            print("Validation FAILED!")
            print(serializer.errors)

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    test_validation()
