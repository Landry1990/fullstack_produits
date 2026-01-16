from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.db.models import Sum, F, DecimalField
from django.core.cache import cache
from decimal import Decimal
from django.contrib.auth.models import User
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from datetime import date

# Create your models here

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    allowed_menus = models.JSONField(default=list, blank=True)
    can_do_returns = models.BooleanField(default=False)
    can_sell_negative_stock = models.BooleanField(default=False)
    # New permission for Centralized Cash Mode
    can_cash_out = models.BooleanField(default=True, help_text="Autorisé à encaisser (si mode centralisé actif)")
    
    # Granular Permissions
    can_delete_product = models.BooleanField(default=False, verbose_name="Supprimer des produits")
    can_adjust_stock = models.BooleanField(default=False, verbose_name="Ajuster le stock manuellement")
    can_delete_fournisseur = models.BooleanField(default=False, verbose_name="Supprimer des fournisseurs")
    can_delete_commande = models.BooleanField(default=False, verbose_name="Supprimer des commandes")
    can_close_commande = models.BooleanField(default=False, verbose_name="Clôturer des commandes")

    ROLE_CHOICES = [
        ('PHARMACIEN', 'Pharmacien'),
        ('VENDEUR', 'Vendeur'),
        ('CAISSIER', 'Caissier'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='VENDEUR')

    def __str__(self):
        return f"Profile of {self.user.username}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    # Create profile if it doesn't exist (for users created before Profile model was added)
    if not hasattr(instance, 'profile') or instance.profile is None:
        Profile.objects.get_or_create(user=instance)
    else:
        instance.profile.save()



class LoyaltySetting(models.Model):
    """Configuration du système de fidélité (Singleton)"""
    amount_per_point = models.DecimalField(max_digits=10, decimal_places=0, default=1000, help_text="Montant en FCFA pour gagner 1 point")
    point_value = models.DecimalField(max_digits=10, decimal_places=0, default=10, help_text="Valeur d'un point en FCFA")
    auto_reward_threshold = models.IntegerField(default=0, help_text="Nombre de points pour déclencher la récompense auto (0=désactivé)")
    auto_reward_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Pourcentage de remise auto")

    class Meta:
        verbose_name = "Configuration Fidélité"
        verbose_name_plural = "Configuration Fidélité"

    def save(self, *args, **kwargs):
        self.pk = 1 # Singleton
        super(LoyaltySetting, self).save(*args, **kwargs)
        
    def __str__(self):
        return "Configuration Fidélité"


class PharmacySettings(models.Model):
    """Configuration de la pharmacie (Singleton) - Nom, Adresse, Téléphone, etc."""
    pharmacy_name = models.CharField(max_length=200, default="PHARMA STOCK")
    address = models.CharField(max_length=300, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="Douala")
    country = models.CharField(max_length=100, blank=True, default="Cameroun")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    niu = models.CharField(max_length=15, blank=True, default="", help_text="Numéro d'Identification Unique (14-15 caractères)")
    registre_commerce = models.CharField(max_length=20, blank=True, default="", help_text="Registre de Commerce")
    ticket_footer_message = models.TextField(blank=True, default="Merci de votre visite!")
    receipt_header = models.TextField(blank=True, default="", help_text="Message en haut du ticket")
    logo = models.ImageField(upload_to='pharmacy_logos/', blank=True, null=True, help_text="Logo de la pharmacie")
    coefficient_direct_commande = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=1.35, 
        help_text="Coefficient multiplicateur pour les commandes directes (Euro -> Revient)"
    )
    
    class Meta:
        verbose_name = "Paramètres Pharmacie"
        verbose_name_plural = "Paramètres Pharmacie"
    
    def save(self, *args, **kwargs):
        self.pk = 1  # Singleton pattern
        super(PharmacySettings, self).save(*args, **kwargs)
    
    def __str__(self):
        return self.pharmacy_name

