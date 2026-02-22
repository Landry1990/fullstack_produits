# -*- coding: utf-8 -*-
"""
Client-related models: Fournisseur, Client, AyantDroit.
"""
from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from decimal import Decimal


class Fournisseur(models.Model):
    """Model representing a supplier."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    address = models.TextField()
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Le numéro de téléphone doit être au format: '+999999999'. Jusqu'à 15 chiffres autorisés."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17, unique=True)
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(
        default=True, 
        help_text="Fournisseur actif (visible dans les recherches)"
    )
    
    TYPE_REGLEMENT_CHOICES = [
        ('FACTURE', 'À la facture'),
        ('RELEVE', 'Sur relevé'),
    ]
    type_reglement = models.CharField(
        max_length=20, 
        choices=TYPE_REGLEMENT_CHOICES, 
        default='FACTURE',
        help_text="Mode d'échéance des paiements. Ubipharm/Laborex = RELEVE, Autres = FACTURE."
    )
    delai_paiement_jours = models.IntegerField(
        default=0,
        help_text="Délai de paiement accordé en jours (ex: 10, 15). 0 = au comptant."
    )

    def __str__(self):
        return self.name

    @property
    def solde_dette(self):
        """
        Calcule la dette totale envers ce fournisseur.
        Somme des totaux des commandes CLOTUREE - Somme des paiements effectues.
        """
        from django.db.models import Sum, F, DecimalField
        from .orders import Commande
        from .paiements import PaiementFournisseur
        
        # 1. Total des commandes clôturées
        commandes = self.commande_set.filter(status=Commande.Status.CLOTUREE)
        total_du = Decimal('0.00')
        for cmd in commandes:
            total_du += Decimal(str(cmd.total))
            
        # 2. Total des paiements effectués
        total_paye = self.paiements_effectues.aggregate(
            total=Sum('montant', output_field=DecimalField())
        )['total'] or Decimal('0.00')
        
        return total_du - total_paye


class Client(models.Model):
    """Model representing a client."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    address = models.TextField()
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Le numéro de téléphone doit être au format: '+999999999'. Jusqu'à 15 chiffres autorisés."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17, unique=True)
    email = models.EmailField(unique=True)
    
    CLIENT_TYPE_CHOICES = [
        ('PARTICULIER', 'Particulier'),
        ('PROFESSIONNEL', 'Professionnel'),
    ]
    client_type = models.CharField(max_length=20, choices=CLIENT_TYPE_CHOICES, default='PARTICULIER')
    plafond = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    taux_couverture = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.00,
        help_text="Taux de couverture assurance en % (0-100) pour tiers payant"
    )
    
    remise_automatique = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Pourcentage de remise automatique (0-100%) appliqué à chaque vente",
        verbose_name="Remise automatique (%)"
    )
    
    points_fidelite = models.IntegerField(default=0)
    pending_discount = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00, 
        help_text="Remise en % acquise pour la prochaine vente"
    )
    is_loyalty_member = models.BooleanField(
        default=True, 
        help_text="Si activé, ce client participe au programme de fidélité"
    )

    created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(
        default=True, 
        help_text="Client actif (visible dans les recherches)"
    )

    def __str__(self):
        return self.name

    @property
    def current_debt(self):
        """
        Calcule la dette actuelle du client.
        Somme des restes à payer sur les factures VALIDEE.
        """
        if hasattr(self, 'current_debt_annotated'):
            return self.current_debt_annotated or Decimal('0.00')

        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce
        
        factures_with_debt = self.facture_set.filter(status__in=['VAL', 'PAY']).annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            remainder=F('total_ttc') - F('paid_amount')
        ).filter(
            remainder__gt=0
        ).aggregate(
            total_debt=Sum('remainder')
        )
        
        return factures_with_debt['total_debt'] or Decimal('0.00')


class AyantDroit(models.Model):
    """Model representing a beneficiary for a professional client."""
    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='ayants_droit')
    matricule = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    societe = models.CharField(max_length=200, blank=True, null=True)
    date_creation = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.nom} ({self.matricule})"


# Signal for preserving supplier name before deletion
@receiver(pre_delete, sender=Fournisseur)
def preserve_supplier_name_on_delete(sender, instance, **kwargs):
    """
    Avant suppression fournisseur, sauvegarde du nom.
    """
    if not instance.pk:
        return
        
    nom = instance.name
    
    try:
        instance.commande_set.all().update(fournisseur_nom=nom)
    except Exception:
        pass
    
    try:
        instance.stocklot_set.all().update(fournisseur_nom=nom)
    except Exception:
        pass
    
    try:
        instance.avoirs.all().update(fournisseur_nom=nom)
    except Exception:
        pass
