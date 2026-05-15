"""
Export Substance + MedicamentReference en fichier JSON réutilisable (fixture).
À exécuter une fois en local/dev pour produire le fichier dci_data.json.

Usage:
    python manage.py export_dci_data
    python manage.py export_dci_data --output dci_data.json
"""
import json
import os
from django.core.management.base import BaseCommand
from django.core.serializers import serialize
from api.models import Substance, MedicamentReference


class Command(BaseCommand):
    help = 'Export Substance et MedicamentReference en JSON réutilisable pour toutes les pharmacies'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='dci_data.json',
            help='Chemin du fichier JSON de sortie (default: dci_data.json)',
        )

    def handle(self, *args, **options):
        output_path = options['output']
        self.stdout.write(self.style.HTTP_INFO(f"Export DCI vers {output_path}..."))

        data = []

        substances = Substance.objects.order_by('nom')
        data.extend(json.loads(serialize('json', substances)))

        meds = MedicamentReference.objects.order_by('nom')
        data.extend(json.loads(serialize('json', meds)))

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        self.stdout.write(self.style.SUCCESS(
            f"Export terminé : {Substance.objects.count()} substances + "
            f"{MedicamentReference.objects.count()} médicaments de référence"
        ))
        self.stdout.write(f"Fichier : {os.path.abspath(output_path)}")