class Rayon(models.Model):
    """Model representing a product category."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='sub_rayons', verbose_name="Rayon Parent")

    def __str__(self):
        return self.name

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

    def __str__(self):
        return self.name

 

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
    pending_discount = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Remise en % acquise pour la prochaine vente")
    is_loyalty_member = models.BooleanField(default=True, help_text="Si activé, ce client participe au programme de fidélité")

    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name

    @property
    def current_debt(self):
        """
        Calcule la dette actuelle du client.
        Somme des restes à payer sur les factures VALIDEE.
        Optimisé pour utiliser l'annotation du ViewSet ou une agrégation unique.
        """
        # 1. Check if annotated by ViewSet (Zero SQL queries)
        if hasattr(self, 'current_debt_annotated'):
            return self.current_debt_annotated or Decimal('0.00')

        # 2. Fallback: Aggregate in database (One SQL query instead of loop)
        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce
        
        # On calcule la dette pour chaque facture et on somme
        # Note: L'agrégation directe sur self.facture_set est complexe car il faut faire la différence (TTC - Paiements)
        # Et ne garder que les positifs.
        
        # On replique la logique du ViewSet mais pour une instance unique
        # C'est moins grave de faire une requête ici car c'est pour un seul client
        
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


class Commande(models.Model):
    """Model representing an order."""
    class Status(models.TextChoices):
        EN_PREPARATION = 'PREP', 'En préparation'
        EN_ATTENTE = 'ATT', 'En attente'
        CLOTUREE = 'CLOT', 'Clôturée'
    
    class Type(models.TextChoices):
        LOCALE = 'LOC', 'Locale'
        DIRECTE = 'DIR', 'Directe'

    id = models.AutoField(primary_key=True)
    type = models.CharField(
        max_length=3,
        choices=Type.choices,
        default=Type.LOCALE,
        help_text="Type de commande (Locale ou Directe)"
    )
    # Taux de change Euro -> FCFA (ex: 655.957)
    taux_change = models.DecimalField(max_digits=10, decimal_places=3, default=655.957)
    # Coefficient global appliqué à la commande (Snapshot de PharmacySettings au moment de la création)
    frais_coefficient = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    
    # On utilise PROTECT pour éviter de supprimer des commandes si un fournisseur est effacé.
    # Nullable pour permettre les commandes de réassort global (sans fournisseur initial)
    fournisseur = models.ForeignKey(Fournisseur, on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegardé")
    numero_facture = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    date_cloture = models.DateTimeField(null=True, blank=True, verbose_name="Date de clôture")
    status = models.CharField(
        max_length=4,
        choices=Status.choices,
        default=Status.EN_PREPARATION,
    )
    # Le champ 'total' est retiré de la base de données.

    def __str__(self):
        return f"Commande {self.id}"
    
    @property
    def total(self):
        """Calcule le total de la commande en utilisant une agrégation de la base de données."""
        total_value = self.produits.aggregate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        )['total']
        return total_value or "0.00"

class CommandeProduit(models.Model):
    """Model representing a product in an order."""
    id = models.AutoField(primary_key=True)
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField(help_text="Quantité commandée et payée")
    unites_gratuites = models.IntegerField(default=0, help_text="Unités gratuites reçues (ex: promotion 3+1)")
    # Prix d'achat original en devise (pour commandes directes)
    prix_euro = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    price_cost = models.DecimalField(max_digits=10, decimal_places=2)
    lot = models.CharField(max_length=20, blank=True, null=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) # Added to track potential selling price
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
    


class Produit(models.Model):
    """Model representing a product."""
    id = models.AutoField(primary_key=True)
    rayon = models.ForeignKey('Rayon', on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True) 
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    stock = models.IntegerField()
    use_lot_management = models.BooleanField(
        default=True,
        help_text="Activer la gestion par lots FIFO pour ce produit (recommandé pour traçabilité)"
    )
    cip1 = models.CharField(max_length=20, unique=True, blank=True, null=True)
    cip2 = models.CharField(max_length=20, unique=True, blank=True, null=True)
    cip3 = models.CharField(max_length=20, unique=True, blank=True, null=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    expire_date = models.DateField(blank=True, null=True)
    stock_alert = models.IntegerField(default=0)
    stock_minimum = models.IntegerField(default=0)
    stock_maximum = models.IntegerField(default=0)
    tva = models.DecimalField(max_digits=5, decimal_places=2, default=19.25)
    rotation_moyenne = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    taux_marge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, editable=False)
    pourcentage_marge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, editable=False)
    pmp = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Prix Moyen Pondéré")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
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

    def save(self, *args, **kwargs):
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
        """
        from django.db.models import Sum
        total = self.stock_lots.aggregate(
            total=Sum('quantity_remaining')
        )['total'] or 0
        self.stock = total
        self.save(update_fields=['stock'])
        return total

    class Meta:
        indexes = [
            # Index sur stock pour les requêtes stock__lte, stock__gte, etc.
            models.Index(fields=['stock']),
            # Index composite pour les recherches par rayon et stock
            models.Index(fields=['rayon', 'stock']),
            # Index pour les recherches par fournisseur
            models.Index(fields=['fournisseur']),
            # Index pour les recherches de produits à faible stock
            models.Index(fields=['stock', 'stock_minimum']),
        ]


