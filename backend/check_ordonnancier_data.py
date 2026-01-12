import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Ordonnancier

print(f"Total Ordonnancier entries: {Ordonnancier.objects.count()}")
for ord in Ordonnancier.objects.all().order_by('-created_at')[:5]:
    print(f"ID: {ord.pk}, Patient: {ord.patient_nom}, Date: {ord.date_delivrance}")
    for ligne in ord.lignes.all():
        print(f"  - Produit: {ligne.produit_nom} (ID Produit: {ligne.produit_id}), Qte: {ligne.quantite}")
