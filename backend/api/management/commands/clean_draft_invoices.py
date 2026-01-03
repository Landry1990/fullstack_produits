from django.core.management.base import BaseCommand
from api.models import Facture


class Command(BaseCommand):
    help = 'Supprime toutes les factures en statut BROUILLON'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Supprimer toutes les factures BROUILLON (sans confirmation)',
        )
        parser.add_argument(
            '--older-than',
            type=int,
            help='Supprimer uniquement les factures BROUILLON plus anciennes que N jours',
        )

    def handle(self, *args, **options):
        from datetime import datetime, timedelta
        
        # Construire le queryset
        factures_brouillon = Facture.objects.filter(status='BROUILLON')
        
        # Filtrer par date si spécifié
        if options['older_than']:
            date_limite = datetime.now() - timedelta(days=options['older_than'])
            factures_brouillon = factures_brouillon.filter(date__lt=date_limite)
            self.stdout.write(
                self.style.WARNING(
                    f'Recherche des factures BROUILLON plus anciennes que {options["older_than"]} jours...'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING('Recherche de toutes les factures BROUILLON...')
            )
        
        count = factures_brouillon.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('✓ Aucune facture BROUILLON à supprimer'))
            return
        
        # Afficher les factures à supprimer
        self.stdout.write(f'\nFactures BROUILLON trouvées : {count}')
        for facture in factures_brouillon[:10]:  # Afficher les 10 premières
            self.stdout.write(
                f'  - #{facture.numero_facture} - {facture.date} - {facture.client_name or "Client"} - {facture.total_ttc} F'
            )
        
        if count > 10:
            self.stdout.write(f'  ... et {count - 10} autres factures')
        
        # Demander confirmation si --all n'est pas spécifié
        if not options['all']:
            self.stdout.write('\n' + self.style.WARNING('⚠️  ATTENTION : Cette action est irréversible !'))
            confirm = input(f'\nÊtes-vous sûr de vouloir supprimer ces {count} factures ? [oui/non] : ')
            
            if confirm.lower() not in ['oui', 'o', 'yes', 'y']:
                self.stdout.write(self.style.ERROR('✗ Suppression annulée'))
                return
        
        # Supprimer les factures
        deleted_count, _ = factures_brouillon.delete()
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✓ {deleted_count} facture(s) BROUILLON supprimée(s) avec succès !')
        )
