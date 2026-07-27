"""
Commande de gestion : archivage automatique des logs d'audit anciens.

Usage:
    python manage.py archive_audit_logs           # Archive les entrées > 90 jours
    python manage.py archive_audit_logs --days 30 # Archive les entrées > 30 jours
    python manage.py archive_audit_logs --dry-run # Affiche le compte sans supprimer
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import AuditLog


class Command(BaseCommand):
    help = 'Archive (supprime) les entrées AuditLog plus vieilles que N jours'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=90,
            help='Nombre de jours de rétention (défaut: 90)'
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Affiche le nombre d\'entrées concernées sans les supprimer'
        )
        parser.add_argument(
            '--batch-size', type=int, default=5000,
            help='Taille des lots de suppression (défaut: 5000)'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        cutoff = timezone.now() - timedelta(days=days)

        qs = AuditLog.objects.filter(timestamp__lt=cutoff)
        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS(
                f'Aucune entrée AuditLog de plus de {days} jours à archiver.'
            ))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'[DRY-RUN] {total} entrées AuditLog seraient supprimées (avant {cutoff.date()})'
            ))
            return

        # Suppression par lots pour ne pas verrouiller la table
        deleted_total = 0
        while True:
            ids = list(qs.values_list('id', flat=True)[:batch_size])
            if not ids:
                break
            count, _ = AuditLog.objects.filter(id__in=ids).delete()
            deleted_total += count
            self.stdout.write(f'  Supprimé {deleted_total}/{total}...')

        self.stdout.write(self.style.SUCCESS(
            f'✅ {deleted_total} entrées AuditLog supprimées (rétention: {days} jours)'
        ))
