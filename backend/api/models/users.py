# -*- coding: utf-8 -*-
"""
User-related models: Profile and user signals.
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class Profile(models.Model):
    """Extended user profile with permissions and role."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    allowed_menus = models.JSONField(default=list, blank=True)
    can_do_returns = models.BooleanField(default=False)
    can_sell_negative_stock = models.BooleanField(default=False)
    can_cash_out = models.BooleanField(default=True, help_text="Autorisé à encaisser (si mode centralisé actif)")
    
    # Granular Permissions
    can_delete_product = models.BooleanField(default=False, verbose_name="Supprimer des produits")
    can_adjust_stock = models.BooleanField(default=False, verbose_name="Ajuster le stock manuellement")
    can_delete_fournisseur = models.BooleanField(default=False, verbose_name="Supprimer des fournisseurs")
    can_delete_commande = models.BooleanField(default=False, verbose_name="Supprimer des commandes")
    can_close_commande = models.BooleanField(default=False, verbose_name="Clôturer des commandes")
    can_generate_coupon = models.BooleanField(default=False, verbose_name="Générer des coupons")
    
    # New Sudo-Specific Permissions
    can_cancel_invoice = models.BooleanField(default=False, verbose_name="Annuler des factures")
    can_modify_invoice = models.BooleanField(default=False, verbose_name="Modifier des factures (Caisse)")
    can_cancel_promis = models.BooleanField(default=False, verbose_name="Annuler des promis")
    can_manage_perimes = models.BooleanField(default=False, verbose_name="Gérer les produits périmés")
    can_manage_avoirs = models.BooleanField(default=False, verbose_name="Gérer les avoirs fournisseurs")
    can_validate_zero_amount = models.BooleanField(default=False, verbose_name="Valider des ventes à montant nul ou négatif")

    # Price & Discount Control
    can_modify_price = models.BooleanField(default=False, verbose_name="Modifier le prix de vente")
    max_discount_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Remise maximum (%)"
    )

    ROLE_CHOICES = [
        ('PHARMACIEN', 'Pharmacien'),
        ('VENDEUR', 'Vendeur'),
        ('CAISSIER', 'Caissier'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='VENDEUR')

    def __str__(self):
        return f"Profile of {self.user.username}"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if not hasattr(instance, 'profile') or instance.profile is None:
        Profile.objects.get_or_create(user=instance)
    else:
        instance.profile.save()
