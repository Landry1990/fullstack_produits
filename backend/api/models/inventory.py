# -*- coding: utf-8 -*-
"""
Inventory-related models: Inventaire, LigneInventaire, RelationTransformation, HistoriqueTransformation.
"""
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class Inventaire(models.Model):
    """Model representing an inventory count."""
    class Status(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        VALIDEE = 'VALIDEE', 'Validée'

    date = models.DateTimeField(default=timezone.now)
    description = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_COURS)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Inventaire du {self.date.strftime('%d/%m/%Y')}"


class LigneInventaire(models.Model):
    """A line item in an inventory count."""
    inventaire = models.ForeignKey(Inventaire, on_delete=models.CASCADE, related_name='lignes')
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    stock_lot = models.ForeignKey(
        'StockLot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventaires',
        help_text="Lot spécifique compté (si inventaire par lot)"
    )
    stock_theorique = models.IntegerField(help_text="Stock au moment de l'ajout dans l'inventaire")
    quantite_physique = models.IntegerField(default=0)
    ecart = models.IntegerField(default=0, editable=False)
    pmp_snapshot = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['inventaire', 'stock_lot'],
                condition=models.Q(stock_lot__isnull=False),
                name='unique_inventaire_lot'
            )
        ]
    
    def save(self, *args, **kwargs):
        self.ecart = self.quantite_physique - self.stock_theorique
        super().save(*args, **kwargs)

    def __str__(self):
        produit_name = self.produit.name if self.produit else self.produit_nom or "Produit inconnu"
        return f"{produit_name} : {self.quantite_physique} (Th: {self.stock_theorique})"
    
    @property
    def lot_numero(self):
        """Retourne le numéro du lot si disponible"""
        return self.stock_lot.lot if self.stock_lot else None
    
    @property
    def lot_expiration(self):
        """Retourne la date d'expiration du lot si disponible"""
        return self.stock_lot.date_expiration if self.stock_lot else None


class RelationTransformation(models.Model):
    """
    Définit la relation de transformation entre deux produits.
    Exemple: 1 boîte PARACETAMOL (produit_source) = 20 détails PARACETAMOL (produit_destination)
    """
    produit_source = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='transformations_source',
        help_text="Produit à transformer (ex: BOITE)"
    )
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='transformations_destination',
        help_text="Produit résultant (ex: DETAIL)"
    )
    ratio = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Ratio de conversion (ex: 20.00 si 1 boîte = 20 détails)"
    )
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['produit_source', 'produit_destination']
        verbose_name = "Relation de transformation"
        verbose_name_plural = "Relations de transformation"
    
    def __str__(self):
        return f"{self.produit_source.name} -> {self.produit_destination.name} (x{self.ratio})"


class HistoriqueTransformation(models.Model):
    """Historique des transformations effectuées."""
    relation = models.ForeignKey(
        RelationTransformation, 
        on_delete=models.CASCADE,
        related_name='historique'
    )
    produit_source = models.ForeignKey(
        'Produit', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hist_trans_source'
    )
    produit_source_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit source sauvegardé")
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hist_trans_dest'
    )
    produit_destination_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit destination sauvegardé")
    quantite_source = models.IntegerField(help_text="Quantité transformée (source)")
    quantite_destination = models.IntegerField(help_text="Quantité obtenue (destination)")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_transformation = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-date_transformation']
        verbose_name = "Historique de transformation"
        verbose_name_plural = "Historiques de transformations"
    
    def __str__(self):
        src_name = self.produit_source.name if self.produit_source else self.produit_source_nom or "?"
        dst_name = self.produit_destination.name if self.produit_destination else self.produit_destination_nom or "?"
        return f"{self.quantite_source} {src_name} -> {self.quantite_destination} {dst_name}"