class Facture(models.Model):
    """Model representing a sales invoice."""
    class Status(models.TextChoices):
        BROUILLON = 'BROU', 'Brouillon'
        PROFORMA = 'PROF', 'Proforma'
        VALIDEE = 'VAL', 'Validée'
        PAYEE = 'PAY', 'Payée'
        ANNULEE = 'ANN', 'Annulée'

    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, null=True, blank=True)
    client_name_override = models.CharField(max_length=100, blank=True, null=True)
    ayant_droit = models.ForeignKey(AyantDroit, on_delete=models.SET_NULL, null=True, blank=True, related_name='factures')
    numero_facture = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=4,
        choices=Status.choices,
        default=Status.BROUILLON,
    )
    remise = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tva = models.DecimalField(max_digits=5, decimal_places=2, default=19.25)
    notes = models.TextField(blank=True, null=True)
    date_annulation = models.DateTimeField(null=True, blank=True)
    
    points_fidelite_gagnes = models.IntegerField(default=0)
    points_fidelite_utilises = models.IntegerField(default=0)
    montant_fidelite = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    part_client = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Part à payer par le client (Tiers Payant)")
    
    # Suivi de l'opérateur (Vendeur)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='factures_created', help_text="Utilisateur qui a créé la facture")

    def __str__(self):
        return f"Facture {self.numero_facture or self.id}"
    
    total_ht = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_tva = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Facture {self.numero_facture or self.id}"
    
    def calculate_totals(self, save=True):
        """
        Calcule les totaux HT, TVA et TTC ligne par ligne.
        IMPORTANT: Les prix de vente sont TTC (TVA incluse).
        On calcule donc HT = TTC / (1 + TVA%) et TVA = TTC - HT.
        """
        from django.db.models import Sum, F, DecimalField
        
        # Calcul Total TTC (somme des prix de vente qui incluent déjà la TVA)
        aggregated = self.produits.aggregate(
            total=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )
        total_ttc_brut = aggregated['total'] or Decimal('0.00')
        
        # Calcul HT et TVA ligne par ligne (extraction de la TVA depuis le TTC)
        total_ht = Decimal('0.00')
        total_tva = Decimal('0.00')
        
        for ligne in self.produits.all():
            # TTC de la ligne (prix de vente qui inclut déjà la TVA)
            ttc_ligne = ligne.quantity * ligne.selling_price
            
            # Calculer HT à partir du TTC : HT = TTC / (1 + TVA%)
            if ligne.tva > 0:
                ht_ligne = (ttc_ligne / (1 + ligne.tva / 100)).quantize(Decimal('0.01'))
                tva_ligne = (ttc_ligne - ht_ligne).quantize(Decimal('0.01'))
            else:
                ht_ligne = ttc_ligne
                tva_ligne = Decimal('0.00')
            
            total_ht += ht_ligne
            total_tva += tva_ligne
        
        # Appliquer la remise sur le TTC
        remise = Decimal(str(self.remise))
        total_ttc_apres_remise = total_ttc_brut - remise
        
        # Recalculer HT et TVA proportionnellement après remise
        if total_ttc_brut > 0:
            ratio_remise = total_ttc_apres_remise / total_ttc_brut
            total_ht = (total_ht * ratio_remise).quantize(Decimal('0.01'))
            total_tva = (total_tva * ratio_remise).quantize(Decimal('0.01'))
        
        # Totaux finaux
        self.total_ht = total_ht
        self.total_tva = total_tva
        self.total_ttc = total_ttc_apres_remise
        
        # Calcul de la Part Client (Split Billing)
        # Si le client a une couverture (ex: 70%), la part client est le reste (30%)
        # Sinon, part client = 100% du TTC
        if self.client and self.client.taux_couverture > 0:
            taux_assurance = self.client.taux_couverture
            taux_client = Decimal('100.00') - taux_assurance
            # Protection contre taux incohérents
            if taux_client < 0: taux_client = Decimal('0.00')
            
            self.part_client = (self.total_ttc * taux_client / Decimal('100.00')).quantize(Decimal('0.01'))
        else:
            self.part_client = self.total_ttc

        if save:
            # On update uniquement les champs de totaux pour éviter de déclencher des signaux récursifs inutiles
            # ou d'écraser d'autres changements concurrents
            self.save(update_fields=['total_ht', 'total_tva', 'total_ttc', 'part_client'])


    class Meta:
        indexes = [
            # Index sur status pour les filtres fréquents (dashboard, listes)
            models.Index(fields=['status']),
            # Index composite pour les requêtes par client et status
            models.Index(fields=['client', 'status']),
            # Index sur date pour les tris et filtres par date
            models.Index(fields=['-date']),  # Descending pour les listes récentes
        ]


class LotSequence(models.Model):
    """
    Modèle pour gérer la séquence atomique des numéros de lot.
    Singleton : une seule instance (id=1) stocke le dernier numéro utilisé.
    Utilisé par generate_lot_number() pour générer des numéros de lot uniques de manière atomique.
    """
    id = models.IntegerField(primary_key=True, default=1)
    last_number = models.IntegerField(default=0, help_text="Dernier numéro de séquence utilisé")
    
    class Meta:
        db_table = 'lot_sequence'
    
    def __str__(self):
        return f"Lot Sequence: {self.last_number}"


def generate_lot_number():
    """
    Génère un numéro de lot unique au format L01
    Utilise Redis (cache) pour éviter le verrouillage global de la base de données (select_for_update).
    Si le cache est vide (redémarrage), il s'initialise depuis la dernière entrée StockLot.
    """
    CACHE_KEY = 'lot_sequence'
    
    try:
        # Essayer d'incrémenter atomiquement via Redis
        sequence = cache.incr(CACHE_KEY)
    except ValueError:
        # La clé n'existe pas, initialisation depuis la DB (Recovery)
        # On cherche le dernier lot créé dans StockLot
        last_number = 0
        
        # 1. Vérifier StockLot (Source de vérité principale)
        # On utilise 'created_at' car l'ID peut être désynchronisé (ex: import données)
        last_stock = StockLot.objects.order_by('-created_at', '-id').first()
        
        if last_stock and last_stock.lot and last_stock.lot.startswith('L'):
            try:
                last_number = int(last_stock.lot[1:])
            except ValueError:
                pass
                
        # 2. Vérifier LotSequence (Fallback historique)
        try:
            seq_obj = LotSequence.objects.get(id=1)
            if seq_obj.last_number > last_number:
                last_number = seq_obj.last_number
        except LotSequence.DoesNotExist:
            pass
            
        # 3. Initialiser le cache
        cache.set(CACHE_KEY, last_number, timeout=None)
        
        # 4. Incrémenter
        sequence = cache.incr(CACHE_KEY)
        
        # On met à jour LotSequence uniquement lors de la récupération pour garder une trace approximative
        # mais PAS à chaque génération pour éviter le lock
        LotSequence.objects.update_or_create(id=1, defaults={'last_number': sequence})

    return f'L{sequence:02d}'


