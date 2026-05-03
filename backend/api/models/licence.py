from django.db import models
from django.utils import timezone

class Licence(models.Model):
    cle = models.TextField(help_text="Le token JWT complet")
    date_installation = models.DateTimeField(auto_now_add=True)
    derniere_verification = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Licence Système"
        verbose_name_plural = "Licences Système"

    def __str__(self):
        return f"Licence installée le {self.date_installation.strftime('%d/%m/%Y')}"


class LicenceNotification(models.Model):
    """Notifications d'alerte de licence expirant (affichage popup pour tous les users)"""

    class Severity(models.TextChoices):
        INFO = 'INFO', 'Information'
        WARNING = 'WARNING', 'Avertissement'
        CRITICAL = 'CRITICAL', 'Critique'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        DISMISSED = 'DISMISSED', 'Ignorée'
        EXPIRED = 'EXPIRED', 'Expirée'

    title = models.CharField(max_length=100)
    message = models.TextField()
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.WARNING)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # Métadonnées
    days_remaining = models.IntegerField(null=True, blank=True, help_text="Jours restants lors de la création")
    expiry_date = models.DateTimeField(null=True, blank=True, help_text="Date d'expiration de la licence")

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    dismissed_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='dismissed_licence_notifications')
    dismissed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Notification de Licence"
        verbose_name_plural = "Notifications de Licence"

    def __str__(self):
        return f"{self.title} ({self.severity}) - {self.status}"
