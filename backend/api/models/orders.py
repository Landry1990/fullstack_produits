# -*- coding: utf-8 -*-
"""
Order-related models: Commande, CommandeProduit, Avoir, LigneAvoir.
"""
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Sum, F, DecimalField
from decimal import Decimal
from datetime import date


class Commande(models.Model):
    """Model representing an order."""
    class Status(models.TextChoices):
        EN_PREPARATION = 'PREP', 'En préparation'
        EN_ATTENTE = 'ATT', 'En attente'
        CLOTUREE = 'CLOT', 'Clôturée'
    
    class Type(models.TextChoices):
        LOCALE = 'LOC', 'Locale'
        DIRECTE = 'DIR', 'Directe'

    id = models.AutoField(primary_key=True)
    type = models.CharField(
        max_length=3,
        choices=Type.choices,
        default=Type.LOCALE,
        help_text="Type de commande (Locale ou Directe)"
    )
    taux_change = models.DecimalField(max_digits=10, decimal_places=3, default=655.957)
    frais_coefficient = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    
    fournisseur = models.ForeignKey(
        'Fournisseur', on_delete=models.SET_NULL, null=True, blank=True
    )
    fournisseur_nom = models.CharField(
        max_length=150, blank=True, null=True, 
        help_text="Nom du fournisseur sauvegardé"
    )
    numero_facture = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    date_cloture = models.DateTimeField(null=True, blank=True, verbose_name="Date de clôture")
    status = models.CharField(
        max_length=4,
        choices=Status.choices,
        default=Status.EN_PREPARATION,
    )

    def __str__(self):
        return f"Commande {self.id}"
    
    @property
    def total(self):
        """Calcule le total de la commande."""
        total_value = self.produits.aggregate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        )['total']
        return total_value or "0.00"


class CommandeProduit(models.Model):
    """Model representing a product in an order."""
    id = models.AutoField(primary_key=True)
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField(help_text="Quantité commandée et payée")
    unites_gratuites = models.IntegerField(default=0, help_text="Unités gratuites reçues (ex: promotion 3+1)")
    prix_euro = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    price_cost = models.DecimalField(max_digits=10, decimal_places=2)
    lot = models.CharField(max_length=20, blank=True, null=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    date_expiration = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ligne de commande {self.id}"
    
    @property
    def total_quantity(self):
        """Quantité totale reçue (payée + gratuites)"""
        return self.quantity + self.unites_gratuites
    
    @property
    def effective_cost(self):
        """Coût unitaire effectif incluant les UG"""
        total_qty = self.total_quantity
        if total_qty > 0:
            return (self.quantity * self.price_cost) / total_qty
        return self.price_cost


class Avoir(models.Model):
    """Modèle pour les retours fournisseurs (Avoirs)."""
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
    fournisseur = models.ForeignKey(
        'Fournisseur', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='avoirs'
    )
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegardé")
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
        fournisseur_name = self.fournisseur.name if self.fournisseur else 'N/A'
        return f"{self.numero} - {fournisseur_name}"
    
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
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    stock_lot = models.ForeignKey(
        'StockLot', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='avoirs',
        help_text="Lot spécifique retourné (si applicable)"
    )
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix de retour")
    lot = models.CharField(max_length=100, blank=True)
    date_expiration = models.DateField(null=True, blank=True)
    est_cloture = models.BooleanField(default=False, help_text="Indique si cette ligne est administrativement clôturée")

    class Meta:
        verbose_name = "Ligne d'avoir"
        verbose_name_plural = "Lignes d'avoir"
    
    def __str__(self):
        produit_name = self.produit.name if self.produit else self.produit_nom or "Produit inconnu"
        return f"{produit_name} x {self.quantity}"
    
    @property
    def total(self):
        """Calcule le total de la ligne"""
        return self.quantity * self.price
    
    @property
    def produit_cip(self):
        return self.produit.cip1 if self.produit else ''
