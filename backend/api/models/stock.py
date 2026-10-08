"""
Stock-related models: StockLot, LotSequence, StockAdjustment, MouvementStock.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone


class LotSequence(models.Model):
    """
    Modèle pour gérer la séquence atomique des numéros de lot.
    Singleton : une seule instance (id=1) stocke le dernier numéro utilisé.
    """
    id = models.IntegerField(primary_key=True, default=1)
    last_number = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Dernier numéro de séquence utilisé"
    )

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
    last_number = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    
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
        LotSequence.objects.update_or_create(id=1, defaults={'last_number': sequence})
        return f'L{sequence:02d}'
    except ValueError:
        pass

    from django.db import transaction

    with transaction.atomic():
        try:
            seq_obj = LotSequence.objects.select_for_update().get(id=1)
        except LotSequence.DoesNotExist:
            last_number = 0
            last_stock = StockLot.objects.order_by('-created_at', '-id').first()
            if last_stock and last_stock.lot and last_stock.lot.startswith('L'):
                try:
                    last_number = int(last_stock.lot[1:])
                except ValueError:
                    pass
            seq_obj = LotSequence.objects.create(id=1, last_number=last_number)

        seq_obj.last_number += 1
        seq_obj.save(update_fields=['last_number'])
        return f'L{seq_obj.last_number:02d}'


def get_next_ticket_session():
    """
    Retourne le prochain numéro de ticket pour la journée en cours.
    Utilise Redis (cache) pour éviter le verrouillage global de la base de données.
    """
    from django.core.cache import cache
    from django.db import transaction
    today = timezone.localtime(timezone.now()).date()
    cache_key = f"ticket_session_sequence:{today}"

    try:
        sequence = cache.incr(cache_key)
        # Différer l'écriture DB (fallback seulement) après le commit de la transaction
        # en cours, pour ne pas retenir le verrou de ligne (TicketSessionSequence)
        # pendant toute la durée de finalize_sale (goulot d'étranglement sous charge).
        transaction.on_commit(
            lambda: TicketSessionSequence.objects.update_or_create(
                date=today,
                defaults={'last_number': sequence}
            )
        )
        return sequence
    except ValueError:
        pass

    with transaction.atomic():
        seq_obj, _ = TicketSessionSequence.objects.select_for_update().get_or_create(
            date=today,
            defaults={'last_number': 0}
        )
        seq_obj.last_number += 1
        seq_obj.save(update_fields=['last_number'])
        return seq_obj.last_number


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
        'Fournisseur', on_delete=models.SET_NULL, null=True, blank=True, db_index=True
    )
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegardé")
    # NOTE: quantity_initial=0 est légitime — les inventaires créent des lots vides
    # (lot découvert au comptage sans réception préalable).
    quantity_initial = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text="Quantité totale initiale (payée + gratuites)"
    )
    quantity_paid = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Quantité payée uniquement"
    )
    quantity_free = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Unités gratuites (UG)"
    )
    quantity_free_remaining = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Unités gratuites restantes en rayon"
    )
    quantity_remaining = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text="Quantité totale restante en rayon"
    )
    quantity_reserved = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Quantité en réserve pour ce lot"
    )
    price_cost = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Prix d'achat unitaire effectif (ajusté avec UG)"
    )
    selling_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00,
        validators=[MinValueValidator(Decimal('0'))],
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
            models.Index(fields=['produit', 'quantity_remaining', 'date_expiration']),
            models.Index(fields=['date_expiration']),
            # Perf (migration 0262) — index créés en CONCURRENTLY
            models.Index(fields=['date_reception'], name='stocklot_date_reception_idx'),
            models.Index(
                fields=['date_reception'],
                condition=models.Q(quantity_free__gt=0),
                name='stocklot_qtyfree_reception_idx',
            ),
            models.Index(
                fields=['produit'],
                condition=models.Q(quantity_free_remaining__gt=0),
                name='stocklot_qtyfreerem_idx',
            ),
            models.Index(
                fields=['produit'],
                condition=~models.Q(quantity_reserved=0),
                name='stocklot_qtyreserved_idx',
            ),
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
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, help_text="Utilisateur ayant effectué le réappro")
    total_products = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Nombre de produits distincts impactés"
    )
    total_units = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text="Nombre total d'unités transférées"
    )
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
    avoir_client = models.ForeignKey(
        'AvoirClient', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mouvements_stock',
        help_text="Avoir client associé au mouvement (pour les retours clients)"
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
            # Perf (migration 0262) — index créés en CONCURRENTLY
            models.Index(fields=['type_mouvement', 'date'], name='mvt_stock_type_date_idx'),
            models.Index(fields=['date'], name='mvt_stock_date_idx'),
        ]

    def __str__(self):
        produit_name = self.produit.name if self.produit else self.produit_nom or "Produit inconnu"
        return f"{self.date} - {produit_name} - {self.type_mouvement} ({self.quantite})"


class StockObligation(models.Model):
    """
    Dette de stock créée par une vente facturée mais non couverte par un lot.

    - PROMIS : quantité payée par le client, non encore remise.
    - FORCE : quantité livrée malgré l'absence de stock/lot disponible.

    `stock_applied` indique que `quantity_remaining` est actuellement incluse
    dans le stock négatif du produit. Une correction physique brute (inventaire
    ou ajustement absolu) peut repasser ce drapeau à False sans supprimer la
    dette métier.
    """

    class TypeObligation(models.TextChoices):
        PROMIS = 'PROMIS', 'Promis'
        FORCE = 'FORCE', 'Vente forcée'

    class Status(models.TextChoices):
        EN_ATTENTE = 'ATT', 'En attente'
        RESOLUE = 'RES', 'Résolue'
        ANNULEE = 'ANN', 'Annulée'

    class StockLocation(models.TextChoices):
        RAYON = 'RAYON', 'Rayon'
        RESERVE = 'RESERVE', 'Réserve'

    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligations'
    )
    produit_nom = models.CharField(max_length=150, blank=True, null=True)
    facture = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligations'
    )
    facture_produit = models.ForeignKey(
        'FactureProduit', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligations'
    )
    promis = models.ForeignKey(
        'Promis', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligations'
    )
    type = models.CharField(max_length=10, choices=TypeObligation.choices)
    status = models.CharField(max_length=4, choices=Status.choices, default=Status.EN_ATTENTE, db_index=True)
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text='Quantité initialement non couverte'
    )
    quantity_remaining = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text='Quantité restant à couvrir'
    )
    stock_applied = models.BooleanField(
        default=True,
        help_text='La dette restante est actuellement incluse dans le stock produit'
    )
    stock_location = models.CharField(
        max_length=10, choices=StockLocation.choices, default=StockLocation.RAYON,
        help_text='Compteur de stock impacté par la dette'
    )
    cost_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Coût estimé au moment de la vente'
    )
    selling_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Prix de vente au moment de la vente'
    )
    resolved_stock_lot = models.ForeignKey(
        'StockLot', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_stock_obligations'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_stock_obligations'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cancelled_stock_obligations'
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['produit', 'status'], name='stockobl_prod_status_idx'),
            models.Index(fields=['promis', 'status'], name='stockobl_promis_status_idx'),
            models.Index(fields=['facture', 'status'], name='stockobl_facture_status_idx'),
            models.Index(fields=['stock_applied', 'status'], name='stockobl_applied_status_idx'),
        ]

    def __str__(self):
        produit_name = self.produit.name if self.produit else self.produit_nom or 'Produit inconnu'
        return f"{self.get_type_display()} {produit_name} x{self.quantity_remaining}/{self.quantity}"

    @property
    def quantity_resolved(self):
        return max(0, self.quantity - self.quantity_remaining)


class StockObligationResolution(models.Model):
    """Trace chaque couverture d'une dette de stock, y compris hors facture."""
    id: int
    obligation = models.ForeignKey(
        StockObligation, on_delete=models.CASCADE, related_name='resolutions'
    )
    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligation_resolutions'
    )
    commande = models.ForeignKey(
        'Commande', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligation_resolutions'
    )
    stock_lot = models.ForeignKey(
        'StockLot', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_obligation_resolutions'
    )
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text='Quantité de dette couverte'
    )
    quantity_free = models.IntegerField(
        default=0, validators=[MinValueValidator(0)],
        help_text='Part couverte par les unités gratuites du lot'
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['commande'], name='stockoblres_commande_idx'),
            models.Index(fields=['obligation', 'commande'], name='stockoblres_obligation_cmd_idx'),
        ]

    def __str__(self):
        return f"Résolution obligation #{self.obligation_id} x{self.quantity}"


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