class StockLot(models.Model):
    """
    Représente un lot de stock reçu d'un fournisseur.
    Permet la traçabilité FIFO et le calcul du CA par fournisseur.
    """
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_lots')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    commande_produit = models.ForeignKey('CommandeProduit', on_delete=models.CASCADE, related_name='stock_lot', null=True, blank=True, help_text="Référence à la ligne de commande (si applicable)")
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegardé")
    quantity_initial = models.IntegerField(help_text="Quantité totale initiale (payée + gratuites)")
    quantity_paid = models.IntegerField(default=0, help_text="Quantité payée uniquement")
    quantity_free = models.IntegerField(default=0, help_text="Unités gratuites (UG)")
    quantity_remaining = models.IntegerField(help_text="Quantité restante dans le lot")
    price_cost = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix d'achat unitaire effectif (ajusté avec UG)")
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Prix de vente lors de la réception") # NEW
    lot = models.CharField(max_length=20, blank=True, null=True, db_index=True, help_text="Numéro de lot auto-généré ou manuel")
    date_expiration = models.DateField(blank=True, null=True)
    date_reception = models.DateTimeField(help_text="Date de réception du lot (pour FIFO)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date_reception']  # FIFO: Premier arrivé, premier servi
        indexes = [
            models.Index(fields=['produit', 'date_reception']),
            models.Index(fields=['produit', 'quantity_remaining']),
        ]
        # Contrainte unique sur la combinaison (produit, lot) pour permettre le même lot sur différents produits
        constraints = [
            models.UniqueConstraint(
                fields=['produit', 'lot'],
                condition=models.Q(lot__isnull=False),
                name='unique_produit_lot'
            )
        ]

    def __str__(self):
        ug_info = f" dont {self.quantity_free} UG" if self.quantity_free > 0 else ""
        return f"Lot {self.id} - {self.produit.name} ({self.quantity_remaining}/{self.quantity_initial}{ug_info})"


# Signal pour auto-génération de numéro de lot
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver

@receiver(pre_save, sender=StockLot)
def auto_generate_lot_number(sender, instance, **kwargs):
    """
    Génère automatiquement un numéro de lot si non fourni.
    """
    if not instance.lot:
        instance.lot = generate_lot_number()


@receiver(post_save, sender=StockLot)
def sync_product_stock_on_lot_save(sender, instance, created, **kwargs):
    """
    Synchronise le stock du produit quand un lot est créé ou modifié.
    Uniquement pour les produits avec use_lot_management=True.
    
    OPTIMISATION: Pour les modifications, on calcule le delta au lieu de tout recalculer.
    Pour les créations, on doit recalculer car on ne connaît pas l'ancien état.
    """
    if instance.produit and instance.produit.use_lot_management:
        # Pour les créations, on doit recalculer car on n'a pas l'ancienne valeur
        if created:
            from django.db.models import Sum
            total = instance.produit.stock_lots.aggregate(
                Sum('quantity_remaining')
            )['quantity_remaining__sum'] or 0
            
            if instance.produit.stock != total:
                Produit.objects.filter(pk=instance.produit.pk).update(stock=total)
        else:
            # Pour les modifications, utiliser le delta si possible
            # Note: Django ne fournit pas toujours l'ancienne instance dans post_save
            # On recalcule pour être sûr de la cohérence (trade-off performance vs exactitude)
            # TODO: Utiliser pre_save pour capturer l'ancienne valeur et calculer le delta
            from django.db.models import Sum
            total = instance.produit.stock_lots.aggregate(
                Sum('quantity_remaining')
            )['quantity_remaining__sum'] or 0
            
            if instance.produit.stock != total:
                Produit.objects.filter(pk=instance.produit.pk).update(stock=total)


@receiver(post_delete, sender=StockLot)
def sync_product_stock_on_lot_delete(sender, instance, **kwargs):
    """
    Synchronise le stock du produit quand un lot est supprimé.
    Uniquement pour les produits avec use_lot_management=True.
    """
    if instance.produit and instance.produit.use_lot_management:
        from django.db.models import Sum
        total = instance.produit.stock_lots.aggregate(
            Sum('quantity_remaining')
        )['quantity_remaining__sum'] or 0
        
        Produit.objects.filter(pk=instance.produit.pk).update(stock=total)


class FactureProduit(models.Model):
    """Model representing a product in an invoice."""
    id = models.AutoField(primary_key=True)
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField()
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Montant de la remise unitaire") # NEW
    tva = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.00,
        help_text="TVA applicable à cette ligne (copiée du produit lors de la création)"
    )
    lot = models.CharField(max_length=20, blank=True, null=True)
    stock_lot = models.ForeignKey(StockLot, on_delete=models.SET_NULL, null=True, blank=True, help_text="Lot spécifique choisi manuellement") # NEW
    date_expiration = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ligne de facture {self.id}"

    class Meta:
        indexes = [
            # Index sur produit pour les joins fréquents (history, stats)
            models.Index(fields=['produit']),
            # Index composite pour les requêtes par facture et produit
            models.Index(fields=['facture', 'produit']),
        ]


