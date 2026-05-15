"""
Importe Substance + MedicamentReference depuis une fixture JSON pré-générée.
À utiliser dans chaque nouvelle pharmacie pour avoir les DCI sans re-parser COMPO.txt.

Usage:
    python manage.py import_dci_data --input dci_data.json
    python manage.py import_dci_data --input dci_data.json --skip-existing
    python manage.py import_dci_data --input dci_data.json --link-produits
"""
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from django.core.serializers import deserialize
from api.models import Produit


class Command(BaseCommand):
    help = 'Import Substance et MedicamentReference depuis une fixture JSON'

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            type=str,
            required=True,
            help='Chemin du fichier JSON contenant les données DCI',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Ignore les entrées dont la PK existe déjà (utile si relance)',
        )
        parser.add_argument(
            '--link-produits',
            action='store_true',
            help="Lance ensuite l'auto-link des produits de cette pharmacie",
        )

    def handle(self, *args, **options):
        input_path = options['input']
        skip_existing = options['skip_existing']
        link_produits = options['link_produits']

        self.stdout.write(self.style.HTTP_INFO(f"Import DCI depuis {input_path}..."))

        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f"Fichier non trouvé : {input_path}"))
            return
        except json.JSONDecodeError as e:
            self.stderr.write(self.style.ERROR(f"JSON invalide : {e}"))
            return

        created_count = 0
        skipped_count = 0
        updated_count = 0

        with transaction.atomic():
            for obj in deserialize('json', json.dumps(data)):
                model = obj.object
                pk = model.pk

                if skip_existing and model._meta.model.objects.filter(pk=pk).exists():
                    skipped_count += 1
                    continue

                try:
                    model.save(force_insert=True)
                    created_count += 1
                except Exception:
                    # Conflit de PK → on update
                    try:
                        existing = model._meta.model.objects.get(pk=pk)
                        for field in model._meta.fields:
                            fname = field.name
                            if fname != 'id' and hasattr(model, fname):
                                setattr(existing, fname, getattr(model, fname))
                        existing.save()
                        updated_count += 1
                    except Exception as e2:
                        self.stderr.write(self.style.WARNING(f"  Erreur sur {model.__class__.__name__} pk={pk}: {e2}"))

        self.stdout.write(self.style.SUCCESS(
            f"Import terminé : {created_count} créés, {updated_count} mis à jour, {skipped_count} ignorés"
        ))

        if link_produits:
            self.stdout.write(self.style.HTTP_INFO("\n🔗 Lancement de l'auto-link des produits..."))
            from django.core.management import call_command
            call_command('link_dci_produits')
