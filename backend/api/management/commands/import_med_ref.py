import os
import csv
from django.core.management.base import BaseCommand
from api.models import MedicamentReference
from django.db import transaction

class Command(BaseCommand):
    help = 'Importe la table de référence des médicaments depuis unified_meds.txt'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, help='Chemin du fichier unified_meds.txt')

    def handle(self, *args, **options):
        file_path = options.get('file')
        if not file_path:
            file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), 'unified_meds.txt')

        if not os.path.exists(file_path):
            self.stderr.write(f"Fichier non trouvé : {file_path}")
            return

        self.stdout.write(f"Début de l'import depuis {file_path}...")
        
        # Clear existing data? Or update?
        # For now, let's just update/create
        
        count = 0
        batch_size = 1000
        batch = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Read header
                header = f.readline()
                
                for line in f:
                    parts = line.strip().split('\t')
                    if len(parts) >= 2:
                        cis = parts[0]
                        nom = parts[1]
                        forme = parts[2] if len(parts) > 2 else ""
                        substances = parts[3] if len(parts) > 3 else ""
                        
                        batch.append(MedicamentReference(
                            cis=cis,
                            nom=nom,
                            forme=forme,
                            substances=substances
                        ))
                        
                        if len(batch) >= batch_size:
                            MedicamentReference.objects.bulk_create(
                                batch, 
                                update_conflicts=True,
                                update_fields=['nom', 'forme', 'substances'],
                                unique_fields=['cis']
                            )
                            count += len(batch)
                            self.stdout.write(f"Importé {count} médicaments...")
                            batch = []
                
                if batch:
                    MedicamentReference.objects.bulk_create(
                        batch, 
                        update_conflicts=True,
                        update_fields=['nom', 'forme', 'substances'],
                        unique_fields=['cis']
                    )
                    count += len(batch)

            self.stdout.write(self.style.SUCCESS(f"Import terminé avec succès : {count} médicaments importés."))
        except Exception as e:
            self.stderr.write(f"Erreur lors de l'import : {str(e)}")
