"""
Commande de gestion : politique de rétention des données.

STRICTEMENT non-destructive par défaut :
- Sans --confirm, aucune suppression n'est effectuée (simple prévisualisation).
- --dry-run fonctionne même si la rétention est désactivée.
- La suppression réelle exige --confirm ET (PharmacySettings.retention_enabled
  OU --force).

Jamais concernés par la rétention : factures VALIDEE/PAYEE/ANNULEE,
Ordonnancier (registre réglementé), écritures comptables, ClotureCaisse,
RelevePaiement, MouvementCaisse, Caisse.

Usage:
    python manage.py run_retention --dry-run                        # Prévisualisation
    python manage.py run_retention --confirm                        # Purge réelle (si activée)
    python manage.py run_retention --confirm --force                # Même si retention_enabled=False
    python manage.py run_retention --confirm --include-stock-movements
"""
from django.core.management.base import BaseCommand
from django.db.models import ProtectedError
from django.utils import timezone

from api.models import AuditLog, PharmacySettings
from api.services.retention import build_retention_plan


class Command(BaseCommand):
    help = 'Applique la politique de rétention des données (dry-run par défaut, --confirm pour supprimer)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Prévisualisation : compte les lignes concernées sans rien supprimer",
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help="Confirme la suppression réelle (sinon aucune suppression n'est effectuée)",
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help="Exécuter même si PharmacySettings.retention_enabled=False",
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=5000,
            help='Taille des lots de suppression (défaut: 5000)',
        )
        parser.add_argument(
            '--include-stock-movements',
            action='store_true',
            help="Inclure la purge des mouvements de stock anciens (peut fausser balance_stock_excel)",
        )

    # ── Helpers ──────────────────────────────────────────────────────────

    def _delete_in_batches(self, qs, batch_size):
        """Suppression par lots d'IDs pour ne pas verrouiller la table."""
        deleted_total = 0
        while True:
            ids = list(qs.values_list('pk', flat=True)[:batch_size])
            if not ids:
                break
            count, _ = qs.model.objects.filter(pk__in=ids).delete()
            deleted_total += count
            self.stdout.write(f'    Supprimé {deleted_total}...')
        return deleted_total

    def _purge_trash_model(self, model, cutoff, batch_size, extra_filter=None):
        """
        Vide la corbeille d'un modèle (is_active=False depuis > cutoff).
        Retourne (supprimés, ignorés_protégés). Les PROTECT sont respectés :
        un objet encore référencé est conservé et compté comme ignoré.
        """
        qs = model.objects.filter(is_active=False, deleted_at__lt=cutoff)
        if extra_filter:
            qs = qs.filter(**extra_filter)

        deleted = skipped = 0
        while True:
            ids = list(qs.values_list('pk', flat=True)[:batch_size])
            if not ids:
                break
            try:
                count, _ = model.objects.filter(pk__in=ids).delete()
                deleted += count
            except ProtectedError:
                # Repli élément par élément : on conserve ce qui est encore
                # référencé par une FK en PROTECT.
                for pk in ids:
                    try:
                        model.objects.filter(pk=pk).delete()
                        deleted += 1
                    except ProtectedError:
                        skipped += 1
        return deleted, skipped

    def _process_entry(self, entry, real_run, batch_size, results):
        """Compte puis supprime (ou non) une entrée du plan de rétention."""
        try:
            qs = entry['queryset']
            total = qs.count()
            self.stdout.write(entry['msg'].format(
                label=entry['label'], total=total, cutoff=entry['cutoff'].date(),
            ))
            if entry['kind'] == 'trash':
                result_key = f"corbeille_{entry['model'].__name__}"
            else:
                result_key = entry['label']
            if real_run and total:
                if entry['kind'] == 'trash':
                    deleted, skipped = self._purge_trash_model(
                        entry['model'], entry['cutoff'], batch_size,
                        extra_filter=entry['extra_filter'],
                    )
                    results[result_key] = deleted
                    if skipped:
                        self.stdout.write(self.style.WARNING(
                            entry['skipped_msg'].format(skipped=skipped)
                        ))
                else:
                    results[result_key] = self._delete_in_batches(qs, batch_size)
            else:
                results[result_key] = 0 if real_run else total
        except Exception as e:
            if entry['warn']:
                self.stdout.write(self.style.WARNING(f"  {entry['warn']} ({e})"))
            else:
                raise

    # ── Commande ─────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        confirm = options['confirm']
        force = options['force']
        batch_size = options['batch_size']
        include_stock = options['include_stock_movements']

        pharmacy_settings, _ = PharmacySettings.objects.get_or_create(pk=1)
        enabled = pharmacy_settings.retention_enabled or force
        now = timezone.now()

        if not enabled:
            if not dry_run:
                self.stdout.write(self.style.WARNING(
                    "Rétention désactivée (PharmacySettings.retention_enabled=False). "
                    "Rien à faire — utilisez --dry-run pour prévisualiser ou --force pour forcer."
                ))
                return
            self.stdout.write(self.style.WARNING(
                "[DRY-RUN] Rétention désactivée — prévisualisation uniquement."
            ))

        real_run = enabled and confirm and not dry_run

        self.stdout.write(
            f"Rétention des données — {'SUPPRESSION RÉELLE' if real_run else 'prévisualisation (aucune écriture)'}"
        )

        results = {}

        for entry in build_retention_plan(pharmacy_settings, now):
            if entry['error'] is not None:
                self.stdout.write(self.style.WARNING(f"  {entry['warn']} ({entry['error']})"))
                continue
            if entry['deferred']:
                if not include_stock:
                    total = entry['queryset'].count()
                    self.stdout.write(entry['deferred_msg'].format(total=total))
                    continue
                self.stdout.write(self.style.WARNING(
                    "  ⚠ Purge des mouvements de stock : peut fausser balance_stock_excel "
                    "et l'historique des traçabilités lots."
                ))
            self._process_entry(entry, real_run, batch_size, results)

        # ── Finalisation ─────────────────────────────────────────────────
        if not real_run:
            self.stdout.write(self.style.NOTICE(
                "[DRY-RUN] Aucune suppression effectuée. "
                "Relancez avec --confirm (et retention_enabled ou --force) pour purger."
            ))
            return

        total_deleted = sum(results.values())
        pharmacy_settings.last_retention_run = now
        pharmacy_settings.save(update_fields=['last_retention_run'])

        # Trace d'audit du run de rétention
        try:
            from api.audit_helpers import log_audit
            log_audit(
                user=None,
                action=AuditLog.Action.DELETE,
                model_name='Retention',
                object_id=0,
                description=f'Rétention des données : {total_deleted} ligne(s) supprimée(s)',
                details=results,
            )
        except Exception:
            pass  # Le log d'audit ne doit jamais bloquer la rétention

        self.stdout.write(self.style.SUCCESS(
            f"✓ Rétention terminée : {total_deleted} ligne(s) supprimée(s)."
        ))
