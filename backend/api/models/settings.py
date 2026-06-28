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
        ordering = ['pk']

    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton
        super(LoyaltySetting, self).save(*args, **kwargs)
        
    def __str__(self):
        return "Configuration Fidélité"


class PharmacySettings(models.Model):
    """Configuration de la pharmacie (Singleton) - Nom, Adresse, Téléphone, etc."""
    pharmacy_name = models.CharField(max_length=200, default="ZENITH")
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

    taux_change_actif = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=655.957,
        help_text="Taux de change actif pour les commandes directes (Euro -> FCFA). Source de vérité unique."
    )

    # --- Paramètres Avancés (Règles Métier) ---
    min_margin_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.34,
        help_text="Taux de marge minimum acceptable pour les commandes (ex: 1.34 = 25% de marge)"
    )
    low_stock_threshold_days = models.IntegerField(
        default=15,
        help_text="Seuil d'alerte stock bas (en jours de couverture)"
    )
    dormant_stock_days = models.IntegerField(
        default=90,
        help_text="Seuil pour considérer un stock comme dormant (sans vente depuis X jours)"
    )
    debt_alert_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=100000,
        help_text="Seuil d'alerte pour la dette client (FCFA)"
    )
    
    auto_logout_timeout = models.IntegerField(
        default=15,
        help_text="Délai d'inactivité avant déconnexion automatique (en minutes, 0 pour désactiver)"
    )
    
    # --- Paramètres Caisse (Sécurité) ---
    hide_cash_totals = models.BooleanField(
        default=False,
        help_text="Masquer les montants dans le rapport de clôture de caisse (mode sécurité)"
    )
    
    # --- Paramètres Impression & Affichage ---
    ticket_paper_width = models.IntegerField(
        default=80,
        choices=[(80, '80mm'), (58, '58mm')],
        help_text="Largeur du papier pour les tickets (mm)"
    )
    currency_symbol = models.CharField(
        max_length=10,
        default="FCFA",
        help_text="Symbole de la devise (ex: FCFA, €, $)"
    )
    locale = models.CharField(
        max_length=10,
        default="fr-FR",
        help_text="Code locale pour le formatage (ex: fr-FR, en-US)"
    )

    # WhatsApp Business API (Meta Cloud)
    whatsapp_enabled = models.BooleanField(default=False)
    whatsapp_access_token = models.TextField(blank=True, default="", help_text="Meta Access Token (Permanent)")
    whatsapp_phone_id = models.CharField(max_length=50, blank=True, default="", help_text="Phone Number ID")
    whatsapp_business_id = models.CharField(max_length=50, blank=True, default="", help_text="WhatsApp Business Account ID")
    pharmacist_whatsapp_number = models.CharField(
        max_length=50, 
        blank=True, 
        default="", 
        help_text="Numéro WhatsApp de la pharmacienne titulaires (format international sans +)"
    )
    
    # Telegram Bot
    telegram_enabled = models.BooleanField(default=False)
    telegram_bot_token = models.CharField(max_length=200, blank=True, default="", help_text="Token du bot Telegram (de @BotFather)")
    telegram_chat_id = models.CharField(max_length=50, blank=True, default="", help_text="Chat ID de la pharmacienne (récupéré via /start sur le bot)")

    # --- Paramètres de Sauvegarde ---
    backup_enabled = models.BooleanField(
        default=True,
        help_text="Activer la sauvegarde automatique"
    )
    backup_time = models.TimeField(
        default="02:00:00",
        help_text="Heure de la sauvegarde automatique (ex: 02:00)"
    )
    backup_interval_minutes = models.IntegerField(
        default=1440,
        help_text="Intervalle entre deux sauvegardes automatiques (en minutes, ex: 60=toutes les heures, 1440=quotidien, 10080=hebdomadaire)"
    )
    backup_retention_count = models.IntegerField(
        default=30,
        help_text="Nombre maximal de sauvegardes à conserver"
    )
    secondary_backup_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Chemin secondaire (ex: E:\\Backups_Pharmacie) pour double sauvegarde"
    )
    google_drive_backup_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Chemin du dossier Google Drive monté (ex: /mnt/gdrive) pour copie automatique"
    )

    # --- Paramètres Cloud Backup (S3) ---
    cloud_backup_enabled = models.BooleanField(
        default=False,
        help_text="Activer la sauvegarde vers le cloud (S3-compatible)"
    )
    cloud_backup_endpoint = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Endpoint S3 (ex: s3.amazonaws.com, s3.wasabisys.com, s3.fr-par.scw.cloud)"
    )
    cloud_backup_bucket = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Nom du bucket S3"
    )
    cloud_backup_access_key = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Access Key ID S3"
    )
    cloud_backup_secret_key = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Secret Access Key S3"
    )
    cloud_backup_region = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Région S3 (ex: us-east-1, eu-west-1, fr-par — laisser vide si non requis)"
    )
    cloud_backup_path_prefix = models.CharField(
        max_length=200,
        blank=True,
        default="pharmacie-backups/",
        help_text="Préfixe de chemin dans le bucket (ex: pharmacie-backups/)"
    )

    # --- Paramètres Expert IA (Santé du Stock) ---
    availability_weight = models.IntegerField(
        default=60,
        help_text="Poids de la disponibilité dans le score de santé global (0-100)"
    )
    rotation_weight = models.IntegerField(
        default=40,
        help_text="Poids de la rotation dans le score de santé global (0-100)"
    )

    # --- Seuils d'alertes et de performance configurables ---
    perf_drop_threshold = models.DecimalField(
        max_digits=3, decimal_places=2, default=0.70, 
        help_text="Seuil de baisse CA pour alerte (0.7 = 30% de baisse)"
    )
    perf_alert_hour = models.IntegerField(
        default=14, 
        help_text="Heure à partir de laquelle l'alerte performance se déclenche"
    )
    good_coverage_min_days = models.IntegerField(
        default=15, 
        help_text="Couverture stock min (jours) pour score santé"
    )
    good_coverage_max_days = models.IntegerField(
        default=90, 
        help_text="Couverture stock max (jours) pour score santé"
    )
    critical_stock_days = models.IntegerField(
        default=7, 
        help_text="Seuil stock critique (jours)"
    )
    imminent_rupture_days = models.IntegerField(
        default=3, 
        help_text="Seuil rupture imminente (jours)"
    )
    traffic_analysis_days = models.IntegerField(
        default=30, 
        help_text="Fenêtre d'analyse du trafic horaire (jours)"
    )
    shortage_alert_threshold = models.IntegerField(
        default=10, 
        help_text="Nb de produits en rupture avant alerte"
    )
    dormant_stock_days = models.IntegerField(
        default=90,
        help_text="Seuil de jours pour stock dormant"
    )


    # --- Paramètres Rapport Automatique Mensuel ---
    monthly_report_enabled = models.BooleanField(
        default=True,
        help_text="Activer le rapport automatique mensuel"
    )
    monthly_report_day = models.IntegerField(
        default=1,
        help_text="Jour du mois pour l'envoi du rapport (1-28)"
    )
    # Éléments du rapport (cases à cocher)
    report_include_sales = models.BooleanField(
        default=True,
        help_text="Inclure les ventes du mois"
    )
    report_include_margin = models.BooleanField(
        default=True,
        help_text="Inclure les marges réalisées"
    )
    report_include_stock_health = models.BooleanField(
        default=True,
        help_text="Inclure le score de santé du stock"
    )
    report_include_ruptures = models.BooleanField(
        default=True,
        help_text="Inclure les ruptures de stock"
    )
    report_include_expiration = models.BooleanField(
        default=True,
        help_text="Inclure les alertes péremption"
    )
    report_include_top_products = models.BooleanField(
        default=True,
        help_text="Inclure le top 10 des produits vendus"
    )
    report_include_slow_moving = models.BooleanField(
        default=True,
        help_text="Inclure les produits à rotation lente"
    )
    report_include_debt = models.BooleanField(
        default=True,
        help_text="Inclire la dette clients et fournisseurs"
    )
    report_include_financial_summary = models.BooleanField(
        default=True,
        help_text="Inclure le résumé financier"
    )
    report_include_comparison = models.BooleanField(
        default=False,
        help_text="Inclure la comparaison avec le mois précédent"
    )
    report_recipients_email = models.TextField(
        blank=True,
        default="",
        help_text="Emails destinataires (séparés par des virgules)"
    )
    report_send_whatsapp = models.BooleanField(
        default=False,
        help_text="Envoyer aussi via WhatsApp"
    )
    report_send_telegram = models.BooleanField(
        default=False,
        help_text="Envoyer aussi via Telegram"
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
    is_multi_caisse = models.BooleanField(
        default=False, 
        help_text="Activer le mode Multi-Caisse (plusieurs postes de caisse)"
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
        type_label = dict(self.Type.choices).get(self.type, self.type)
        return f"[{type_label}] {self.label}"


class TVA(models.Model):
    """
    Table de gestion des taux de TVA configurables.
    Ex: 19.25%, 0%, etc.
    """
    taux = models.DecimalField(
        max_digits=5, decimal_places=2, unique=True,
        help_text="Taux de TVA en pourcentage (ex: 19.25)"
    )
    libelle = models.CharField(
        max_length=50, blank=True, 
        help_text="Description optionnelle (ex: Taux Normal)"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Taux de TVA"
        verbose_name_plural = "Taux de TVA"
        ordering = ['-taux']

    def __str__(self):
        return f"{self.taux}%"
