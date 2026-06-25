"""
Management command to inject or reinstall a licence key.

Usage:
    python manage.py inject_licence "eyJhbGciOiJSUzI1NiIs..."
    python manage.py inject_licence --file licence.txt
    python manage.py inject_licence --validate-only "eyJhbGciOiJSUzI1NiIs..."
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from api.models.licence import Licence
from api.utils_licence import valider_licence_systeme


class Command(BaseCommand):
    help = 'Inject or reinstall a system licence key into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            'cle',
            nargs='?',
            type=str,
            help='Licence JWT key to inject',
        )
        parser.add_argument(
            '--file',
            type=str,
            help='Path to a file containing the licence key',
        )
        parser.add_argument(
            '--validate-only',
            action='store_true',
            help='Only validate the key, do not insert it',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Insert even if validation fails',
        )

    def handle(self, *args, **options):
        cle = options.get('cle')
        file_path = options.get('file')
        validate_only = options.get('validate_only')
        force = options.get('force')

        if not cle and not file_path:
            raise CommandError('You must provide either a key or a --file path.')

        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    cle = f.read().strip()
            except FileNotFoundError:
                raise CommandError(f'File not found: {file_path}')

        if not cle:
            raise CommandError('No licence key provided.')

        cle = cle.strip()

        self.stdout.write('=' * 60)
        self.stdout.write('INJECTION DE LICENCE')
        self.stdout.write('=' * 60)

        # Validate first
        if validate_only:
            self.stdout.write('Mode validation uniquement.')

        # Try to validate by inserting temporarily and checking
        Licence.objects.all().delete()
        Licence.objects.create(cle=cle)
        est_valide, message, payload = valider_licence_systeme()

        if not est_valide and not force:
            Licence.objects.all().delete()
            raise CommandError(f'Licence invalide: {message}')

        if validate_only and not est_valide:
            Licence.objects.all().delete()
            self.stdout.write(self.style.ERROR(f'Licence invalide: {message}'))
            return

        # Update derniere_verification
        licence = Licence.objects.last()
        if licence:
            licence.derniere_verification = timezone.now()
            licence.save(update_fields=['derniere_verification'])

        if est_valide:
            self.stdout.write(self.style.SUCCESS('Licence valide et installee.'))
            if payload:
                self.stdout.write(f"  Pharmacie: {payload.get('pharmacie_nom', 'N/A')}")
                self.stdout.write(f"  Pharmacien: {payload.get('pharmacien_nom', 'N/A')}")
                self.stdout.write(f"  Plan: {payload.get('plan', 'N/A')}")
                self.stdout.write(f"  Hardware ID: {payload.get('hardware_id', 'N/A')}")
        else:
            self.stdout.write(self.style.WARNING(f'Licence inseree mais INVALIDE: {message}'))
            self.stdout.write('Utilisez --force pour forcer l\'insertion.')

        self.stdout.write('=' * 60)
