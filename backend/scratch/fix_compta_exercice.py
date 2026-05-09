
import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import ExerciceComptable, EcritureComptable

def run():
    # 1. Créer l'exercice 2026 s'il n'existe pas
    exercice, created = ExerciceComptable.objects.get_or_create(
        nom="Exercice 2026",
        defaults={
            'date_debut': date(2026, 1, 1),
            'date_fin': date(2026, 12, 31),
            'est_cloture': False
        }
    )
    if created:
        print(f"Exercice 2026 créé.")
    else:
        print(f"Exercice 2026 déjà existant.")

    # 2. Mettre à jour les écritures sans exercice
    count = EcritureComptable.objects.filter(exercice__isnull=True).update(exercice=exercice)
    print(f"{count} écritures mises à jour avec l'exercice 2026.")

if __name__ == "__main__":
    run()