# Signal pour copier automatiquement la TVA du produit vers la ligne de facture
@receiver(pre_save, sender=FactureProduit)
def copy_tva_from_product(sender, instance, **kwargs):
    """
    Copie automatiquement la TVA du produit vers la ligne de facture lors de la création.
    Si la TVA de la ligne est 0 et que le produit a une TVA, on la copie.
    """
    if instance.produit and instance.tva == Decimal('0.00'):
        instance.tva = instance.produit.tva



class RelevePaiement(models.Model):
    """
    Regroupe plusieurs paiements de factures effectués en une seule opération (bulk).
    Permet d'afficher une ligne unique dans le journal de caisse tout en gardant le détail.
    """
    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='releves')
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=50, unique=True, help_text="Ex: REL-20231212-001")

    def __str__(self):
        return f"Relevé {self.reference} - {self.client.name} ({self.total_amount})"

    class Meta:
        ordering = ['-created_at']


class Caisse(models.Model):
    MODES_PAIEMENT = [
        ('especes', 'Espèces'),
        ('cheque', 'Chèque'),
        ('carte', 'Carte'),
        ('virement', 'Virement'),
        ('om', 'Orange Money'),
        ('momo', 'Mobile Money'),
        ('en_compte', 'En compte'),
    ]
    
    STATUTS = [
        ('en_attente', 'En attente'),
        ('completee', 'Complétée'),
        ('annulee', 'Annulée'),
    ]
    
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name='paiements')
    mode_paiement = models.CharField(max_length=20, choices=MODES_PAIEMENT)
    montant = models.DecimalField(max_digits=10, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True, null=True)
    statut = models.CharField(max_length=20, choices=STATUTS, default='en_attente')
    date_paiement = models.DateTimeField(auto_now_add=True)
    date_paiement = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name='transactions_caisse')
    releve = models.ForeignKey(RelevePaiement, on_delete=models.SET_NULL, null=True, blank=True, related_name='paiements_caisse')
    # Champs pour tiers payant
    part_patient = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Part payée par le patient (tiers payant)")
    part_assurance = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Part prise en charge par l'assurance")
    
    def __str__(self):
        return f"Paiement {self.id} - {self.montant} F - {self.get_mode_paiement_display()}"
    
    class Meta:
        ordering = ['-date_paiement']
        indexes = [
            # Index sur statut pour les filtres fréquents (get_totals, cloturer)
            models.Index(fields=['statut']),
            # Index composite pour les filtres par facture et statut
            models.Index(fields=['facture', 'statut']),
            # Index sur date_paiement pour les tris
            models.Index(fields=['-date_paiement']),
        ]

