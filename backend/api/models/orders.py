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
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.db.models import QuerySet
    from django.db.models.fields.related_descriptors import RelatedManager
    from .paiements import PaiementFournisseur


class Commande(models.Model):
    """Model representing an order."""
    class Status(models.TextChoices):
        EN_PREPARATION = 'PREP', 'En préparation'
        EN_ATTENTE = 'ATT', 'En attente'
        CLOTUREE = 'CLOT', 'Clôturée'
    
    class Type(models.TextChoices):
        LOCALE = 'LOC', 'Locale'
        DIRECTE = 'DIR', 'Directe'
    
    class Source(models.TextChoices):
        MANUEL = 'MANUEL', 'Manuel'
        AUTO_SCHEDULE = 'AUTO', 'Planification auto'

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
    fournisseur_nom = models.CharField(max_length=255, null=True, blank=True) # Nom si fournisseur supprimé
    numero_facture = models.CharField(max_length=100, null=True, blank=True, unique=True)
    date = models.DateTimeField(default=timezone.now)
    date_cloture = models.DateTimeField(null=True, blank=True)
    date_echeance = models.DateField(
        null=True, blank=True, 
        help_text="Calculée automatiquement selon le délai du fournisseur."
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.EN_PREPARATION)
    
    # Source de création (pour suivre les commandes auto-générées)
    source = models.CharField(
        max_length=10, 
        choices=Source.choices, 
        default=Source.MANUEL,
        help_text="Origine de la commande (manuelle ou auto-générée)"
    )
    is_active = models.BooleanField(default=True, help_text="Commande active (non supprimée dans la corbeille)")
    
    # Reverse relations (declared for type checkers; populated by Django ORM)
    produits: "RelatedManager[CommandeProduit]"
    paiements: "RelatedManager[PaiementFournisseur]"
    paiements_multiples: "RelatedManager[PaiementFournisseur]"

    # Tracking
    closed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='commandes_cloturees')

    def save(self, *args, **kwargs):
        if self.numero_facture:
            self.numero_facture = self.numero_facture.upper().strip()
            # Convert empty string to None to avoid uniqueness conflict in DB
            if not self.numero_facture:
                self.numero_facture = None
        else:
            self.numero_facture = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Commande {self.id}"
    
    @property
    def total(self):
        """Calcule le total de la commande."""
        total_value = self.produits.aggregate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        )['total']
        return total_value or Decimal("0.00")

    @property
    def montant_paye(self):
        """Somme des paiements enregistrés pour cette commande."""
        return self.paiements.aggregate(
            total=Sum('montant', output_field=DecimalField())
        )['total'] or Decimal("0.00")

    @property
    def reste_a_payer(self):
        """Montant restant à régler."""
        total = Decimal(str(self.total))
        paye = self.montant_paye
        return max(Decimal("0.00"), total - paye)

    @property
    def statut_paiement(self):
        """État du règlement de la facture."""
        if self.status != self.Status.CLOTUREE:
            return "NON_CONCERNE"
        
        reste = self.reste_a_payer
        if reste <= 0:
            return "PAYE"
        
        paye = self.montant_paye
        if paye > 0:
            return "PARTIEL"
        
        return "IMPAYE"


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
    tva = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
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
    validated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='avoirs_validated', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="Avoir actif (non supprimé dans la corbeille)")
    
    if TYPE_CHECKING:
        produits: "QuerySet[LigneAvoir]"

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


class OrderSchedule(models.Model):
    """Configuration for automated order generation."""
    class ConditionLogic(models.TextChoices):
        AND = 'AND', 'ET'
        OR = 'OR', 'OU'

    class TeletransmissionMode(models.TextChoices):
        IMMEDIATE = 'IMMEDIATE', 'Immédiate'
        BATCH = 'BATCH', 'Par lots'

    class ExecutionMode(models.TextChoices):
        SIMPLE = 'SIMPLE', 'Remplacement des ventes (Simple)'
        OPTIMISE = 'OPTIMISE', 'Analyse prédictive (Intelligent)'
        CUMULATIF = 'CUMULATIF', 'Cumulatif depuis dernière commande'

    id = models.AutoField(primary_key=True)
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.CASCADE, related_name='schedules')
    
    # Scheduling
    active_days = models.JSONField(default=list, help_text="List of active days [0-6]")
    frequency_weeks = models.IntegerField(default=1)
    start_date = models.DateField(default=date.today)
    time = models.TimeField(default="12:00")
    is_active = models.BooleanField(default=True)
    
    # Options
    has_alert_sound = models.BooleanField(default=True)
    has_teletransmission = models.BooleanField(default=False)
    teletransmission_mode = models.CharField(max_length=20, choices=TeletransmissionMode.choices, default=TeletransmissionMode.IMMEDIATE)
    needs_financial_reception = models.BooleanField(default=True)
    print_copies = models.IntegerField(default=1)
    
    # Delivery
    delivery_time = models.TimeField(null=True, blank=True)
    auto_reception_delay = models.IntegerField(default=0, help_text="Minutes before auto-reception")
    notify_sms = models.BooleanField(default=False)
    notify_whatsapp = models.BooleanField(default=False)
    
    # Logic
    special_code = models.CharField(max_length=50, blank=True)
    min_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_items = models.IntegerField(default=0)
    condition_logic = models.CharField(max_length=3, choices=ConditionLogic.choices, default=ConditionLogic.AND)
    
    # Automation Logic
    execution_mode = models.CharField(max_length=10, choices=ExecutionMode.choices, default=ExecutionMode.OPTIMISE)
    analysis_period_days = models.IntegerField(default=30)
    comment = models.TextField(blank=True)
    last_run = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Schedule {self.id} - {self.fournisseur.name}"
