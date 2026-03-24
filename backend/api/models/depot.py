# -*- coding: utf-8 -*-
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from decimal import Decimal

class DepotClient(models.Model):
    """Modèle pour suivre les dépôts et retraits d'argent d'un client."""
    
    class Type(models.TextChoices):
        DEPOT = 'DEPOT', 'Dépôt (Crédit)'
        RETRAIT = 'RETRAIT', 'Retrait/Remboursement (Débit)'
        ACHAT = 'ACHAT', 'Utilisation pour achat (Débit)'
        ANNULATION_ACHAT = 'ANNUL', 'Annulation achat (Crédit)'

    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(
        'Client', 
        on_delete=models.CASCADE, 
        related_name='depots_historique'
    )
    type = models.CharField(
        max_length=10, 
        choices=Type.choices, 
        default=Type.DEPOT
    )
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateTimeField(default=timezone.now)
    
    # Pour les dépôts initiaux
    mode_paiement = models.CharField(
        max_length=20, 
        blank=True, 
        null=True,
        help_text="Mode de versement initial (ESP, CHQ, etc.)"
    )
    
    # Lien vers la vente si c'est un achat
    facture = models.ForeignKey(
        'Facture', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='depots_utilises'
    )
    
    # Lien vers le mouvement de caisse si applicable
    mouvement_caisse = models.ForeignKey(
        'MouvementCaisse', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='depot_associe'
    )
    
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-date']
        verbose_name = "Dépôt Client"
        verbose_name_plural = "Dépôts Clients"
        indexes = [
            models.Index(fields=['client', '-date']),
            models.Index(fields=['type']),
        ]

    def __str__(self):
        return f"{self.get_type_display()} - {self.montant} F - {self.client.name}"