@receiver(post_save, sender=Caisse)
def handle_caisse_post_save(sender, instance, created, **kwargs):
    """
    Logique métier après enregistrement d'un règlement :
    1. Marquage Tiers Payant (Part Patient) pour le ticket.
    2. Split Billing (Génération automatique du crédit assurance).
    3. Mise à jour du statut de la facture vers PAYEE.
    """
    if instance.statut != 'completee':
        return

    facture = instance.facture
    
    # 1. Marquage Tiers Payant (Part Patient)
    # Si la facture a une part_client définie, on marque tout paiement réel comme 'Part Patient'
    if facture.part_client is not None and instance.mode_paiement != 'en_compte':
        if not instance.part_patient and (instance.part_assurance is None or instance.part_assurance == 0):
            # Utilisation de .update() pour ne pas redéclencher le signal post_save
            Caisse.objects.filter(id=instance.id).update(
                part_patient=instance.montant,
                part_assurance=Decimal('0.00')
            )

    # 2. Split Billing (Génération automatique de la créance)
    # Si le montant cumulé payé par le client atteint sa part_client, on bascule le reste en crédit.
    if created and facture.part_client is not None and instance.mode_paiement != 'en_compte':
        paiements_reels = Caisse.objects.filter(
            facture=facture, 
            statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0')
        
        if paiements_reels >= facture.part_client:
            reste_a_couvrir = facture.total_ttc - paiements_reels
            if reste_a_couvrir > Decimal('1.00'):
                # Vérifier si on a déjà généré un crédit automatique pour cette facture
                deja_traite = Caisse.objects.filter(
                    facture=facture, 
                    mode_paiement='en_compte',
                    reference__startswith='AUTO-CREDIT'
                ).exists()
                
                if not deja_traite:
                    # Création du paiement 'En Compte' pour le solde (Part Assurance)
                    Caisse.objects.create(
                        facture=facture,
                        mode_paiement='en_compte',
                        montant=reste_a_couvrir,
                        user=instance.user,
                        statut='completee',
                        reference=f"AUTO-CREDIT-{facture.numero_facture or facture.id}",
                        part_assurance=reste_a_couvrir,
                        part_patient=Decimal('0.00')
                    )

    # 3. Mise à jour du statut de la facture
    # Si le total des règlements (Cash + Crédit) couvre le montant TTC, la facture est payée.
    if facture.status not in [Facture.Status.ANNULEE, Facture.Status.PAYEE]:
        total_encaisse = Caisse.objects.filter(
            facture=facture, 
            statut='completee'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        if total_encaisse >= facture.total_ttc:
            facture.status = Facture.Status.PAYEE
            facture.save(update_fields=['status'])



class FactureProduitAllocation(models.Model):
    """
    Traçabilité: enregistre quelle part d'une vente provient de quel lot.
    Permet de calculer la marge et le CA par fournisseur.
    """
    facture_produit = models.ForeignKey('FactureProduit', on_delete=models.CASCADE, related_name='allocations')
    stock_lot = models.ForeignKey('StockLot', on_delete=models.PROTECT)
    quantity = models.IntegerField(help_text="Quantité prélevée de ce lot")
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix d'achat du lot")
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix de vente")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Allocation {self.id} - {self.quantity} unités du lot {self.stock_lot.id}"
    
    @property
    def margin(self):
        """Calcule la marge brute pour cette allocation"""
        return (self.selling_price - self.cost_price) * self.quantity
    
    @property
    def revenue(self):
        """Calcule le CA pour cette allocation"""
        return self.selling_price * self.quantity





class ActivityLog(models.Model):
    """
    Log des actions critiques pour l'audit.
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50) # ex: 'CANCEL_INVOICE', 'DELETE_PRODUCT', 'UPDATE_PERMISSIONS'
    target_model = models.CharField(max_length=50, blank=True, null=True)
    target_id = models.CharField(max_length=50, blank=True, null=True) # CharField to be generic
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action}"


class Inventaire(models.Model):
    class Status(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        VALIDEE = 'VALIDEE', 'Validée'

    date = models.DateTimeField(default=timezone.now)
    description = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_COURS)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Inventaire du {self.date.strftime('%d/%m/%Y')}"

class LigneInventaire(models.Model):
    inventaire = models.ForeignKey(Inventaire, on_delete=models.CASCADE, related_name='lignes')
    produit = models.ForeignKey(Produit, on_delete=models.SET_NULL, null=True, blank=True)  # SET_NULL pour permettre suppression
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    stock_lot = models.ForeignKey(
        'StockLot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventaires',
        help_text="Lot spécifique compté (si inventaire par lot)"
    )
    stock_theorique = models.IntegerField(help_text="Stock au moment de l'ajout dans l'inventaire")
    quantite_physique = models.IntegerField(default=0)
    ecart = models.IntegerField(default=0, editable=False)
    pmp_snapshot = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['inventaire', 'stock_lot'],
                condition=models.Q(stock_lot__isnull=False),
                name='unique_inventaire_lot'
            )
        ]
    
    def save(self, *args, **kwargs):
        self.ecart = self.quantite_physique - self.stock_theorique
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.produit.name} : {self.quantite_physique} (Th: {self.stock_theorique})"
    
    @property
    def lot_numero(self):
        """Retourne le numéro du lot si disponible"""
        return self.stock_lot.lot if self.stock_lot else None
    
    @property
    def lot_expiration(self):
        """Retourne la date d'expiration du lot si disponible"""
        return self.stock_lot.date_expiration if self.stock_lot else None

class MouvementCaisse(models.Model):
    """
    Modèle pour les entrées et sorties de caisse spéciales (hors ventes).
    Ex: Paiement facture électricité, Achat carburant, Entrée fonds de caisse...
    """
    TYPE_CHOICES = [
        ('ENTREE', 'Entrée'),
        ('SORTIE', 'Sortie'),
    ]
    
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    motif = models.CharField(max_length=200, help_text="Ex: Electricité, Carburant, etc.")
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mouvements_caisse')
    
    class Meta:
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.type} - {self.montant} ({self.motif})"

class Avoir(models.Model):
    """
    Modèle pour les retours fournisseurs (Avoirs).
    Retire du stock contrairement aux Commandes qui en ajoutent.
    """
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
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True, related_name='avoirs')
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegardé")
    type_avoir = models.CharField(max_length=20, choices=TYPE_CHOICES, default='AUTRE')
    date = models.DateField(default=date.today)
    observations = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='BROUILLON')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='avoirs_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Avoir fournisseur'
        verbose_name_plural = 'Avoirs fournisseurs'
    
    def __str__(self):
        return f"{self.numero} - {self.fournisseur.name if self.fournisseur else 'N/A'}"
    
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
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)  # SET_NULL pour permettre suppression
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
    
    class Meta:
        verbose_name = "Ligne d'avoir"
        verbose_name_plural = "Lignes d'avoir"
    
    def __str__(self):
        return f"{self.produit.name} x {self.quantity}"
    
    @property
    def total(self):
        """Calcule le total de la ligne"""
        return self.quantity * self.price
    
    @property
    def produit_nom(self):
        return self.produit.name if self.produit else ''
    
    @property
    def produit_cip(self):
        return self.produit.cip1 if self.produit else ''


class MouvementStock(models.Model):
    """
    Historique de tous les mouvements de stock (Entrées, Sorties, Ajustements, Transformations)
    Permet de reconstruire l'état du stock à une date donnée et d'analyser les flux.
    """
    class TypeMouvement(models.TextChoices):
        ENTREE = 'ENTREE', 'Entrée (Commande)'
        SORTIE = 'SORTIE', 'Sortie (Vente)'
        RETOUR = 'RETOUR', 'Retour (Annulation)'
        AJUSTEMENT = 'AJUSTEMENT', 'Ajustement Inventaire'
        TRANSFORMATION_ENTREE = 'TRANSFORMATION_ENTREE', 'Transformation (Entrée)'
        TRANSFORMATION_SORTIE = 'TRANSFORMATION_SORTIE', 'Transformation (Sortie)'

    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='mouvements_stock')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
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
        return f"{self.date} - {self.produit.name} - {self.type_mouvement} ({self.quantite})"


