# -*- coding: utf-8 -*-
from django.db import models
from django.utils import timezone
import datetime
from django.contrib.auth.models import User
from .clients import Fournisseur
from .orders import Commande

class PaiementFournisseur(models.Model):
    """Modèle pour enregistrer les paiements effectués aux fournisseurs."""
    
    MODE_P_CHOICES = [
        ('ESP', 'Espèces'),
        ('CHQ', 'Chèque'),
        ('VIR', 'Virement'),
        ('AVOIR', 'Avoir'),
        ('AUTRE', 'Autre'),
    ]

    id = models.AutoField(primary_key=True)
    fournisseur = models.ForeignKey(
        Fournisseur, 
        on_delete=models.CASCADE, 
        related_name='paiements_effectues'
    )
    commande = models.ForeignKey(
        Commande, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='paiements',
        help_text="Facture spécifique liée à ce paiement (optionnel)"
    )
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    date_paiement = models.DateField(default=datetime.date.today)
    mode_paiement = models.CharField(
        max_length=10, 
        choices=MODE_P_CHOICES, 
        default='ESP'
    )
    reference = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        help_text="Numéro de chèque, référence virement, etc."
    )
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='paiements_fournisseurs_deites'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Paiement Fournisseur"
        verbose_name_plural = "Paiements Fournisseurs"
        ordering = ['-date_paiement', '-created_at']

    def __str__(self):
        return f"Paiement {self.montant} F à {self.fournisseur.name} le {self.date_paiement}"
