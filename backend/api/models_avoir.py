from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
from django.db.models import Sum, F, DecimalField
from decimal import Decimal
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import date

# ... (existing models above)

class Avoir(models.Model):
    """
    Modèle pour les retours fournisseurs (Avoirs).
    Retire du stock contrairement aux Commandes qui en ajoutent.
    """
    TYPE_CHOICES = [
        ('PERIME', 'Produit périmé'),
        ('AVARIE', 'Produit avarié'),
        ('NON_FACTURE', 'Livré non facturé'),
        ('ERREUR', 'Erreur de livraison'),
        ('AUTRE', 'Autre'),
    ]
    
    STATUS_CHOICES = [
        ('BROUILLON', 'Brouillon'),
        ('VALIDEE', 'Validée'),
    ]
    
    numero = models.CharField(max_length=50, unique=True, blank=True)
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.PROTECT, related_name='avoirs')
    type_avoir = models.CharField(max_length=20, choices=TYPE_CHOICES, default='AUTRE')
    date = models.DateField(default=date.today)
    observations = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='BROUILLON')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='avoirs_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Avoir fournisseur'
        verbose_name_plural = 'Avoirs fournisseurs'
    
    def __str__(self):
        return f"{self.numero} - {self.fournisseur.name if self.fournisseur else 'N/A'}"
    
    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = self.generate_numero()
        super().save(*args, **kwargs)
    
    def generate_numero(self):
        """Génère un numéro d'avoir au format AV-YYYYMM-XXXX"""
        today = date.today()
        prefix = f"AV-{today.strftime('%Y%m')}"
        last = Avoir.objects.filter(numero__startswith=prefix).order_by('-numero').first()
        if last:
            try:
                seq = int(last.numero.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"{prefix}-{seq:04d}"
    
    @property
    def total_ht(self):
        """Calcule le total HT de l'avoir"""
        return self.produits.aggregate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        )['total'] or Decimal('0.00')
    
    @property
    def fournisseur_name(self):
        return self.fournisseur.name if self.fournisseur else ''
    
    @property
    def created_by_name(self):
        return self.created_by.get_full_name() if self.created_by else ''


class LigneAvoir(models.Model):
    """Ligne d'un avoir fournisseur"""
    avoir = models.ForeignKey(Avoir, related_name='produits', on_delete=models.CASCADE)
    produit = models.ForeignKey('Produit', on_delete=models.PROTECT)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix de retour")
    lot = models.CharField(max_length=100, blank=True)
    date_expiration = models.DateField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Ligne d'avoir"
        verbose_name_plural = "Lignes d'avoir"
    
    def __str__(self):
        return f"{self.produit.name} x {self.quantity}"
    
    @property
    def total(self):
        """Calcule le total de la ligne"""
        return self.quantity * self.price
    
    @property
    def produit_nom(self):
        return self.produit.name if self.produit else ''
    
    @property
    def produit_cip(self):
        return self.produit.cip1 if self.produit else ''
