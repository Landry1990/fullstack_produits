from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class ObjectifCommercial(models.Model):
    """
    Objectifs commerciaux pour le tableau de bord manager.
    Permet de définir des objectifs de CA et de ventes par période.
    """
    
    class Periode(models.TextChoices):
        JOUR = 'JOUR', 'Journalier'
        SEMAINE = 'SEMAINE', 'Hebdomadaire'
        MOIS = 'MOIS', 'Mensuel'
    
    periode = models.CharField(
        max_length=10, 
        choices=Periode.choices,
        help_text="Type de période pour cet objectif"
    )
    date_debut = models.DateField(
        help_text="Premier jour de la période (lundi pour semaine, 1er pour mois)"
    )
    ca_objectif = models.DecimalField(
        max_digits=15, 
        decimal_places=2,
        help_text="Objectif de chiffre d'affaires pour cette période"
    )
    nb_ventes_objectif = models.IntegerField(
        null=True, 
        blank=True,
        help_text="Objectif de nombre de ventes (optionnel)"
    )
    panier_moyen_objectif = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Objectif de panier moyen (optionnel)"
    )
    notes = models.TextField(
        blank=True,
        help_text="Notes ou commentaires sur cet objectif"
    )
    
    # Audit fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='objectifs_crees'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Objectif Commercial"
        verbose_name_plural = "Objectifs Commerciaux"
        ordering = ['-date_debut', 'periode']
        # Un seul objectif par période et date de début
        unique_together = ['periode', 'date_debut']
    
    def __str__(self):
        return f"{self.get_periode_display()} - {self.date_debut} : {self.ca_objectif} F"
    
    def save(self, *args, **kwargs):
        """
        Normalise la date de début selon la période :
        - SEMAINE : Lundi de la semaine
        - MOIS : 1er du mois
        """
        if self.periode == self.Periode.SEMAINE:
            # S'assurer que date_debut est un objet date pour les calculs
            if hasattr(self.date_debut, 'weekday'):
                self.date_debut = self.date_debut - timezone.timedelta(days=self.date_debut.weekday())
        elif self.periode == self.Periode.MOIS:
            if hasattr(self.date_debut, 'replace'):
                self.date_debut = self.date_debut.replace(day=1)
        super().save(*args, **kwargs)
    
    @classmethod
    def get_objectif_actuel(cls, periode: str):
        """
        Récupère l'objectif actuel pour une période donnée.
        """
        today = timezone.now().date()
        
        if periode == cls.Periode.JOUR:
            return cls.objects.filter(periode=periode, date_debut=today).first()
        
        elif periode == cls.Periode.SEMAINE:
            # Lundi de la semaine en cours
            monday = today - timezone.timedelta(days=today.weekday())
            return cls.objects.filter(periode=periode, date_debut=monday).first()
        
        elif periode == cls.Periode.MOIS:
            # Premier du mois en cours
            first_of_month = today.replace(day=1)
            return cls.objects.filter(periode=periode, date_debut=first_of_month).first()
        
        return None
    
    @classmethod
    def get_objectifs_courants(cls):
        """
        Récupère tous les objectifs actuels (jour/semaine/mois).
        """
        return {
            'jour': cls.get_objectif_actuel(cls.Periode.JOUR),
            'semaine': cls.get_objectif_actuel(cls.Periode.SEMAINE),
            'mois': cls.get_objectif_actuel(cls.Periode.MOIS),
        }