class RelationTransformation(models.Model):
    """
    Définit la relation de transformation entre deux produits.
    Exemple: 1 boîte PARACETAMOL (produit_source) = 20 détails PARACETAMOL (produit_destination)
    """
    produit_source = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='transformations_source',
        help_text="Produit à transformer (ex: BOITE)"
    )
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='transformations_destination',
        help_text="Produit résultant (ex: DETAIL)"
    )
    ratio = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Ratio de conversion (ex: 20.00 si 1 boîte = 20 détails)"
    )
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['produit_source', 'produit_destination']
        verbose_name = "Relation de transformation"
        verbose_name_plural = "Relations de transformation"
    
    def __str__(self):
        return f"{self.produit_source.name} -> {self.produit_destination.name} (x{self.ratio})"


class HistoriqueTransformation(models.Model):
    """
    Historique des transformations effectuées.
    Trace chaque opération de déconditionnement/reconditionnement.
    """
    relation = models.ForeignKey(
        RelationTransformation, 
        on_delete=models.CASCADE,
        related_name='historique'
    )
    produit_source = models.ForeignKey(
        'Produit', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hist_trans_source'
    )
    produit_source_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit source sauvegardé")
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hist_trans_dest'
    )
    produit_destination_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit destination sauvegardé")
    quantite_source = models.IntegerField(help_text="Quantité transformée (source)")
    quantite_destination = models.IntegerField(help_text="Quantité obtenue (destination)")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_transformation = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-date_transformation']
        verbose_name = "Historique de transformation"
        verbose_name_plural = "Historiques de transformations"
    
    def __str__(self):
        return f"{self.quantite_source} {self.produit_source.name} -> {self.quantite_destination} {self.produit_destination.name}"
class InvoiceSettings(models.Model):
    """
    Singleton model to store invoice configuration.
    """
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
    primary_color = models.CharField(max_length=7, default="#000000") # Hex code
    centralized_cash_register = models.BooleanField(default=False, help_text="Activer le mode Caisse Centralisée")

    def save(self, *args, **kwargs):
        # Singleton logic: ensure only one instance exists
        if not self.pk and InvoiceSettings.objects.exists():
            # If trying to create a new one, update the existing one instead
            return InvoiceSettings.objects.first()
        return super(InvoiceSettings, self).save(*args, **kwargs)

    def __str__(self):
        return "Invoice Configuration"

class AuditLog(models.Model):
    """Model representing an audit log entry for tracking detailed user actions."""
    class Action(models.TextChoices):
        # Actions génériques CRUD
        CREATE = 'CREATE', 'Création'
        UPDATE = 'UPDATE', 'Modification'
        DELETE = 'DELETE', 'Suppression'
        LOGIN = 'LOGIN', 'Connexion'
        EXPORT = 'EXPORT', 'Export'
        OTHER = 'OTHER', 'Autre'
        # Actions métier explicites
        STOCK_ADJUST = 'STOCK_ADJ', 'Ajustement stock'
        PRICE_CHANGE = 'PRICE_CHG', 'Changement prix'
        CLOTURE_CAISSE = 'CLOTURE', 'Clôture caisse'
        INVOICE_CANCEL = 'INV_CANCEL', 'Annulation facture'
        INVOICE_DELETE = 'INV_DEL', 'Suppression facture'
        INVOICE_VALIDATE = 'INV_VALID', 'Validation facture'
        INVENTORY_CREATE = 'INV_CRE', 'Création inventaire'
        INVENTORY_VALIDATE = 'INV_VAL', 'Validation inventaire'

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=10, choices=Action.choices)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, default='', help_text="Description lisible de l'action")
    details = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.action} {self.model_name} at {self.timestamp}"


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
    
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustments')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    stock_lot = models.ForeignKey('StockLot', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    quantity_before = models.IntegerField(help_text="Stock avant ajustement")
    quantity_after = models.IntegerField(help_text="Stock après ajustement")
    quantity_change = models.IntegerField(help_text="Différence (+/-)")
    
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
        return f"{self.produit.name}: {self.quantity_change:+d} ({self.get_reason_type_display()})"


class Promis(models.Model):
    """
    Model representing a product promised to a client.
    Used when a client pays for a product that is not in stock or has insufficient stock.
    The product will be delivered later when available.
    """
    class Status(models.TextChoices):
        EN_ATTENTE = 'ATT', 'En attente'
        DELIVRE = 'DEL', 'Délivré'
        ANNULE = 'ANN', 'Annulé'

    facture = models.ForeignKey('Facture', on_delete=models.SET_NULL, related_name='promis', null=True, blank=True)
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='promis')
    client_name = models.CharField(max_length=100, blank=True, help_text="Nom du client (pour clients de passage)")
    client_phone = models.CharField(max_length=20, blank=True, help_text="Téléphone du client")
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='promis')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    quantite = models.IntegerField(help_text="Quantité promise au client")
    status = models.CharField(max_length=4, choices=Status.choices, default=Status.EN_ATTENTE)
    date_promis = models.DateTimeField(auto_now_add=True, help_text="Date de la promesse")
    date_livraison = models.DateTimeField(null=True, blank=True, help_text="Date de livraison effective")
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-date_promis']
        verbose_name = 'Promis'
        verbose_name_plural = 'Promis'

    def __str__(self):
        client_display = self.client.name if self.client else self.client_name or 'Client inconnu'
        return f"Promis #{self.id} - {self.produit.name} x{self.quantite} pour {client_display}"

    @property
    def client_display(self):
        """Returns the client name from either the linked client or the manual entry."""
        if self.client:
            return self.client.name
        return self.client_name or 'Client de passage'

    @property
    def client_phone_display(self):
        """Returns the client phone from either the linked client or the manual entry."""
        if self.client:
            return self.client.phone
        return self.client_phone or ''

    @property
    def produit_name(self):
        return self.produit.name if self.produit else ''




