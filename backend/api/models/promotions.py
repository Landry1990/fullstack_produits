# -*- coding: utf-8 -*-
"""
Promotion logic: Percentage, Fixed Amount, Buy X Get Y.
"""
from django.db import models
from django.utils import timezone
from decimal import Decimal

class Promotion(models.Model):
    """
    Système de promotion flexible.
    Types:
    1. PERCENTAGE: -X% sur le produit
    2. FIXED_AMOUNT: -X F sur le produit
    3. BUY_X_GET_Y: Acheter X, recevoir Y gratuits
    """
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE', 'Pourcentage (%)'
        FIXED_AMOUNT = 'FIXED_AMOUNT', 'Montant Fixe (F)'
        BUY_X_GET_Y = 'BUY_X_GET_Y', 'Acheter X, Recevoir Y'
        BUNDLE = 'BUNDLE', 'Pack / Lot (Prix Fixe)'

    class ApplicationMode(models.TextChoices):
        AUTO_SHOW = 'AUTO_SHOW', 'Affichage automatique'
        AUTO_SUGGEST = 'AUTO_SUGGEST', 'Proposition automatique'
        AUTO_APPLY = 'AUTO_APPLY', 'Remise automatique'

    name = models.CharField(max_length=200, help_text="Nom de la promotion (ex: Soldes d'été)")
    description = models.TextField(blank=True, null=True, help_text="Description détaillée")
    
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    
    application_mode = models.CharField(
        max_length=20,
        choices=ApplicationMode.choices,
        default=ApplicationMode.AUTO_APPLY
    )
    
    discount_type = models.CharField(
        max_length=20, 
        choices=DiscountType.choices, 
        default=DiscountType.PERCENTAGE
    )
    
    # Valeur pour PERCENTAGE ou FIXED_AMOUNT ou BUNDLE (Prix du pack)
    value = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Valeur de la remise (en % ou en F) ou Prix Total du Pack"
    )


    
    # Conditions pour BUY_X_GET_Y ou seuil pour remise
    buy_quantity = models.IntegerField(
        default=1, 
        help_text="Quantité minimale à acheter pour déclencher la promo"
    )
    get_quantity = models.IntegerField(
        default=0, 
        help_text="Quantité offerte (pour Buy X Get Y)"
    )
    
    # Portée de la promotion
    priority = models.IntegerField(default=1, help_text="Priorité d'application (plus élevé = prioritaire)")
    products = models.ManyToManyField('Produit', blank=True, related_name='promotions')
    rayons = models.ManyToManyField('Rayon', blank=True, related_name='promotions')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_discount_type_display()})"

    @property
    def is_valid(self):
        now = timezone.now()
        if not self.active:
            return False
        if self.end_date and now > self.end_date:
            return False
        if now < self.start_date:
            return False
        return True

class PromotionPackItem(models.Model):
    """
    Définit les produits requis pour un Pack.
    Ex: 3 x Topicrem, 2 x Cerave.
    """
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='pack_items')
    product = models.ForeignKey('Produit', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1, help_text="Quantité requise dans le pack")
    
    class Meta:
        unique_together = ('promotion', 'product')

    def __str__(self):
        return f"{self.quantity}x {self.product} in {self.promotion}"
