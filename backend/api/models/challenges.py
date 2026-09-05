from django.db import models
from django.conf import settings


class Challenge(models.Model):
    """Défi commercial ciblant certains produits et vendeurs sur une période."""
    class Statut(models.TextChoices):
        BROUILLON = 'BROU', 'Brouillon'
        EN_COURS = 'ENC', 'En cours'
        CLOTURE = 'CLO', 'Clôturé'
        ANNULE = 'ANN', 'Annulé'

    class TypeObjectif(models.TextChoices):
        CA = 'CA', "Chiffre d'affaires"
        BOITES = 'BOITES', 'Nombre de boîtes'
        POINTS = 'POINTS', 'Points bonus'

    class Mode(models.TextChoices):
        INDIVIDUEL = 'INDIVIDUEL', 'Individuel'
        EQUIPES = 'EQUIPES', 'Équipes'

    class SourceProduits(models.TextChoices):
        MANUEL = 'MANUEL', 'Manuel'
        AUTO_PEREMPTION = 'AUTO_PEREMPTION', 'Auto péremption'

    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    date_debut = models.DateField()
    date_fin = models.DateField()
    statut = models.CharField(max_length=4, choices=Statut.choices, default=Statut.BROUILLON)
    type_objectif = models.CharField(
        max_length=6,
        choices=TypeObjectif.choices,
        default=TypeObjectif.CA,
        help_text="Métrique principale du challenge (CA, BOITES ou POINTS)",
    )
    objectif_valeur = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True, blank=True,
        help_text="Objectif chiffré facultatif (ex: 50 boîtes, 500000 FCFA)",
    )
    mode = models.CharField(
        max_length=10,
        choices=Mode.choices,
        default=Mode.INDIVIDUEL,
        help_text="Mode de participation : individuel ou par équipes",
    )
    source_produits = models.CharField(
        max_length=15,
        choices=SourceProduits.choices,
        default=SourceProduits.MANUEL,
        help_text="Source de la liste des produits : manuelle ou auto-calculée par péremption",
    )
    peremption_mois = models.IntegerField(
        null=True, blank=True,
        help_text="Seuil en mois pour l'auto-peuplement (ex: 6 = produits péremptibles dans ≤6 mois)",
    )
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


class ChallengeEquipe(models.Model):
    """Équipe de vendeurs participant à un challenge en mode ÉQUIPES."""
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='equipes')
    nom = models.CharField(max_length=100)
    membres = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='equipes_challenge')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['challenge', 'id']
        verbose_name = "Équipe de challenge"
        verbose_name_plural = "Équipes de challenge"
        unique_together = [('challenge', 'nom')]

    def __str__(self):
        return f"{self.nom} ({self.challenge.nom})"


class ChallengePointTier(models.Model):
    """Barème de points par niveau d'urgence de péremption."""
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='point_tiers')
    mois_max = models.IntegerField(help_text="Seuil en mois (ex: 1 = ≤1 mois, 3 = ≤3 mois)")
    points = models.IntegerField(help_text="Points par boîte vendue")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['challenge', 'mois_max']
        verbose_name = "Barème de points"
        verbose_name_plural = "Barèmes de points"
        unique_together = [('challenge', 'mois_max')]

    def __str__(self):
        return f"≤{self.mois_max} mois → {self.points} pts ({self.challenge.nom})"
