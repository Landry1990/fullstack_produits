# -*- coding: utf-8 -*-
"""
Application settings models: Loyalty, Pharmacy, and Invoice settings (Singletons).
"""
from django.db import models
import uuid


class LoyaltySetting(models.Model):
    """Configuration du système de fidélité (Singleton)"""
    amount_per_point = models.DecimalField(
        max_digits=10, decimal_places=0, default=1000, 
        help_text="Montant en FCFA pour gagner 1 point"
    )
    point_value = models.DecimalField(
        max_digits=10, decimal_places=0, default=10, 
        help_text="Valeur d'un point en FCFA"
    )
    auto_reward_threshold = models.IntegerField(
        default=0, 
        help_text="Nombre de points pour déclencher la récompense auto (0=désactivé)"
    )
    auto_reward_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, 
        help_text="Pourcentage de remise auto"
    )

    class Meta:
        verbose_name = "Configuration Fidélité"
        verbose_name_plural = "Configuration Fidélité"

    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton
        super(LoyaltySetting, self).save(*args, **kwargs)
        
    def __str__(self):
        return "Configuration Fidélité"


class PharmacySettings(models.Model):
    """Configuration de la pharmacie (Singleton) - Nom, Adresse, Téléphone, etc."""
    pharmacy_name = models.CharField(max_length=200, default="PHARMA STOCK")
    address = models.CharField(max_length=300, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="Douala")
    country = models.CharField(max_length=100, blank=True, default="Cameroun")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    niu = models.CharField(
        max_length=15, blank=True, default="", 
        help_text="Numéro d'Identification Unique (14-15 caractères)"
    )
    registre_commerce = models.CharField(
        max_length=20, blank=True, default="", 
        help_text="Registre de Commerce"
    )
    ticket_footer_message = models.TextField(blank=True, default="Merci de votre visite!")
    receipt_header = models.TextField(blank=True, default="", help_text="Message en haut du ticket")
    logo = models.ImageField(
        upload_to='pharmacy_logos/', blank=True, null=True, 
        help_text="Logo de la pharmacie"
    )
    
    # Monitoring Configuration
    monitoring_id = models.UUIDField(
        default=uuid.uuid4, 
        editable=False, 
        help_text="Identifiant unique de cette instance pour le monitoring"
    )
    central_server_url = models.URLField(
        blank=True, 
        default="", 
        help_text="URL du serveur central (ex: https://monitor.ma-pharma.com)"
    )
    monitoring_enabled = models.BooleanField(
        default=False,
        help_text="Activer l'envoi de données au serveur central"
    )

    coefficient_direct_commande = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=1.35, 
        help_text="Coefficient multiplicateur pour les commandes directes (Euro -> Revient)"
    )
    
    class Meta:
        verbose_name = "Paramètres Pharmacie"
        verbose_name_plural = "Paramètres Pharmacie"
    
    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton pattern
        super(PharmacySettings, self).save(*args, **kwargs)
    
    def __str__(self):
        return self.pharmacy_name


class InvoiceSettings(models.Model):
    """Singleton model to store invoice configuration."""
    HEADER_LAYOUT_CHOICES = [
        ('split', 'Séparé (Logo Gauche / Info Droite)'),
        ('left', 'Tout à Gauche'),
        ('center', 'Tout Centré'),
        ('right', 'Tout à Droite'),
    ]

    company_name = models.CharField(max_length=255, default="Ma Société")
    company_address = models.TextField(default="Adresse de l'entreprise\nTéléphone: 00 00 00 00 00")
    footer_text = models.TextField(default="Merci de votre confiance.", blank=True)
    
    header_layout = models.CharField(max_length=20, choices=HEADER_LAYOUT_CHOICES, default='split')
    primary_color = models.CharField(max_length=7, default="#000000")
    centralized_cash_register = models.BooleanField(
        default=False, 
        help_text="Activer le mode Caisse Centralisée"
    )

    def save(self, *args, **kwargs):
        if not self.pk and InvoiceSettings.objects.exists():
            return InvoiceSettings.objects.first()
        return super(InvoiceSettings, self).save(*args, **kwargs)

    def __str__(self):
        return "Invoice Configuration"


class ConfigurationOption(models.Model):
    """
    Modèle générique pour stocker des listes de configuration dynamiques
    (ex: Motifs d'ajustement, Motifs de retour, Coupures de monnaie)
    """
    class Type(models.TextChoices):
        STOCK_ADJUSTMENT_REASON = 'STOCK_ADJ', 'Motif Ajustement Stock'
        SUPPLIER_RETURN_REASON = 'SUPPLIER_RET', 'Motif Retour Fournisseur'
        MONEY_DENOMINATION = 'MONEY_DENOM', 'Coupure Monnaie'

    code = models.CharField(max_length=50, help_text="Code technique (ex: PERIME)")
    label = models.CharField(max_length=200, help_text="Libellé affiché (ex: Produit Périmé)")
    type = models.CharField(max_length=20, choices=Type.choices)
    value = models.CharField(max_length=100, blank=True, null=True, help_text="Valeur optionnelle (ex: 10000 pour un billet)")
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0, help_text="Ordre d'affichage")
    
    class Meta:
        verbose_name = "Option de Configuration"
        verbose_name_plural = "Options de Configuration"
        ordering = ['type', 'order', 'label']
        unique_together = ['type', 'code']

    def __str__(self):
        return f"[{self.get_type_display()}] {self.label}"
