# -*- coding: utf-8 -*-
"""
Stock-related models: StockLot, LotSequence, StockAdjustment, MouvementStock.
"""
from django.db import models
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth.models import User
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver


class LotSequence(models.Model):
    """
    Modèle pour gérer la séquence atomique des numéros de lot.
    Singleton : une seule instance (id=1) stocke le dernier numéro utilisé.
    """
    id = models.IntegerField(primary_key=True, default=1)
    last_number = models.IntegerField(default=0, help_text="Dernier numéro de séquence utilisé")
    
    class Meta:
        db_table = 'lot_sequence'
    
    def __str__(self):
        return f"Lot Sequence: {self.last_number}"

class TicketSessionSequence(models.Model):
    """
    Séquence pour les numéros de ticket en session de caisse.
    Reset quotidien.
    """
    date = models.DateField(primary_key=True)
    last_number = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'ticket_session_sequence'
    
    def __str__(self):
        return f"Ticket Sequence: {self.last_number} for {self.date}"


def generate_lot_number():
    """
    Génère un numéro de lot unique au format L01
    Utilise Redis (cache) pour éviter le verrouillage global de la base de données.
    """
    CACHE_KEY = 'lot_sequence'
    
    try:
        sequence = cache.incr(CACHE_KEY)
    except ValueError:
        last_number = 0
        
        # Import here to avoid circular imports
        last_stock = StockLot.objects.order_by('-created_at', '-id').first()
        
        if last_stock and last_stock.lot and last_stock.lot.startswith('L'):
            try:
                last_number = int(last_stock.lot[1:])
            except ValueError:
                pass
                
        try:
            seq_obj = LotSequence.objects.get(id=1)
            if seq_obj.last_number > last_number:
                last_number = seq_obj.last_number
        except LotSequence.DoesNotExist:
            pass
            
        cache.set(CACHE_KEY, last_number, timeout=None)
        sequence = cache.incr(CACHE_KEY)
        LotSequence.objects.update_or_create(id=1, defaults={'last_number': sequence})

    return f'L{sequence:02d}'


def get_next_ticket_session():
    """
    Retourne le prochain numéro de ticket pour la journée en cours.
    Gère le reset quotidien de manière atomique.
    """
    from django.db import transaction
    today = timezone.now().date()
    
    with transaction.atomic():
        seq, created = TicketSessionSequence.objects.select_for_update().get_or_create(
            date=today,
            defaults={'last_number': 0}
        )
        seq.last_number += 1
        seq.save(update_fields=['last_number'])
        return seq.last_number


class StockLot(models.Model):
    """
    Représente un lot de stock reçu d'un fournisseur.
    Permet la traçabilité FIFO et le calcul du CA par fournisseur.
    """
    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='stock_lots'
    )
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    commande_produit = models.ForeignKey(
        'CommandeProduit', on_delete=models.CASCADE, 
        related_name='stock_lot', null=True, blank=True, 
        help_text="Référence à la ligne de commande (si applicable)"
    )
    fournisseur = models.ForeignKey(
        'Fournisseur', on_delete=models.SET_NULL, null=True, blank=True
    )
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegardé")
    quantity_initial = models.IntegerField(help_text="Quantité totale initiale (payée + gratuites)")
    quantity_paid = models.IntegerField(default=0, help_text="Quantité payée uniquement")
    quantity_free = models.IntegerField(default=0, help_text="Unités gratuites (UG)")
    quantity_free_remaining = models.IntegerField(default=0, help_text="Unités gratuites restantes en rayon")
    quantity_remaining = models.IntegerField(help_text="Quantité totale restante en rayon")
    quantity_reserved = models.IntegerField(default=0, help_text="Quantité en réserve pour ce lot")
    price_cost = models.DecimalField(
        max_digits=10, decimal_places=2, 
        help_text="Prix d'achat unitaire effectif (ajusté avec UG)"
    )
    selling_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00, 
        help_text="Prix de vente lors de la réception"
    )
    lot = models.CharField(
        max_length=20, blank=True, null=True, db_index=True, 
        help_text="Numéro de lot auto-généré ou manuel"
    )
    date_expiration = models.DateField(blank=True, null=True)
    date_reception = models.DateTimeField(help_text="Date de réception du lot (pour FIFO)")
    is_divers = models.BooleanField(default=False, db_index=True, help_text="Lot provenant d'une commande diverse")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Optimistic Locking - évite les verrous pessimistes (select_for_update)
    version = models.IntegerField(
        default=1,
        help_text="Version pour optimistic locking (concurrency control)"
    )

    class Meta:
        ordering = ['date_reception']
        indexes = [
            models.Index(fields=['produit', 'date_reception']),
            models.Index(fields=['produit', 'quantity_remaining']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['produit', 'lot'],
                condition=models.Q(lot__isnull=False),
                name='unique_produit_lot'
            )
        ]

    def __str__(self):
        ug_info = f" dont {self.quantity_free_remaining}/{self.quantity_free} UG" if self.quantity_free > 0 else ""
        produit_name = self.produit.name if self.produit else self.produit_nom or "Produit inconnu"
        return f"Lot {self.id} - {produit_name} ({self.quantity_remaining}/{self.quantity_initial}{ug_info})"