class SignalementBesoin(models.Model):
    """
    Besoin de commande signalé depuis le terrain (mobile comptoir).
    À ne pas confondre avec RuptureFournisseur (produit indisponible
    chez le grossiste) : ici, le produit manque en rayon ou est demandé
    par un client → à intégrer à la prochaine commande.
    """
    class Statut(models.TextChoices):
        NOUVEAU = 'NOUVEAU', 'Nouveau'
        INTEGRE = 'INTEGRE', 'Intégré à une commande'
        IGNORE = 'IGNORE', 'Ignoré'

    produit = models.ForeignKey(
        'Produit', on_delete=models.CASCADE,
        related_name='signalements_besoins'
    )
    quantite = models.PositiveIntegerField(null=True, blank=True)
    note = models.TextField(blank=True, default='')
    utilisateur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    statut = models.CharField(
        max_length=10, choices=Statut.choices, default=Statut.NOUVEAU
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['statut', '-created_at']),
        ]

    def __str__(self):
        return f"Besoin {self.produit.name} - {self.get_statut_display()}"


# ============== SIGNALS ==============

@receiver(pre_save, sender=StockLot)
def auto_generate_lot_number(sender, instance, **kwargs):
    """Génère automatiquement un numéro de lot si non fourni."""
    if not instance.lot:
        instance.lot = generate_lot_number()


@receiver(post_save, sender=StockLot)
def sync_product_stock_on_lot_save(sender, instance, created, **kwargs):
    """
    Synchronise le stock vendable depuis les lots sans effacer les dettes
    de stock en attente (promis ou vente forcée déjà comptées négativement).
    """
    if instance.produit and instance.produit.use_lot_management:
        instance.produit.calculate_stock_from_lots()


@receiver(post_delete, sender=StockLot)
def sync_product_stock_on_lot_delete(sender, instance, **kwargs):
    """Synchronise le stock du produit quand un lot est supprimé."""
    if instance.produit and instance.produit.use_lot_management:
        instance.produit.calculate_stock_from_lots()
