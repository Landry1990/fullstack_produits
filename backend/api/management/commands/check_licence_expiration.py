"""
Management command to check licence expiration and create in-app notifications.
Run this daily via cron/scheduler to alert all users about licence expiring soon.

Usage:
    python manage.py check_licence_expiration
    python manage.py check_licence_expiration --threshold 7
    python manage.py check_licence_expiration --dry-run

Cron setup (Linux):
    0 8 * * * cd /path/to/project && python manage.py check_licence_expiration >> /var/log/licence_alerts.log 2>&1

Task Scheduler (Windows):
    Program: python
    Arguments: manage.py check_licence_expiration
    Start in: C:/path/to/project/backend
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.utils_licence import get_licence_details, should_send_alert
from api.models.licence import LicenceNotification


class Command(BaseCommand):
    help = 'Check licence expiration and create in-app notifications for all users (popup alerts)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--threshold',
            type=int,
            default=7,
            help='Number of days before expiry to start alerts (default: 7)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without creating actual notifications',
        )

    def handle(self, *args, **options):
        threshold = options['threshold']
        dry_run = options['dry_run']

        self.stdout.write("=" * 60)
        self.stdout.write("VÉRIFICATION DE LA LICENCE")
        self.stdout.write("=" * 60)

        # Récupérer les détails de la licence
        is_valid, payload, days_remaining, is_lifetime = get_licence_details()

        if not is_valid:
            self.stdout.write(
                self.style.ERROR("❌ Licence INVALIDE ou ABSENTE!")
            )
            self._create_notification(
                title="🚨 LICENCE EXPIRÉE",
                message="Votre licence a EXPIRÉ ou n'est pas installée. Contactez votre distributeur immédiatement pour éviter l'interruption du service.",
                severity=LicenceNotification.Severity.CRITICAL,
                days_remaining=0,
                dry_run=dry_run
            )
            return

        if is_lifetime:
            self.stdout.write(
                self.style.SUCCESS("✅ Licence à vie - Aucune expiration")
            )
            if payload:
                self.stdout.write(f"   Pharmacie: {payload.get('pharmacie_nom', 'N/A')}")
            self.stdout.write("   Plan: LIFETIME")
            # Archiver les anciennes notifications actives
            self._archive_old_notifications(dry_run)
            return

        # Licence avec expiration
        exp_date = timezone.now() + timedelta(days=days_remaining or 0)
        self.stdout.write("✅ Licence valide")
        if payload:
            self.stdout.write(f"   Pharmacie: {payload.get('pharmacie_nom', 'N/A')}")
        self.stdout.write(f"   Expire le: {exp_date.strftime('%d/%m/%Y')}")
        self.stdout.write(f"   Jours restants: {days_remaining}")

        # Vérifier si alerte nécessaire
        if should_send_alert(days_remaining, threshold):
            urgency = "CRITIQUE" if (days_remaining and days_remaining <= 3) else "IMPORTANT"
            self.stdout.write(
                self.style.WARNING(
                    f"\n⚠️  ALERTE {urgency}: Licence expire dans {days_remaining} jour(s)!"
                )
            )

            # Construire le titre et message
            if days_remaining == 0:
                title = "🚨 LICENCE EXPIRE AUJOURD'HUI"
                message = (
                    f"Votre licence expire AUJOURD'HUI ({exp_date.strftime('%d/%m/%Y')}). "
                    f"Contactez immédiatement votre distributeur pour éviter l'interruption du service."
                )
                severity = LicenceNotification.Severity.CRITICAL
            elif days_remaining == 1:
                title = "⚠️ LICENCE EXPIRE DEMAIN"
                message = (
                    f"Votre licence expire DEMAIN ({exp_date.strftime('%d/%m/%Y')}). "
                    f"Renouvelez dès aujourd'hui pour éviter la coupure du système."
                )
                severity = LicenceNotification.Severity.CRITICAL
            elif days_remaining <= 3:
                title = f"⚠️ Licence expire dans {days_remaining} jours"
                message = (
                    f"Votre licence expire dans {days_remaining} jours ({exp_date.strftime('%d/%m/%Y')}). "
                    f"Pensez à la renouveler rapidement avec votre distributeur."
                )
                severity = LicenceNotification.Severity.CRITICAL
            else:
                title = f"ℹ️ Licence expire dans {days_remaining} jours"
                message = (
                    f"Votre licence expire dans {days_remaining} jours ({exp_date.strftime('%d/%m/%Y')}). "
                    f"Pensez à la renouveler avec votre distributeur."
                )
                severity = LicenceNotification.Severity.WARNING

            self._create_notification(title, message, severity, days_remaining, dry_run)
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✓ Pas d'alerte nécessaire ({days_remaining} jours restants > {threshold})"
                )
            )
            # Archiver les anciennes notifications si on est hors de la période d'alerte
            self._archive_old_notifications(dry_run)

        self.stdout.write("=" * 60)

    def _create_notification(self, title, message, severity, days_remaining, dry_run):
        """Créer une notification in-app visible par tous les utilisateurs."""
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"[DRY-RUN] Notification serait créée:")
            )
            self.stdout.write(f"   Titre: {title}")
            self.stdout.write(f"   Sévérité: {severity}")
            self.stdout.write(f"   Message: {message[:60]}...")
            return

        try:
            # Vérifier si une notification identique existe déjà (même jour, même gravité)
            today = timezone.now().date()
            existing = LicenceNotification.objects.filter(
                created_at__date=today,
                severity=severity,
                days_remaining=days_remaining,
                status=LicenceNotification.Status.ACTIVE
            ).first()

            if existing:
                self.stdout.write(
                    self.style.WARNING(f"⚠️ Notification identique déjà créée aujourd'hui (ID: {existing.id})")
                )
                return

            # Créer la notification
            notification = LicenceNotification.objects.create(
                title=title,
                message=message,
                severity=severity,
                days_remaining=days_remaining,
                expiry_date=timezone.now() + timedelta(days=days_remaining or 0)
            )

            self.stdout.write(
                self.style.SUCCESS(f"✅ Notification créée (ID: {notification.id}) - Visible par tous les utilisateurs")
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Erreur lors de la création: {str(e)}")
            )

    def _archive_old_notifications(self, dry_run):
        """Archiver les anciennes notifications actives si la licence est OK."""
        try:
            old_notifications = LicenceNotification.objects.filter(
                status=LicenceNotification.Status.ACTIVE
            )
            count = old_notifications.count()

            if count > 0:
                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(f"[DRY-RUN] {count} ancienne(s) notification(s) seraient archivées")
                    )
                    return

                old_notifications.update(status=LicenceNotification.Status.EXPIRED)
                self.stdout.write(
                    self.style.SUCCESS(f"✓ {count} ancienne(s) notification(s) archivée(s)")
                )
        except Exception as e:
            pass  # Pas critique
