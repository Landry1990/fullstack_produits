# -*- coding: utf-8 -*-
"""
Client-related models: Fournisseur, Client, AyantDroit.
"""
from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.contrib.postgres.indexes import GinIndex
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from decimal import Decimal


class Fournisseur(models.Model):
    """Model representing a supplier."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    address = models.TextField(blank=True, null=True)
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Le numéro de téléphone doit être au format: '+999999999'. Jusqu'à 15 chiffres autorisés."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17, unique=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    is_active = models.BooleanField(
        default=True, 
        help_text="Fournisseur actif (visible dans les recherches)"
    )
    is_divers = models.BooleanField(
        default=False,
        help_text="Fournisseur utilisé pour les achats divers (produits sans lien avec le stock normal)"
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
        help_text="Délai de paiement accordé en jours après fin de tranche/facture (ex: 10, 15). 0 = au comptant."
    )
    periode_releve_jours = models.IntegerField(
        default=10,
        help_text="Durée en jours d'une tranche de relevé (ex: 10 = du 1-10, 11-20, 21-31). Utilisé uniquement si type_reglement=RELEVE."
    )
    # ── Paramètres logistiques pour le moteur de réapprovisionnement ──
    delai_livraison_jours = models.IntegerField(
        default=7,
        help_text="Délai moyen entre validation de la commande et réception physique (jours)."
    )
    marge_retard_jours = models.IntegerField(
        default=2,
        help_text="Marge de sécurité pour les retards de livraison fréquents (jours)."
    )

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_instance = None
        if not is_new:
            try:
                old_instance = Fournisseur.objects.get(pk=self.pk)
            except Fournisseur.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)
        
        # Si le statut is_divers a changé ou si c'est un nouveau fournisseur divers
        if (old_instance and old_instance.is_divers != self.is_divers) or (is_new and self.is_divers):
            from .stock import StockLot
            StockLot.objects.filter(fournisseur=self).update(is_divers=self.is_divers)

    @property
    def solde_dette(self):
        """
        Calcule la dette totale envers ce fournisseur.
        Somme des totaux des commandes CLOTUREE - Somme des paiements effectues.
        """
        from django.db.models import Sum, F, DecimalField
        from .orders import Commande, CommandeProduit
        from .paiements import PaiementFournisseur
        
        # 1. Total des commandes clôturées en une seule requête agrégée
        total_du = CommandeProduit.objects.filter(
            commande__fournisseur=self,
            commande__status=Commande.Status.CLOTUREE
        ).aggregate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        )['total'] or Decimal('0.00')
            
        # 2. Total des paiements effectués
        total_paye = PaiementFournisseur.objects.filter(
            fournisseur=self
        ).aggregate(
            total=Sum('montant', output_field=DecimalField())
        )['total'] or Decimal('0.00')
        
        return total_du - total_paye


class Client(models.Model):
    """Model representing a client."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    address = models.TextField(blank=True, null=True)
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Le numéro de téléphone doit être au format: '+999999999'. Jusqu'à 15 chiffres autorisés."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17, unique=True, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    niu = models.CharField(max_length=100, blank=True, null=True, verbose_name="NIU")
    registre_commerce = models.CharField(max_length=100, blank=True, null=True, verbose_name="Registre de Commerce")
    
    CLIENT_TYPE_CHOICES = [
        ('PARTICULIER', 'Particulier'),
        ('PROFESSIONNEL', 'Professionnel'),
    ]
    client_type = models.CharField(max_length=20, choices=CLIENT_TYPE_CHOICES, default='PARTICULIER')
    plafond = models.DecimalField(max_digits=12, decimal_places=2, default=-1.00)
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

    majoration_pro_pourcentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Pourcentage de majoration des prix pour les clients professionnels (compensation délais longs)",
        verbose_name="Majoration Pro (%)"
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
    
    solde_depot = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        help_text="Solde actuel du dépôt/acompte du client"
    )
    
    is_deposit_enabled = models.BooleanField(
        default=False,
        blank=True,
        help_text="Si activé, ce client peut utiliser le système de dépôt"
    )

    message_alerte = models.TextField(
        blank=True, 
        null=True, 
        help_text="Message d'alerte affiché lors de la sélection du client en caisse"
    )
    
    # === CHAMPS DENORMALISES (performance 12 postes) ===
    solde_factures = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Solde total des factures impayées (denormalisé)",
        verbose_name="Solde factures"
    )
    nombre_factures_impayees = models.IntegerField(
        default=0,
        help_text="Nombre de factures non réglées (denormalisé)",
        verbose_name="Factures impayées"
    )
    derniere_mise_a_jour_solde = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Dernière mise à jour du solde",
        verbose_name="Mise à jour solde"
    )
    blocking_alerte = models.BooleanField(
        default=False, 
        help_text="Si coché, l'alerte bloque la facturation tant qu'elle n'est pas acquittée."
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
        Retourne la dette actuelle du client.
        Utilise le champ dénormalisé si frais (< 5 min), sinon calcule.
        """
        from django.utils import timezone
        from datetime import timedelta
        
        # Priorité 1: Champ dénormalisé si frais (< 5 minutes)
        if self.derniere_mise_a_jour_solde and (
            timezone.now() - self.derniere_mise_a_jour_solde < timedelta(minutes=5)
        ):
            return self.solde_factures or Decimal('0.00')
        
        # Priorité 2: Annotation si disponible (QuerySet optimisé)
        annotated = getattr(self, 'current_debt_annotated', None)
        if annotated is not None:
            return annotated or Decimal('0.00')
        
        # Fallback: Calcul complet (lent, éviter en production)
        debt_info = self._compute_debt_from_factures()
        return debt_info['total'] if isinstance(debt_info, dict) else debt_info
    
    def _compute_debt_from_factures(self):
        """
        Calcule la dette depuis les factures (méthode complète mais lente).
        À utiliser uniquement pour recalculer le solde dénormalisé.
        """
        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        
        # Importer ici pour éviter les imports circulaires
        from .billing import Facture, Caisse
        
        factures_with_debt = Facture.objects.filter(
            client=self,
            status__in=['VAL', 'PAY'],
            is_active=True
        ).annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            remainder=F('total_ttc') - F('paid_amount')
        ).filter(
            remainder__gt=0
        ).aggregate(
            total_debt=Sum('remainder'),
            count=models.Count('id')
        )
        
        return {
            'total': factures_with_debt['total_debt'] or Decimal('0.00'),
            'count': factures_with_debt['count'] or 0
        }
    
    def recalculate_solde(self, save=True):
        """
        Recalcule et met à jour le solde dénormalisé.
        Appeler après création de facture ou paiement.
        """
        debt_info = self._compute_debt_from_factures()
        
        self.solde_factures = debt_info['total']
        self.nombre_factures_impayees = debt_info['count']
        self.derniere_mise_a_jour_solde = timezone.now()
        
        if save:
            self.save(update_fields=[
                'solde_factures', 
                'nombre_factures_impayees', 
                'derniere_mise_a_jour_solde'
            ])
        
        return debt_info

    class Meta:
        indexes = [
            GinIndex(fields=['name'], name='client_name_trgm_idx', opclasses=['gin_trgm_ops']),
        ]


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