# Signaux pour mise à jour automatique des totaux de Facture
# Placés ici car FactureProduit doit être défini
@receiver(post_save, sender=FactureProduit)
@receiver(post_delete, sender=FactureProduit)
def update_facture_totals_on_line_change(sender, instance, **kwargs):
    if instance.facture:
        instance.facture.calculate_totals()

@receiver(post_save, sender=Facture)
def update_facture_totals_on_change(sender, instance, created, **kwargs):
    # Eviter récursion infinie si le save vient de calculate_totals
    update_fields = kwargs.get('update_fields')
    if update_fields and ('total_ht' in update_fields or 'total_ttc' in update_fields):
        return

    if not created:
         instance.calculate_totals(save=True)


class ClotureCaisse(models.Model):
    """Model representing a cash register closure (clôture de caisse)."""
    date = models.DateTimeField(default=timezone.now)
    montant_reel = models.DecimalField(max_digits=12, decimal_places=2, help_text="Montant réellement compté en caisse")
    montant_theorique = models.DecimalField(max_digits=12, decimal_places=2, help_text="Montant théorique calculé")
    ecart_caisse = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Écart entre réel et théorique")
    
    # Détails
    total_ventes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_entrees = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Entrées de caisse hors ventes")
    total_sorties = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Sorties de caisse")
    details_paiement = models.JSONField(default=dict, blank=True, help_text="Détails par mode de paiement")
    
    # Période couverte
    date_debut = models.DateTimeField(null=True, blank=True, help_text="Début de la période de clôture")
    date_fin = models.DateTimeField(null=True, blank=True, help_text="Fin de la période de clôture")
    
    # Caissier
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='clotures_caisse')
    observation = models.TextField(blank=True, null=True, help_text="Notes ou observations sur la clôture")
    
    class Meta:
        ordering = ['-date']
        verbose_name = "Clôture de caisse"
        verbose_name_plural = "Clôtures de caisse"
    
    def __str__(self):
        return f"Clôture du {self.date.strftime('%d/%m/%Y %H:%M')} - Écart: {self.ecart_caisse} F"


class Ordonnancier(models.Model):
    """Registre des médicaments délivrés sur ordonnance (ordonnancier de la pharmacie)."""
    numero_ordre = models.AutoField(primary_key=True)  # Numéro chronologique
    date_delivrance = models.DateTimeField(default=timezone.now)
    
    # Patient
    patient_nom = models.CharField(max_length=200, help_text="Nom du patient")
    
    # Prescripteur
    prescripteur_nom = models.CharField(max_length=200, help_text="Nom du médecin prescripteur")
    
    # Lien avec la facture
    facture = models.ForeignKey('Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='ordonnancier_entries')
    
    # Utilisateur qui a enregistré
    enregistre_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='ordonnancier_entries')
    
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
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, related_name='ordonnancier_lignes')
    produit_nom = models.CharField(max_length=200, help_text="Copie du nom pour historique")
    quantite = models.IntegerField()
    
    # Catégorie de surveillance (copie pour historique)
    surveillance_category = models.CharField(max_length=20, default='NONE')
    
    class Meta:
        verbose_name = "Ligne Ordonnancier"
        verbose_name_plural = "Lignes Ordonnancier"
    
    def __str__(self):
        return f"{self.produit_nom} x{self.quantite}"


#
# SIGNAUX POUR SUPPRESSION DOUCE (SOFT DELETE)
#
@receiver(pre_delete, sender=Produit)
def preserve_product_name_on_delete(sender, instance, **kwargs):
    """
    Avant la suppression d'un produit, on sauvegarde son nom 
    dans les modèles liés qui ont un champ produit_nom.
    """
    if not instance.pk:
        return
        
    nom = instance.name
    
    # Modèles liés (via related_names et sets implicites)
    # Note: On utilise update() pour une requête SQL unique efficace
    
    try:
        instance.factureproduit_set.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.commandeproduit_set.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.stock_lots.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.mouvements_stock.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.adjustments.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.promis.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.hist_trans_source.all().update(produit_source_nom=nom)
    except: pass
    
    try:
        instance.hist_trans_dest.all().update(produit_destination_nom=nom)
    except: pass
    
    try:
        instance.ordonnancier_lignes.all().update(produit_nom=nom)
    except: pass
    
    # Modèles sans related_name explicite (utilise modelname_set)
    try:
        instance.ligneinventaire_set.all().update(produit_nom=nom)
    except: pass
    
    try:
        instance.ligneavoir_set.all().update(produit_nom=nom)
    except: pass


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
    except: pass
    
    try:
        instance.stocklot_set.all().update(fournisseur_nom=nom)
    except: pass
    
    try:
        instance.avoirs.all().update(fournisseur_nom=nom)
    except: pass
