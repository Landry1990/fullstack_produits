from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Réinitialise les séquences PostgreSQL à 1'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            sequences = [
                'api_commande_id_seq',
                'api_commandeproduit_id_seq',
                'api_facture_id_seq',
                'api_factureproduit_id_seq',
                'api_factureproduitallocation_id_seq',
                'api_stocklot_id_seq',
                'api_promis_id_seq',
                'api_avoir_id_seq',
                'api_creance_id_seq',
                'api_historiquetransformation_id_seq',
                'api_relationtransformation_id_seq',
            ]
            
            self.stdout.write('Réinitialisation des séquences...\n')
            
            for seq in sequences:
                try:
                    cursor.execute(f"ALTER SEQUENCE {seq} RESTART WITH 1;")
                    self.stdout.write(f'  ✅ {seq}')
                except Exception as e:
                    self.stdout.write(f'  ⚠️  {seq}: {str(e)}')
            
            self.stdout.write(self.style.SUCCESS('\n✅ Séquences réinitialisées !'))
