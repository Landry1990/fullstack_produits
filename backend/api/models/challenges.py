from django.db import models
from django.conf import settings


class Challenge(models.Model):
    """Défi commercial ciblant certains produits et vendeurs sur une période."""
    class Statut(models.TextChoices):
        BROUILLON = 'BROU', 'Brouillon'
        EN_COURS = 'ENC', 'En cours'
        CLOTURE = 'CLO', 'Clôturé'
        ANNULE = 'ANN', 'Annulé'

    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    date_debut = models.DateField()
    date_fin = models.DateField()
    statut = models.CharField(max_length=4, choices=Statut.choices, default=Statut.BROUILLON)
    is_active = models.BooleanField(default=True, db_index=True)
    all_users = models.BooleanField(default=True, help_text="Si True, tous les vendeurs participent")
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='challenges_participating',
        help_text="Vendeurs ciblés si all_users=False"
    )
    produits = models.ManyToManyField(
        'Produit',
        blank=True,
        related_name='challenges',
        help_text="Produits concernés par le challenge"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='challenges_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_debut', '-id']
        verbose_name = "Challenge"
        verbose_name_plural = "Challenges"

    def __str__(self):
        return f"{self.nom} ({self.date_debut} → {self.date_fin})"

    @property
    def is_ongoing(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.date_debut <= today <= self.date_fin and self.statut == self.Statut.EN_COURS
