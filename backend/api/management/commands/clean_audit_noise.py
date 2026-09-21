from django.core.management.base import BaseCommand
from django.db.models import Count

from api.models import AuditLog


class Command(BaseCommand):
    help = "Supprime les logs d'audit bruyants générés par les signaux (sans utilisateur et action CREATE/UPDATE/DELETE)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Compte les lignes concernées sans les supprimer"
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help="Confirme la suppression réelle (sinon aucune suppression n'est effectuée)"
        )
        parser.add_argument(
            '--batch',
            type=int,
            default=5000,
            help="Taille des lots de suppression (défaut: 5000)"
        )

    def _summarize(self, qs):
        return {
            item['action']: item['count']
            for item in qs.values('action').annotate(count=Count('id')).order_by('action')
        }

    def _print_summary(self, summary, label):
        if not summary:
            self.stdout.write("  (aucun)")
            return
        self.stdout.write(f"  {label}:")
        for action, count in sorted(summary.items()):
            self.stdout.write(f"    - {action}: {count}")

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        confirm = options['confirm']
        batch = options['batch']

        noise_actions = [AuditLog.Action.CREATE, AuditLog.Action.UPDATE, AuditLog.Action.DELETE]
        qs = AuditLog.objects.filter(user__isnull=True, action__in=noise_actions)
        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS(
                "Aucun log bruyant trouvé (user NULL + CREATE/UPDATE/DELETE)."
            ))
            return

        before_summary = self._summarize(qs)
        self.stdout.write(self.style.WARNING(
            f"{total} log(s) bruyant(s) trouvé(s) (user NULL + CREATE/UPDATE/DELETE)."
        ))
        self._print_summary(before_summary, "Répartition avant nettoyage")

        if dry_run:
            self.stdout.write(self.style.NOTICE(
                "[DRY-RUN] Aucune suppression effectuée."
            ))
            return

        if not confirm:
            self.stdout.write(self.style.WARNING(
                "Action non confirmée. Relancez avec --confirm pour supprimer ces logs, "
                "ou --dry-run pour simuler."
            ))
            return

        deleted_total = 0
        while True:
            ids = list(qs.values_list('id', flat=True)[:batch])
            if not ids:
                break
            count, _ = AuditLog.objects.filter(id__in=ids).delete()
            deleted_total += count
            self.stdout.write(f"  Supprimé {deleted_total}/{total}...")

        after_qs = AuditLog.objects.filter(user__isnull=True, action__in=noise_actions)
        after_summary = self._summarize(after_qs)

        self.stdout.write(self.style.SUCCESS(
            f"{deleted_total} log(s) bruyant(s) supprimé(s)."
        ))
        self._print_summary(after_summary, "Répartition après nettoyage")
