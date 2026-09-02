from datetime import date

from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db import models


class AvoirClient(models.Model):
    """Note de crédit émise au client pour une vente non annulable."""

    class Statut(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        VALIDEE = 'VALIDEE', 'Validée'
        ANNULEE = 'ANNULEE', 'Annulée'

    class TypeMotif(models.TextChoices):
        ERREUR = 'ERREUR', 'Erreur'
        RETOUR = 'RETOUR', 'Retour'
        REMISE = 'REMISE', 'Remise'
        AUTRE = 'AUTRE', 'Autre'

    numero = models.CharField(max_length=50, unique=True, blank=True)
    facture_origine = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='avoirs_clients',
    )
    client = models.ForeignKey(
        'Client', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='avoirs_clients',
    )
    date = models.DateField(default=date.today)
    montant_total = models.DecimalField(max_digits=12, decimal_places=2)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.BROUILLON)
    type_motif = models.CharField(max_length=10, choices=TypeMotif.choices, default=TypeMotif.AUTRE)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='avoirs_clients_created',
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-date', '-id']
        verbose_name = 'Avoir client'
        verbose_name_plural = 'Avoirs clients'

    def __str__(self):
        return self.numero

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = self.generate_numero()
        super().save(*args, **kwargs)

    @classmethod
    def generate_numero(cls):
        """Génère un numéro au format AVC-YYYYMM-XXXX."""
        today = date.today()
        prefix = f"AVC-{today.strftime('%Y%m')}"
        last = cls.objects.filter(numero__startswith=prefix).order_by('-numero').first()
        try:
            sequence = int(last.numero.rsplit('-', 1)[-1]) + 1 if last else 1
        except (TypeError, ValueError):
            sequence = 1
        return f'{prefix}-{sequence:04d}'


class LigneAvoirClient(models.Model):
    avoir_client = models.ForeignKey(AvoirClient, on_delete=models.CASCADE, related_name='lignes')
    produit = models.ForeignKey('Produit', on_delete=models.PROTECT)
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    prix_unitaire = models.DecimalField(max_digits=10, decimal_places=2)
    remise = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tva = models.DecimalField(max_digits=5, decimal_places=2)
    lot = models.CharField(max_length=100, blank=True, default='')
    stock_lot = models.ForeignKey('StockLot', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Ligne d'avoir client"
        verbose_name_plural = "Lignes d'avoir client"

    def __str__(self):
        return f'{self.avoir_client.numero} - {self.produit} x {self.quantity}'