class ReapproSession(models.Model):
    """
    Regroupe un ensemble de transferts de stock (Réserve -> Rayon) effectués simultanément.
    Permet la traçabilité et l'impression de rapports de réapprovisionnement.
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, help_text="Utilisateur ayant effectué le réappro")
    total_products = models.IntegerField(default=0, help_text="Nombre de produits distincts impactés")
    total_units = models.IntegerField(default=0, help_text="Nombre total d'unités transférées")
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = 'reappro_session'
        ordering = ['-created_at']

    def __str__(self):
        return f"Session Réappro #{self.id} - {self.created_at.strftime('%d/%m/%Y %H:%M')}"


class StockAdjustment(models.Model):
    """Traçabilité des ajustements manuels de stock."""
    
    class ReasonType(models.TextChoices):
        INVENTAIRE = 'INVENTAIRE', 'Ajustement inventaire'
        CASSE = 'CASSE', 'Cassé'
        VOL = 'VOL', 'Vol'
        CONFUSION = 'CONFUSION', 'Confusion'
        ERREUR_ENTREE = 'ERR_ENTREE', 'Erreur d\'entrée en stock'
        AVARIE = 'AVARIE', 'Avarié'
        USAGE_INTERNE = 'USAGE_INT', 'Usage interne'
        PERIME = 'PERIME', 'Périmé'
        REAPPRO = 'REAPPRO', 'Réapprovisionnement'
    
    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='adjustments'
    )
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    stock_lot = models.ForeignKey(
        'StockLot', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='adjustments'
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    reappro_session = models.ForeignKey(
        'ReapproSession', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='adjustments',
        help_text="Session de réapprovisionnement associée (si applicable)"
    )

    
    reappro_session = models.ForeignKey(
        'ReapproSession', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='adjustments',
        help_text="Session de réapprovisionnement associée (si applicable)"
    )

    
    quantity_before = models.IntegerField(help_text="Stock Rayon avant ajustement")
    quantity_after = models.IntegerField(help_text="Stock Rayon après ajustement")
    quantity_change = models.IntegerField(help_text="Différence Rayon (+/-)")
    
    reserve_before = models.IntegerField(default=0, help_text="Stock Réserve avant ajustement")
    reserve_after = models.IntegerField(default=0, help_text="Stock Réserve après ajustement")
    reserve_change = models.IntegerField(default=0, help_text="Différence Réserve (+/-)")
    
    reason_type = models.CharField(max_length=10, choices=ReasonType.choices)
    reason_detail = models.TextField(blank=True, default='', help_text="Note optionnelle")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['produit', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        produit_name = self.produit.name if self.produit else self.produit_nom or "Produit inconnu"
        return f"{produit_name}: {self.quantity_change:+d} ({self.get_reason_type_display()})"


class MouvementStock(models.Model):
    """
    Historique de tous les mouvements de stock (Entrées, Sorties, Ajustements, Transformations)
    """
    class TypeMouvement(models.TextChoices):
        ENTREE = 'ENTREE', 'Entrée (Commande)'
        SORTIE = 'SORTIE', 'Sortie (Vente)'
        RETOUR = 'RETOUR', 'Retour (Annulation)'
        AJUSTEMENT = 'AJUSTEMENT', 'Ajustement Inventaire'
        AVOIR = 'AVOIR', 'Avoir (Retour Fournisseur)'
        TRANSFORMATION_ENTREE = 'TRANSFORMATION_ENTREE', 'Transformation (Entrée)'
        TRANSFORMATION_SORTIE = 'TRANSFORMATION_SORTIE', 'Transformation (Sortie)'
        REAPPRO_INTERSTOCK = 'REAPPRO_INTERSTOCK', 'Réappro (Réserve -> Rayon)'

    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='mouvements_stock'
    )
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    facture = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mouvements_stock',
        help_text="Facture associée au mouvement (pour les ventes/retours)"
    )
    commande = models.ForeignKey(
        'Commande', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mouvements_stock',
        help_text="Commande associée au mouvement (pour les achats/réceptions)"
    )
    inventaire = models.ForeignKey(
        'Inventaire', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mouvements_stock',
        help_text="Inventaire associé au mouvement (pour les ajustements)"
    )
    type_mouvement = models.CharField(max_length=30, choices=TypeMouvement.choices)
    quantite = models.IntegerField(help_text="Quantité mouvementée (positive ou négative)")
    stock_apres = models.IntegerField(null=True, blank=True, help_text="Stock après mouvement (snapshot)")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['produit', 'date']),
        ]

    def __str__(self):
        produit_name = self.produit.name if self.produit else self.produit_nom or "Produit inconnu"
        return f"{self.date} - {produit_name} - {self.type_mouvement} ({self.quantite})"


class RuptureFournisseur(models.Model):
    """
    Historique des ruptures fournisseurs.
    Permet de suivre les produits indisponibles chez les grossistes.
    """
    produit = models.ForeignKey(
        'Produit', on_delete=models.CASCADE, 
        related_name='ruptures_fournisseurs'
    )
    fournisseur = models.ForeignKey(
        'Fournisseur', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ruptures_signalees'
    )
    date_debut = models.DateTimeField(auto_now_add=True)
    date_fin = models.DateTimeField(null=True, blank=True, help_text="Date à laquelle le produit est redevenu disponible")
    est_resolu = models.BooleanField(default=False)
    utilisateur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    remarques = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-date_debut']
        indexes = [
            models.Index(fields=['est_resolu', '-date_debut']),
            models.Index(fields=['produit', 'est_resolu']),
        ]

    def __str__(self):
        status = "RÉSOLU" if self.est_resolu else "EN COURS"
        return f"Rupture {self.produit.name} - {status} (depuis {self.date_debut})"


# ============== SIGNALS ==============

@receiver(pre_save, sender=StockLot)
def auto_generate_lot_number(sender, instance, **kwargs):
    """Génère automatiquement un numéro de lot si non fourni."""
    if not instance.lot:
        instance.lot = generate_lot_number()


@receiver(post_save, sender=StockLot)
def sync_product_stock_on_lot_save(sender, instance, created, **kwargs):
    """
    Synchronise le stock du produit quand un lot est créé ou modifié.
    Met à jour à la fois le stock Rayon et le stock Réserve.
    """
    if instance.produit and instance.produit.use_lot_management:
        from django.db.models import Sum
        from .products import Produit
        
        results = instance.produit.stock_lots.aggregate(
            total_remaining=Sum('quantity_remaining'),
            total_reserved=Sum('quantity_reserved')
        )
        
        total_remaining = results['total_remaining'] or 0
        total_reserved = results['total_reserved'] or 0
        
        # On ne sauve que si changement pour éviter boucles ou écritures inutiles
        if instance.produit.stock != total_remaining or instance.produit.stock_reserve != total_reserved:
            Produit.objects.filter(pk=instance.produit.pk).update(
                stock=total_remaining,
                stock_reserve=total_reserved
            )


@receiver(post_delete, sender=StockLot)
def sync_product_stock_on_lot_delete(sender, instance, **kwargs):
    """Synchronise le stock du produit quand un lot est supprimé."""
    if instance.produit and instance.produit.use_lot_management:
        from django.db.models import Sum
        from .products import Produit
        
        results = instance.produit.stock_lots.aggregate(
            total_remaining=Sum('quantity_remaining'),
            total_reserved=Sum('quantity_reserved')
        )
        
        Produit.objects.filter(pk=instance.produit.pk).update(
            stock=results['total_remaining'] or 0,
            stock_reserve=results['total_reserved'] or 0
        )
