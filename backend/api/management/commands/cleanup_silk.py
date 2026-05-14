"""
Commande Django pour nettoyer les données Silk et éviter les deadlocks.
Usage: python manage.py cleanup_silk [--keep N]
"""
from django.core.management.base import BaseCommand
from silk.models import Request, Response
from django.db import connection, transaction


class Command(BaseCommand):
    help = 'Nettoie les anciennes données Silk pour éviter les deadlocks PostgreSQL'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep',
            type=int,
            default=500,
            help='Nombre de requêtes récentes à conserver (défaut: 500)'
        )
        parser.add_argument(
            '--vacuum',
            action='store_true',
            help='Exécute VACUUM ANALYZE après le nettoyage'
        )

    def handle(self, *args, **options):
        keep_limit = options['keep']
        do_vacuum = options['vacuum']
        
        self.stdout.write(self.style.WARNING(f'Nettoyage Silk - Conservation des {keep_limit} dernières requêtes...'))
        
        # Compter avant
        request_count_before = Request.objects.count()
        response_count_before = Response.objects.count()
        self.stdout.write(f'Avant: {request_count_before} requests, {response_count_before} responses')
        
        if request_count_before <= keep_limit:
            self.stdout.write(self.style.SUCCESS('Rien à nettoyer - nombre de requêtes déjà optimal'))
            return
        
        try:
            with transaction.atomic():
                # Récupérer les IDs à supprimer
                old_requests = Request.objects.order_by('-id')[keep_limit:]
                old_request_ids = list(old_requests.values_list('id', flat=True)[:1000])  # Limiter par batch
                
                if old_request_ids:
                    # Supprimer d'abord les réponses (FK constraint)
                    deleted_responses = Response.objects.filter(request_id__in=old_request_ids).delete()
                    self.stdout.write(f'Supprimé {deleted_responses[0]} réponses')
                    
                    # Puis supprimer les requêtes
                    deleted_requests = Request.objects.filter(id__in=old_request_ids).delete()
                    self.stdout.write(f'Supprimé {deleted_requests[0]} requêtes')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erreur lors du nettoyage: {e}'))
            return
        
        # Compter après
        request_count_after = Request.objects.count()
        response_count_after = Response.objects.count()
        self.stdout.write(f'Après: {request_count_after} requests, {response_count_after} responses')
        
        # VACUUM ANALYZE
        if do_vacuum:
            self.stdout.write('Exécution de VACUUM ANALYZE...')
            try:
                with connection.cursor() as cursor:
                    cursor.execute('VACUUM ANALYZE silk_response;')
                    cursor.execute('VACUUM ANALYZE silk_request;')
                self.stdout.write(self.style.SUCCESS('VACUUM ANALYZE terminé'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'VACUUM non exécuté (nécessite généralement un superuser): {e}'))
        
        self.stdout.write(self.style.SUCCESS('Nettoyage Silk terminé avec succès !'))
