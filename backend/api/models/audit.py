# -*- coding: utf-8 -*-
"""
Audit-related models: ActivityLog, AuditLog, MouvementCaisse, Ordonnancier, LigneOrdonnancier.
"""
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User


class ActivityLog(models.Model):
    """Log des actions critiques pour l'audit."""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50)  # ex: 'CANCEL_INVOICE', 'DELETE_PRODUCT'
    target_model = models.CharField(max_length=50, blank=True, null=True)
    target_id = models.CharField(max_length=50, blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action}"


class AuditLog(models.Model):
    """Model representing an audit log entry for tracking detailed user actions."""
    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Création'
        UPDATE = 'UPDATE', 'Modification'
        DELETE = 'DELETE', 'Suppression'
        LOGIN = 'LOGIN', 'Connexion'
        EXPORT = 'EXPORT', 'Export'
        OTHER = 'OTHER', 'Autre'
        STOCK_ADJUST = 'STOCK_ADJ', 'Ajustement stock'
        PRICE_CHANGE = 'PRICE_CHG', 'Changement prix'
        CLOTURE_CAISSE = 'CLOTURE', 'Clôture caisse'
        INVOICE_CANCEL = 'INV_CANCEL', 'Annulation facture'
        INVOICE_DELETE = 'INV_DEL', 'Suppression facture'
        INVOICE_VALIDATE = 'INV_VALID', 'Validation facture'
        INVENTORY_CREATE = 'INV_CRE', 'Création inventaire'
        INVENTORY_VALIDATE = 'INV_VAL', 'Validation inventaire'
        ORDER_RECEIVE = 'ORD_RECV', 'Réception commande'
        ORDER_CANCEL = 'ORD_CNCL', 'Annulation réception'
        SUDO_VALIDATION = 'SUDO_VAL', 'Validation Sudo'

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=10, choices=Action.choices)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, default='', help_text="Description lisible de l'action")
    details = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.action} {self.model_name} at {self.timestamp}"


class MouvementCaisse(models.Model):
    """Modèle pour les entrées et sorties de caisse spéciales (hors ventes)."""
    TYPE_CHOICES = [
        ('ENTREE', 'Entrée'),
        ('SORTIE', 'Sortie'),
    ]
    
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    motif = models.CharField(max_length=200, help_text="Ex: Électricité, Carburant, etc.")
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='mouvements_caisse'
    )
    poste_caisse = models.ForeignKey(
        'PosteCaisse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mouvements', help_text="Caisse sur laquelle le mouvement est effectué"
    )
    
    class Meta:
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.type} - {self.montant} ({self.motif})"


class Ordonnancier(models.Model):
    """Registre des médicaments délivrés sur ordonnance."""
    numero_ordre = models.AutoField(primary_key=True)
    date_delivrance = models.DateTimeField(default=timezone.now)
    
    patient_nom = models.CharField(max_length=200, help_text="Nom du patient")
    prescripteur_nom = models.CharField(max_length=200, help_text="Nom du médecin prescripteur")
    
    facture = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='ordonnancier_entries'
    )
    
    image_ordonnance = models.ImageField(
        upload_to='ordonnances/%Y/%m/', 
        null=True, 
        blank=True,
        help_text="Image scannée de l'ordonnance"
    )
    
    enregistre_par = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, 
        related_name='ordonnancier_entries'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-numero_ordre']
        verbose_name = "Ordonnancier"
        verbose_name_plural = "Ordonnancier"
    
    def __str__(self):
        return f"Ord. #{self.numero_ordre} - {self.patient_nom} ({self.date_delivrance.strftime('%d/%m/%Y')})"


class LigneOrdonnancier(models.Model):
    """Ligne de l'ordonnancier (un médicament délivré)."""
    ordonnancier = models.ForeignKey(Ordonnancier, on_delete=models.CASCADE, related_name='lignes')
    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, 
        related_name='ordonnancier_lignes'
    )
    produit_nom = models.CharField(max_length=200, help_text="Copie du nom pour historique")
    quantite = models.IntegerField()
    
    surveillance_category = models.CharField(max_length=20, default='NONE')
    
    class Meta:
        verbose_name = "Ligne Ordonnancier"
        verbose_name_plural = "Lignes Ordonnancier"
    
    def __str__(self):
        return f"{self.produit_nom} x{self.quantite}"
