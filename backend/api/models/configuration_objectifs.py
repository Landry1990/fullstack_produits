from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal

class ConfigurationObjectifs(models.Model):
    """
    Configuration globale (Singleton) pour le calcul automatique des objectifs commerciaux.
    """
    class ModeCalcul(models.TextChoices):
        MANUEL = 'MANUEL', 'Manuel'
        FIXE = 'FIXE', 'Objectif Fixe (Seuil de rentabilité)'
        DYNAMIQUE = 'DYNAMIQUE', 'Dynamique (Basé sur l\'historique)'

    mode = models.CharField(
        max_length=20,
        choices=ModeCalcul.choices,
        default=ModeCalcul.MANUEL,
        help_text="Mode de calcul des objectifs (Manuel, Fixe ou Dynamique)"
    )
    
    seuil_rentabilite_mensuel = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Seuil de rentabilité mensuel (utilisé en mode FIXE). Utilisé pour calculer l'objectif quotidien."
    )
    
    pourcentage_croissance = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.00'),
        help_text="Pourcentage de croissance visé (utilisé en mode DYNAMIQUE par rapport à N-1 ou la moyenne récente)."
    )
    
    jours_ouverts_semaine = models.IntegerField(
        default=6,
        validators=[MinValueValidator(1), MaxValueValidator(7)],
        help_text="Nombre de jours d'ouverture par semaine (pour diviser l'objectif mensuel en quotidien)."
    )
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuration Objectifs"
        verbose_name_plural = "Configurations Objectifs"

    def __str__(self):
        return f"Configuration Objectifs ({self.get_mode_display()})"

    def save(self, *args, **kwargs):
        self.pk = 1  # Ensures Singleton pattern
        super().save(*args, **kwargs)
        
        # Delete currently auto-generated objectives so they are recalculated immediately
        from .objectif import ObjectifCommercial
        from django.utils import timezone
        
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        
        ObjectifCommercial.objects.filter(
            notes__startswith='Généré automatiquement',
            date_debut__gte=start_of_month
        ).delete()

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
