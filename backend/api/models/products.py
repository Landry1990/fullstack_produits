# -*- coding: utf-8 -*-
"""
Product-related models: Rayon, Forme, Groupe, FamilleRisque, Substance, DrugInteraction, Produit.
"""
from django.db import models
from django.contrib.postgres.indexes import GinIndex  # Recherche textuelle performante
from django.utils import timezone
from decimal import Decimal


class Rayon(models.Model):
    """Model representing a product category."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    parent = models.ForeignKey(
        'self', null=True, blank=True, 
        on_delete=models.SET_NULL, 
        related_name='sub_rayons', 
        verbose_name="Rayon Parent"
    )

    def __str__(self):
        return self.name


class Forme(models.Model):
    """Model representing a pharmaceutical form (e.g., Comprimé, Sirop)."""
    id = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nom


class Groupe(models.Model):
    """Model representing a product group."""
    id = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nom


class FamilleRisque(models.Model):
    """
    Famille thérapeutique ou de risque (ex: AINS, Paracétamol).
    Utilisé pour détecter les redondances ou surdosages lors de la vente.
    """
    id = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    
    niveau_risque = models.CharField(max_length=20, default='STANDARD', choices=[
        ('STANDARD', 'Standard'),
        ('HAUT', 'Haut Risque'),
    ])

    def __str__(self):
        return self.nom


class Substance(models.Model):
    """
    Substance active (ex: Paracétamol, Ibuprofène).
    Utilisé pour détecter les interactions et les redondances.
    """
    nom = models.CharField(max_length=255, unique=True)
    code_cas = models.CharField(
        max_length=50, blank=True, null=True, 
        help_text="Code CAS pour identification unique"
    )

    def __str__(self):
        return self.nom

    class Meta:
        ordering = ['nom']


class DrugInteraction(models.Model):
    """Interaction entre deux substances."""
    GRAVITY_CHOICES = [
        ('PRECAUTION', 'Précaution d\'emploi'),
        ('A_PRENDRE_EN_COMPTE', 'A prendre en compte'),
        ('DECONSEILLE', 'Déconseillé'),
        ('CONTRE_INDIQUE', 'Contre-indiqué'),
    ]

    substance_a = models.ForeignKey(
        Substance, on_delete=models.CASCADE, related_name='interactions_a'
    )
    substance_b = models.ForeignKey(
        Substance, on_delete=models.CASCADE, related_name='interactions_b'
    )
    gravity = models.CharField(max_length=20, choices=GRAVITY_CHOICES, default='PRECAUTION')
    description = models.TextField(help_text="Description du risque et de la conduite à tenir")

    class Meta:
        unique_together = ('substance_a', 'substance_b')
        verbose_name = "Interaction Médicamenteuse"
        verbose_name_plural = "Interactions Médicamenteuses"

    def __str__(self):
        return f"{self.substance_a} + {self.substance_b} ({self.get_gravity_display()})"


class Produit(models.Model):
    """Model representing a product."""
    id = models.AutoField(primary_key=True)
    rayon = models.ForeignKey('Rayon', on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True)
    is_supplier_exclusive = models.BooleanField(
        default=False,
        help_text="Si activé, ce produit ne peut être commandé que chez ce fournisseur."
    )
    forme = models.ForeignKey('Forme', on_delete=models.SET_NULL, null=True, blank=True, related_name='produits')
    groupe = models.ForeignKey('Groupe', on_delete=models.SET_NULL, null=True, blank=True, related_name='produits')
    famille_risque = models.ForeignKey(
        'FamilleRisque', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='produits', help_text="Famille pour contrôle interactions (ex: AINS)"
    )
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)
    message_alerte = models.TextField(blank=True, null=True, help_text="Message d'alerte affiché lors de la saisie en caisse")
    blocking_alerte = models.BooleanField(
        default=False, 
        help_text="Si coché, l'alerte bloque la validation de la vente tant qu'elle n'est pas acquittée."
    )
    stock = models.IntegerField(default=0)
    use_lot_management = models.BooleanField(
        default=True,
        help_text="Activer la gestion par lots FIFO pour ce produit (recommandé pour traçabilité)"
    )
    cip1 = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)
    cip2 = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)
    cip3 = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    expire_date = models.DateField(blank=True, null=True)
    stock_alert = models.IntegerField(default=0)
    stock_minimum = models.IntegerField(default=0)
    stock_maximum = models.IntegerField(default=0)
    tva = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    rotation_moyenne = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    taux_marge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, editable=False)
    pourcentage_marge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, editable=False)
    pmp = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Prix Moyen Pondéré")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Données Cliniques
    code_atc = models.CharField(
        max_length=20, blank=True, null=True, 
        help_text="Code ATC (Anatomique Thérapeutique Chimique)"
    )
    substance_active = models.CharField(
        max_length=255, blank=True, null=True, 
        help_text="Nom de la substance active principale (Texte libre)"
    )
    substances = models.ManyToManyField(
        Substance, blank=True, related_name='produits', 
        help_text="Substances actives structurées pour les interactions"
    )
    
    # Ordonnancier - Champs pour identifier les médicaments soumis à ordonnance
    requires_prescription = models.BooleanField(
        default=False,
        help_text="Ce produit nécessite une ordonnance"
    )
    
    SURVEILLANCE_CHOICES = [
        ('NONE', 'Aucune'),
        ('STANDARD', 'Surveillance standard'),
        ('RENFORCEE', 'Surveillance renforcée'),
    ]
    surveillance_category = models.CharField(
        max_length=20, 
        choices=SURVEILLANCE_CHOICES, 
        default='NONE',
        help_text="Catégorie de surveillance du médicament"
    )
    
    # Dates de dernière transaction
    dernier_achat = models.DateField(
        blank=True, 
        null=True,
        help_text="Date du dernier achat (réception de commande)"
    )
    dernier_vente = models.DateField(
        blank=True, 
        null=True,
        help_text="Date de la dernière vente"
    )
    
    # Vitrine - Disponibilité en ligne
    is_public = models.BooleanField(
        default=False,
        help_text="Produit visible sur la vitrine en ligne"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Produit actif (visible dans les recherches)"
    )

    # --- Paramètres Stock Réservé & Réapprovisionnement ---
    has_reserve_storage = models.BooleanField(
        default=False,
        help_text="Active la gestion Réserve / Rayon pour ce produit"
    )
    capacite_rayon = models.IntegerField(
        default=0,
        help_text="Capacité maximale d'exposition en rayon"
    )
    min_rayon = models.IntegerField(
        default=0,
        help_text="Seuil de déclenchement du réapprovisionnement"
    )
    stock_reserve = models.IntegerField(
        default=0,
        help_text="Quantité totale en réserve (stock tampon)"
    )

    # --- Paramètres Pathologies Chroniques ---
    is_chronic = models.BooleanField(
        default=False,
        help_text="Indique si ce produit est destiné à un traitement chronique (diabète, hypertension, etc.)"
    )
    default_treatment_days = models.IntegerField(
        default=30,
        help_text="Durée par défaut du traitement en jours (utilisé pour les rappels)"
    )


    @property
    def total_stock(self):
        """
        Returns the total stock: Rayon (stock) + Reserve (stock_reserve).
        """
        return (self.stock or 0) + (self.stock_reserve or 0)

    def save(self, *args, **kwargs):
        # Validation Exclusivité
        if self.is_supplier_exclusive and not self.fournisseur:
            from django.core.exceptions import ValidationError
            raise ValidationError("Un produit ne peut être exclusif sans fournisseur attribué.")

        # Calcul automatique des marges
        if self.cost_price and self.selling_price:
            try:
                cp = Decimal(str(self.cost_price))
                sp = Decimal(str(self.selling_price))
                
                if cp > 0:
                    self.taux_marge = sp / cp
                else:
                    self.taux_marge = Decimal('0.00')
                    
                if sp > 0:
                    self.pourcentage_marge = ((sp - cp) / sp) * 100
                else:
                    self.pourcentage_marge = Decimal('0.00')
            except (ValueError, TypeError):
                pass
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
    
    def calculate_stock_from_lots(self):
        """
        Calcule et met à jour le stock du produit basé sur la somme
        des quantités restantes de tous ses lots.
        Gère à la fois le stock Rayon (quantity_remaining) et le stock Réserve (quantity_reserved).
        """
        from django.db.models import Sum
        results = self.stock_lots.aggregate(
            total_remaining=Sum('quantity_remaining'),
            total_reserved=Sum('quantity_reserved')
        )
        
        self.stock = results['total_remaining'] or 0
        self.stock_reserve = results['total_reserved'] or 0
        
        self.save(update_fields=['stock', 'stock_reserve'])
        return self.stock

    class Meta:
        indexes = [
            models.Index(fields=['stock']),
            models.Index(fields=['rayon', 'stock']),
            models.Index(fields=['fournisseur']),
            models.Index(fields=['stock', 'stock_minimum']),
            # Index Postgres pour recherche textuelle rapide (GIN + Trigramme)
            GinIndex(fields=['name'], name='produit_name_trgm_idx', opclasses=['gin_trgm_ops']),
            GinIndex(fields=['cip1'], name='produit_cip1_trgm_idx', opclasses=['gin_trgm_ops']),
            GinIndex(fields=['cip2'], name='produit_cip2_trgm_idx', opclasses=['gin_trgm_ops']),
            GinIndex(fields=['cip3'], name='produit_cip3_trgm_idx', opclasses=['gin_trgm_ops']),
        ]
