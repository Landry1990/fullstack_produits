from django.db import models, IntegrityError
from django.db.models import Sum
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from .configuration_objectifs import ConfigurationObjectifs

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
        today = timezone.localtime(timezone.now()).date()
        
        if periode == cls.Periode.JOUR:
            date_debut = today
        elif periode == cls.Periode.SEMAINE:
            date_debut = today - timezone.timedelta(days=today.weekday())
        elif periode == cls.Periode.MOIS:
            date_debut = today.replace(day=1)
        else:
            return None

        # Check existing first
        objectif = cls.objects.filter(periode=periode, date_debut=date_debut).first()
        if objectif:
            return objectif

        # Generate dynamically if missing
        config = ConfigurationObjectifs.load()
        if config.mode == ConfigurationObjectifs.ModeCalcul.MANUEL:
            return None
        
        ca_objectif = Decimal('0.00')

        if config.mode == ConfigurationObjectifs.ModeCalcul.FIXE:
            if config.seuil_rentabilite_mensuel > 0:
                mensuel = config.seuil_rentabilite_mensuel
                if periode == cls.Periode.MOIS:
                    ca_objectif = mensuel
                elif periode == cls.Periode.SEMAINE:
                    ca_objectif = mensuel / Decimal('4.33')
                elif periode == cls.Periode.JOUR:
                    jours = Decimal(str(config.jours_ouverts_semaine)) * Decimal('4.33')
                    ca_objectif = mensuel / jours
        
        elif config.mode == ConfigurationObjectifs.ModeCalcul.DYNAMIQUE:
            # Need to find previous periods' revenue
            from .billing import Facture
            
            if periode == cls.Periode.JOUR:
                # N-1 : Same day last week
                ref_date = date_debut - timezone.timedelta(days=7)
                ca_ref = Facture.objects.filter(
                    date__date=ref_date,
                    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
                ).aggregate(total=Sum('total_ttc'))['total'] or Decimal('0.00')
                ca_objectif = ca_ref * (Decimal('1') + config.pourcentage_croissance / Decimal('100'))
                
            elif periode == cls.Periode.SEMAINE:
                # N-1 : Previous week
                ref_start = date_debut - timezone.timedelta(days=7)
                ref_end = date_debut - timezone.timedelta(days=1)
                ca_ref = Facture.objects.filter(
                    date__date__gte=ref_start,
                    date__date__lte=ref_end,
                    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
                ).aggregate(total=Sum('total_ttc'))['total'] or Decimal('0.00')
                ca_objectif = ca_ref * (Decimal('1') + config.pourcentage_croissance / Decimal('100'))
                
            elif periode == cls.Periode.MOIS:
                # N-1 : Previous month
                first_of_prev_month = (date_debut - timezone.timedelta(days=1)).replace(day=1)
                last_of_prev_month = date_debut - timezone.timedelta(days=1)
                ca_ref = Facture.objects.filter(
                    date__date__gte=first_of_prev_month,
                    date__date__lte=last_of_prev_month,
                    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
                ).aggregate(total=Sum('total_ttc'))['total'] or Decimal('0.00')
                ca_objectif = ca_ref * (Decimal('1') + config.pourcentage_croissance / Decimal('100'))

        # Save and return new generated objectif if valid
        if ca_objectif > Decimal('0.00'):
            try:
                return cls.objects.create(
                    periode=periode,
                    date_debut=date_debut,
                    ca_objectif=round(ca_objectif, 2),
                    notes=f"Généré automatiquement (Mode {config.get_mode_display()})"
                )
            except IntegrityError:
                # Another concurrent request already created it
                return cls.objects.filter(periode=periode, date_debut=date_debut).first()
        
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
