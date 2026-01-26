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
    can_cash_out = models.BooleanField(default=True, help_text="Autoris├® ├á encaisser (si mode centralis├® actif)")
    
    # Granular Permissions
    can_delete_product = models.BooleanField(default=False, verbose_name="Supprimer des produits")
    can_adjust_stock = models.BooleanField(default=False, verbose_name="Ajuster le stock manuellement")
    can_delete_fournisseur = models.BooleanField(default=False, verbose_name="Supprimer des fournisseurs")
    can_delete_commande = models.BooleanField(default=False, verbose_name="Supprimer des commandes")
    can_close_commande = models.BooleanField(default=False, verbose_name="Clôturer des commandes")
    can_generate_coupon = models.BooleanField(default=False, verbose_name="Générer des coupons")

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
    """Configuration du syst├¿me de fid├®lit├® (Singleton)"""
    amount_per_point = models.DecimalField(max_digits=10, decimal_places=0, default=1000, help_text="Montant en FCFA pour gagner 1 point")
    point_value = models.DecimalField(max_digits=10, decimal_places=0, default=10, help_text="Valeur d'un point en FCFA")
    auto_reward_threshold = models.IntegerField(default=0, help_text="Nombre de points pour d├®clencher la r├®compense auto (0=d├®sactiv├®)")
    auto_reward_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Pourcentage de remise auto")

    class Meta:
        verbose_name = "Configuration Fid├®lit├®"
        verbose_name_plural = "Configuration Fid├®lit├®"

    def save(self, *args, **kwargs):
        self.pk = 1 # Singleton
        super(LoyaltySetting, self).save(*args, **kwargs)
        
    def __str__(self):
        return "Configuration Fid├®lit├®"


class PharmacySettings(models.Model):
    """Configuration de la pharmacie (Singleton) - Nom, Adresse, T├®l├®phone, etc."""
    pharmacy_name = models.CharField(max_length=200, default="PHARMA STOCK")
    address = models.CharField(max_length=300, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="Douala")
    country = models.CharField(max_length=100, blank=True, default="Cameroun")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    niu = models.CharField(max_length=15, blank=True, default="", help_text="Num├®ro d'Identification Unique (14-15 caract├¿res)")
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
        verbose_name = "Param├¿tres Pharmacie"
        verbose_name_plural = "Param├¿tres Pharmacie"
    
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
        message="Le num├®ro de t├®l├®phone doit ├¬tre au format: '+999999999'. Jusqu'├á 15 chiffres autoris├®s."
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
        message="Le num├®ro de t├®l├®phone doit ├¬tre au format: '+999999999'. Jusqu'├á 15 chiffres autoris├®s."
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
        help_text="Pourcentage de remise automatique (0-100%) appliqu├® ├á chaque vente",
        verbose_name="Remise automatique (%)"
    )
    
    points_fidelite = models.IntegerField(default=0)
    pending_discount = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Remise en % acquise pour la prochaine vente")
    is_loyalty_member = models.BooleanField(default=True, help_text="Si activ├®, ce client participe au programme de fid├®lit├®")

    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name

    @property
    def current_debt(self):
        """
        Calcule la dette actuelle du client.
        Somme des restes ├á payer sur les factures VALIDEE.
        Optimis├® pour utiliser l'annotation du ViewSet ou une agr├®gation unique.
        """
        # 1. Check if annotated by ViewSet (Zero SQL queries)
        if hasattr(self, 'current_debt_annotated'):
            return self.current_debt_annotated or Decimal('0.00')

        # 2. Fallback: Aggregate in database (One SQL query instead of loop)
        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce
        
        # On calcule la dette pour chaque facture et on somme
        # Note: L'agr├®gation directe sur self.facture_set est complexe car il faut faire la diff├®rence (TTC - Paiements)
        # Et ne garder que les positifs.
        
        # On replique la logique du ViewSet mais pour une instance unique
        # C'est moins grave de faire une requ├¬te ici car c'est pour un seul client
        
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
        EN_PREPARATION = 'PREP', 'En pr├®paration'
        EN_ATTENTE = 'ATT', 'En attente'
        CLOTUREE = 'CLOT', 'Cl├┤tur├®e'
    
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
    # Coefficient global appliqu├® ├á la commande (Snapshot de PharmacySettings au moment de la cr├®ation)
    frais_coefficient = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    
    # On utilise PROTECT pour ├®viter de supprimer des commandes si un fournisseur est effac├®.
    # Nullable pour permettre les commandes de r├®assort global (sans fournisseur initial)
    fournisseur = models.ForeignKey(Fournisseur, on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegard├®")
    numero_facture = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    date_cloture = models.DateTimeField(null=True, blank=True, verbose_name="Date de cl├┤ture")
    status = models.CharField(
        max_length=4,
        choices=Status.choices,
        default=Status.EN_PREPARATION,
    )
    # Le champ 'total' est retir├® de la base de donn├®es.

    def __str__(self):
        return f"Commande {self.id}"
    
    @property
    def total(self):
        """Calcule le total de la commande en utilisant une agr├®gation de la base de donn├®es."""
        total_value = self.produits.aggregate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        )['total']
        return total_value or "0.00"

class CommandeProduit(models.Model):
    """Model representing a product in an order."""
    id = models.AutoField(primary_key=True)
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField(help_text="Quantit├® command├®e et pay├®e")
    unites_gratuites = models.IntegerField(default=0, help_text="Unit├®s gratuites re├ºues (ex: promotion 3+1)")
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
        """Quantit├® totale re├ºue (pay├®e + gratuites)"""
        return self.quantity + self.unites_gratuites
    
    @property
    def effective_cost(self):
        """Co├╗t unitaire effectif incluant les UG"""
        total_qty = self.total_quantity
        if total_qty > 0:
            return (self.quantity * self.price_cost) / total_qty
        return self.price_cost
    


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

class Produit(models.Model):
    """Model representing a product."""
    id = models.AutoField(primary_key=True)
    rayon = models.ForeignKey('Rayon', on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True)
    forme = models.ForeignKey('Forme', on_delete=models.SET_NULL, null=True, blank=True, related_name='produits')
    groupe = models.ForeignKey('Groupe', on_delete=models.SET_NULL, null=True, blank=True, related_name='produits')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    stock = models.IntegerField()
    use_lot_management = models.BooleanField(
        default=True,
        help_text="Activer la gestion par lots FIFO pour ce produit (recommand├® pour tra├ºabilit├®)"
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
    pmp = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Prix Moyen Pond├®r├®")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Ordonnancier - Champs pour identifier les m├®dicaments soumis ├á ordonnance
    requires_prescription = models.BooleanField(
        default=False,
        help_text="Ce produit n├®cessite une ordonnance"
    )
    
    SURVEILLANCE_CHOICES = [
        ('NONE', 'Aucune'),
        ('STANDARD', 'Surveillance standard'),
        ('RENFORCEE', 'Surveillance renforc├®e'),
    ]
    surveillance_category = models.CharField(
        max_length=20, 
        choices=SURVEILLANCE_CHOICES, 
        default='NONE',
        help_text="Cat├®gorie de surveillance du m├®dicament"
    )
    
    # Dates de derni├¿re transaction
    dernier_achat = models.DateField(
        blank=True, 
        null=True,
        help_text="Date du dernier achat (r├®ception de commande)"
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
        Calcule et met ├á jour le stock du produit bas├® sur la somme
        des quantit├®s restantes de tous ses lots.
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
            # Index sur stock pour les requ├¬tes stock__lte, stock__gte, etc.
            models.Index(fields=['stock']),
            # Index composite pour les recherches par rayon et stock
            models.Index(fields=['rayon', 'stock']),
            # Index pour les recherches par fournisseur
            models.Index(fields=['fournisseur']),
            # Index pour les recherches de produits ├á faible stock
            models.Index(fields=['stock', 'stock_minimum']),
        ]


class Facture(models.Model):
    """Model representing a sales invoice."""
    class Status(models.TextChoices):
        BROUILLON = 'BROU', 'Brouillon'
        PROFORMA = 'PROF', 'Proforma'
        VALIDEE = 'VAL', 'Valid├®e'
        PAYEE = 'PAY', 'Pay├®e'
        ANNULEE = 'ANN', 'Annul├®e'

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

    part_client = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Part ├á payer par le client (Tiers Payant)")
    
    # Suivi de l'op├®rateur (Vendeur)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='factures_created', help_text="Utilisateur qui a cr├®├® la facture")

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
        
        # Calcul Total TTC (somme des prix de vente qui incluent d├®j├á la TVA)
        aggregated = self.produits.aggregate(
            total=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )
        total_ttc_brut = aggregated['total'] or Decimal('0.00')
        
        # Calcul HT et TVA ligne par ligne (extraction de la TVA depuis le TTC)
        total_ht = Decimal('0.00')
        total_tva = Decimal('0.00')
        
        for ligne in self.produits.all():
            # TTC de la ligne (prix de vente qui inclut d├®j├á la TVA)
            ttc_ligne = ligne.quantity * ligne.selling_price
            
            # Calculer HT ├á partir du TTC : HT = TTC / (1 + TVA%)
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
        
        # Recalculer HT et TVA proportionnellement apr├¿s remise
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
            # Protection contre taux incoh├®rents
            if taux_client < 0: taux_client = Decimal('0.00')
            
            self.part_client = (self.total_ttc * taux_client / Decimal('100.00')).quantize(Decimal('0.01'))
        else:
            self.part_client = self.total_ttc

        if save:
            self.save(update_fields=['total_ht', 'total_tva', 'total_ttc', 'part_client'])

    def get_tva_analysis(self):
        """
        Calcule la répartition par taux de TVA.
        Retourne une liste de dict : [{'taux': 19.25, 'base_ht': ..., 'montant_tva': ...}, ...]
        Utilisé pour l'impression et les rapports.
        Prend en compte la remise globale qui s'applique sur le TTC.
        """
        from decimal import Decimal
        analysis = {}
        
        # 1. Calculer les totaux bruts par taux (avant remise globale)
        for ligne in self.produits.all():
            taux = ligne.tva
            if taux not in analysis:
                analysis[taux] = {'base_ht': Decimal('0.00'), 'montant_tva': Decimal('0.00')}
            
            # Prix unitaire TTC net de remise ligne
            # ligne.selling_price est TTC. ligne.discount est un montant TTC unitaire.
            pu_ttc_net = ligne.selling_price - ligne.discount
            total_ttc_ligne = pu_ttc_net * ligne.quantity
            
            # Extraction HT/TVA brute pour cette ligne (avant remise globale)
            if taux > 0:
                ht_ligne = (total_ttc_ligne / (1 + taux / Decimal('100.00'))).quantize(Decimal('0.01'))
                tva_ligne = total_ttc_ligne - ht_ligne
            else:
                ht_ligne = total_ttc_ligne
                tva_ligne = Decimal('0.00')
                
            analysis[taux]['base_ht'] += ht_ligne
            analysis[taux]['montant_tva'] += tva_ligne

        # 2. Appliquer la remise globale au prorata
        # Si une remise globale existe, elle réduit la base imposable et la TVA proportionnellement
        total_ttc_brut = sum(data['base_ht'] + data['montant_tva'] for data in analysis.values())
        
        if total_ttc_brut > 0 and self.remise > 0:
             # Le total TTC final est (Brut - Remise)
             total_ttc_net = total_ttc_brut - self.remise
             # Ratio de réduction
             ratio = total_ttc_net / total_ttc_brut
             
             for taux in analysis:
                 analysis[taux]['base_ht'] = (analysis[taux]['base_ht'] * ratio).quantize(Decimal('0.01'))
                 analysis[taux]['montant_tva'] = (analysis[taux]['montant_tva'] * ratio).quantize(Decimal('0.01'))

        return analysis


    class Meta:
        indexes = [
            # Index sur status pour les filtres fr├®quents (dashboard, listes)
            models.Index(fields=['status']),
            # Index composite pour les requ├¬tes par client et status
            models.Index(fields=['client', 'status']),
            # Index sur date pour les tris et filtres par date
            models.Index(fields=['-date']),  # Descending pour les listes r├®centes
        ]


class LotSequence(models.Model):
    """
    Mod├¿le pour g├®rer la s├®quence atomique des num├®ros de lot.
    Singleton : une seule instance (id=1) stocke le dernier num├®ro utilis├®.
    Utilis├® par generate_lot_number() pour g├®n├®rer des num├®ros de lot uniques de mani├¿re atomique.
    """
    id = models.IntegerField(primary_key=True, default=1)
    last_number = models.IntegerField(default=0, help_text="Dernier num├®ro de s├®quence utilis├®")
    
    class Meta:
        db_table = 'lot_sequence'
    
    def __str__(self):
        return f"Lot Sequence: {self.last_number}"


def generate_lot_number():
    """
    G├®n├¿re un num├®ro de lot unique au format L01
    Utilise Redis (cache) pour ├®viter le verrouillage global de la base de donn├®es (select_for_update).
    Si le cache est vide (red├®marrage), il s'initialise depuis la derni├¿re entr├®e StockLot.
    """
    CACHE_KEY = 'lot_sequence'
    
    try:
        # Essayer d'incr├®menter atomiquement via Redis
        sequence = cache.incr(CACHE_KEY)
    except ValueError:
        # La cl├® n'existe pas, initialisation depuis la DB (Recovery)
        # On cherche le dernier lot cr├®├® dans StockLot
        last_number = 0
        
        # 1. V├®rifier StockLot (Source de v├®rit├® principale)
        # On utilise 'created_at' car l'ID peut ├¬tre d├®synchronis├® (ex: import donn├®es)
        last_stock = StockLot.objects.order_by('-created_at', '-id').first()
        
        if last_stock and last_stock.lot and last_stock.lot.startswith('L'):
            try:
                last_number = int(last_stock.lot[1:])
            except ValueError:
                pass
                
        # 2. V├®rifier LotSequence (Fallback historique)
        try:
            seq_obj = LotSequence.objects.get(id=1)
            if seq_obj.last_number > last_number:
                last_number = seq_obj.last_number
        except LotSequence.DoesNotExist:
            pass
            
        # 3. Initialiser le cache
        cache.set(CACHE_KEY, last_number, timeout=None)
        
        # 4. Incr├®menter
        sequence = cache.incr(CACHE_KEY)
        
        # On met ├á jour LotSequence uniquement lors de la r├®cup├®ration pour garder une trace approximative
        # mais PAS ├á chaque g├®n├®ration pour ├®viter le lock
        LotSequence.objects.update_or_create(id=1, defaults={'last_number': sequence})

    return f'L{sequence:02d}'


class StockLot(models.Model):
    """
    Repr├®sente un lot de stock re├ºu d'un fournisseur.
    Permet la tra├ºabilit├® FIFO et le calcul du CA par fournisseur.
    """
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_lots')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    commande_produit = models.ForeignKey('CommandeProduit', on_delete=models.CASCADE, related_name='stock_lot', null=True, blank=True, help_text="R├®f├®rence ├á la ligne de commande (si applicable)")
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True)
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegard├®")
    quantity_initial = models.IntegerField(help_text="Quantit├® totale initiale (pay├®e + gratuites)")
    quantity_paid = models.IntegerField(default=0, help_text="Quantit├® pay├®e uniquement")
    quantity_free = models.IntegerField(default=0, help_text="Unit├®s gratuites (UG)")
    quantity_remaining = models.IntegerField(help_text="Quantit├® restante dans le lot")
    price_cost = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix d'achat unitaire effectif (ajust├® avec UG)")
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Prix de vente lors de la r├®ception") # NEW
    lot = models.CharField(max_length=20, blank=True, null=True, db_index=True, help_text="Num├®ro de lot auto-g├®n├®r├® ou manuel")
    date_expiration = models.DateField(blank=True, null=True)
    date_reception = models.DateTimeField(help_text="Date de r├®ception du lot (pour FIFO)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date_reception']  # FIFO: Premier arriv├®, premier servi
        indexes = [
            models.Index(fields=['produit', 'date_reception']),
            models.Index(fields=['produit', 'quantity_remaining']),
        ]
        # Contrainte unique sur la combinaison (produit, lot) pour permettre le m├¬me lot sur diff├®rents produits
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


# Signal pour auto-g├®n├®ration de num├®ro de lot
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver

@receiver(pre_save, sender=StockLot)
def auto_generate_lot_number(sender, instance, **kwargs):
    """
    G├®n├¿re automatiquement un num├®ro de lot si non fourni.
    """
    if not instance.lot:
        instance.lot = generate_lot_number()


@receiver(post_save, sender=StockLot)
def sync_product_stock_on_lot_save(sender, instance, created, **kwargs):
    """
    Synchronise le stock du produit quand un lot est cr├®├® ou modifi├®.
    Uniquement pour les produits avec use_lot_management=True.
    
    OPTIMISATION: Pour les modifications, on calcule le delta au lieu de tout recalculer.
    Pour les cr├®ations, on doit recalculer car on ne conna├«t pas l'ancien ├®tat.
    """
    if instance.produit and instance.produit.use_lot_management:
        # Pour les cr├®ations, on doit recalculer car on n'a pas l'ancienne valeur
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
            # On recalcule pour ├¬tre s├╗r de la coh├®rence (trade-off performance vs exactitude)
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
    Synchronise le stock du produit quand un lot est supprim├®.
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
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField()
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Montant de la remise unitaire") # NEW
    tva = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.00,
        help_text="TVA applicable ├á cette ligne (copi├®e du produit lors de la cr├®ation)"
    )
    lot = models.CharField(max_length=20, blank=True, null=True)
    stock_lot = models.ForeignKey(StockLot, on_delete=models.SET_NULL, null=True, blank=True, help_text="Lot sp├®cifique choisi manuellement") # NEW
    date_expiration = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ligne de facture {self.id}"

    class Meta:
        indexes = [
            # Index sur produit pour les joins fr├®quents (history, stats)
            models.Index(fields=['produit']),
            # Index composite pour les requ├¬tes par facture et produit
            models.Index(fields=['facture', 'produit']),
        ]


# Signal pour copier automatiquement la TVA du produit vers la ligne de facture
@receiver(pre_save, sender=FactureProduit)
def copy_tva_from_product(sender, instance, **kwargs):
    """
    Copie automatiquement la TVA du produit vers la ligne de facture lors de la cr├®ation.
    Si la TVA de la ligne est 0 et que le produit a une TVA, on la copie.
    """
    if instance.produit and instance.tva == Decimal('0.00'):
        instance.tva = instance.produit.tva



class RelevePaiement(models.Model):
    """
    Regroupe plusieurs paiements de factures effectu├®s en une seule op├®ration (bulk).
    Permet d'afficher une ligne unique dans le journal de caisse tout en gardant le d├®tail.
    """
    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='releves')
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=50, unique=True, help_text="Ex: REL-20231212-001")

    def __str__(self):
        return f"Relev├® {self.reference} - {self.client.name} ({self.total_amount})"

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
        ('completee', 'Compl├®t├®e'),
        ('annulee', 'Annul├®e'),
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
    part_patient = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Part pay├®e par le patient (tiers payant)")
    part_assurance = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Part prise en charge par l'assurance")
    
    def __str__(self):
        return f"Paiement {self.id} - {self.montant} F - {self.get_mode_paiement_display()}"
    
    class Meta:
        ordering = ['-date_paiement']
        indexes = [
            # Index sur statut pour les filtres fr├®quents (get_totals, cloturer)
            models.Index(fields=['statut']),
            # Index composite pour les filtres par facture et statut
            models.Index(fields=['facture', 'statut']),
            # Index sur date_paiement pour les tris
            models.Index(fields=['-date_paiement']),
        ]

@receiver(post_save, sender=Caisse)
def handle_caisse_post_save(sender, instance, created, **kwargs):
    """
    Logique m├®tier apr├¿s enregistrement d'un r├¿glement :
    1. Marquage Tiers Payant (Part Patient) pour le ticket.
    2. Split Billing (G├®n├®ration automatique du cr├®dit assurance).
    3. Mise ├á jour du statut de la facture vers PAYEE.
    """
    if instance.statut != 'completee':
        return

    facture = instance.facture
    
    # 1. Marquage Tiers Payant (Part Patient)
    # Si la facture a une part_client d├®finie, on marque tout paiement r├®el comme 'Part Patient'
    if facture.part_client is not None and instance.mode_paiement != 'en_compte':
        if not instance.part_patient and (instance.part_assurance is None or instance.part_assurance == 0):
            # Utilisation de .update() pour ne pas red├®clencher le signal post_save
            Caisse.objects.filter(id=instance.id).update(
                part_patient=instance.montant,
                part_assurance=Decimal('0.00')
            )

    # 2. Split Billing (G├®n├®ration automatique de la cr├®ance)
    # Si le montant cumul├® pay├® par le client atteint sa part_client, on bascule le reste en cr├®dit.
    if created and facture.part_client is not None and instance.mode_paiement != 'en_compte':
        paiements_reels = Caisse.objects.filter(
            facture=facture, 
            statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0')
        
        if paiements_reels >= facture.part_client:
            reste_a_couvrir = facture.total_ttc - paiements_reels
            if reste_a_couvrir > Decimal('1.00'):
                # V├®rifier si on a d├®j├á g├®n├®r├® un cr├®dit automatique pour cette facture
                deja_traite = Caisse.objects.filter(
                    facture=facture, 
                    mode_paiement='en_compte',
                    reference__startswith='AUTO-CREDIT'
                ).exists()
                
                if not deja_traite:
                    # Cr├®ation du paiement 'En Compte' pour le solde (Part Assurance)
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

    # 3. Mise ├á jour du statut de la facture
    # Si le total des r├¿glements (Cash + Cr├®dit) couvre le montant TTC, la facture est pay├®e.
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
    Tra├ºabilit├®: enregistre quelle part d'une vente provient de quel lot.
    Permet de calculer la marge et le CA par fournisseur.
    """
    facture_produit = models.ForeignKey('FactureProduit', on_delete=models.CASCADE, related_name='allocations')
    stock_lot = models.ForeignKey('StockLot', on_delete=models.PROTECT)
    quantity = models.IntegerField(help_text="Quantit├® pr├®lev├®e de ce lot")
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix d'achat du lot")
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix de vente")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Allocation {self.id} - {self.quantity} unit├®s du lot {self.stock_lot.id}"
    
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
        VALIDEE = 'VALIDEE', 'Valid├®e'

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
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    stock_lot = models.ForeignKey(
        'StockLot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventaires',
        help_text="Lot sp├®cifique compt├® (si inventaire par lot)"
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
        """Retourne le num├®ro du lot si disponible"""
        return self.stock_lot.lot if self.stock_lot else None
    
    @property
    def lot_expiration(self):
        """Retourne la date d'expiration du lot si disponible"""
        return self.stock_lot.date_expiration if self.stock_lot else None

class MouvementCaisse(models.Model):
    """
    Mod├¿le pour les entr├®es et sorties de caisse sp├®ciales (hors ventes).
    Ex: Paiement facture ├®lectricit├®, Achat carburant, Entr├®e fonds de caisse...
    """
    TYPE_CHOICES = [
        ('ENTREE', 'Entr├®e'),
        ('SORTIE', 'Sortie'),
    ]
    
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    motif = models.CharField(max_length=200, help_text="Ex: Electricit├®, Carburant, etc.")
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mouvements_caisse')
    
    class Meta:
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.type} - {self.montant} ({self.motif})"

class Avoir(models.Model):
    """
    Mod├¿le pour les retours fournisseurs (Avoirs).
    Retire du stock contrairement aux Commandes qui en ajoutent.
    """
    TYPE_CHOICES = [
        ('PERIME', 'Produit p├®rim├®'),
        ('AVARIE', 'Produit avari├®'),
        ('NON_FACTURE', 'Livr├® non factur├®'),
        ('ERREUR', 'Erreur de livraison'),
        ('AUTRE', 'Autre'),
    ]
    
    STATUS_CHOICES = [
        ('BROUILLON', 'Brouillon'),
        ('VALIDEE', 'Valid├®e'),
    ]
    
    numero = models.CharField(max_length=50, unique=True, blank=True)
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.SET_NULL, null=True, blank=True, related_name='avoirs')
    fournisseur_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du fournisseur sauvegard├®")
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
        """G├®n├¿re un num├®ro d'avoir au format AV-YYYYMM-XXXX"""
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
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    stock_lot = models.ForeignKey(
        'StockLot', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='avoirs',
        help_text="Lot sp├®cifique retourn├® (si applicable)"
    )
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix de retour")
    lot = models.CharField(max_length=100, blank=True)
    date_expiration = models.DateField(null=True, blank=True)
    
    # Nouveau champ pour la clôture administrative
    est_cloture = models.BooleanField(default=False, help_text="Indique si cette ligne est administrativement clôturée")

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
    Historique de tous les mouvements de stock (Entr├®es, Sorties, Ajustements, Transformations)
    Permet de reconstruire l'├®tat du stock ├á une date donn├®e et d'analyser les flux.
    """
    class TypeMouvement(models.TextChoices):
        ENTREE = 'ENTREE', 'Entr├®e (Commande)'
        SORTIE = 'SORTIE', 'Sortie (Vente)'
        RETOUR = 'RETOUR', 'Retour (Annulation)'
        AJUSTEMENT = 'AJUSTEMENT', 'Ajustement Inventaire'
        AVOIR = 'AVOIR', 'Avoir (Retour Fournisseur)'
        TRANSFORMATION_ENTREE = 'TRANSFORMATION_ENTREE', 'Transformation (Entrée)'
        TRANSFORMATION_SORTIE = 'TRANSFORMATION_SORTIE', 'Transformation (Sortie)'

    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='mouvements_stock')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    type_mouvement = models.CharField(max_length=30, choices=TypeMouvement.choices)
    quantite = models.IntegerField(help_text="Quantit├® mouvement├®e (positive ou n├®gative)")
    stock_apres = models.IntegerField(null=True, blank=True, help_text="Stock apr├¿s mouvement (snapshot)")
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
    D├®finit la relation de transformation entre deux produits.
    Exemple: 1 bo├«te PARACETAMOL (produit_source) = 20 d├®tails PARACETAMOL (produit_destination)
    """
    produit_source = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='transformations_source',
        help_text="Produit ├á transformer (ex: BOITE)"
    )
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='transformations_destination',
        help_text="Produit r├®sultant (ex: DETAIL)"
    )
    ratio = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Ratio de conversion (ex: 20.00 si 1 bo├«te = 20 d├®tails)"
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
    Historique des transformations effectu├®es.
    Trace chaque op├®ration de d├®conditionnement/reconditionnement.
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
    produit_source_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit source sauvegard├®")
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hist_trans_dest'
    )
    produit_destination_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit destination sauvegard├®")
    quantite_source = models.IntegerField(help_text="Quantit├® transform├®e (source)")
    quantite_destination = models.IntegerField(help_text="Quantit├® obtenue (destination)")
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
        ('split', 'S├®par├® (Logo Gauche / Info Droite)'),
        ('left', 'Tout ├á Gauche'),
        ('center', 'Tout Centr├®'),
        ('right', 'Tout ├á Droite'),
    ]

    company_name = models.CharField(max_length=255, default="Ma Soci├®t├®")
    company_address = models.TextField(default="Adresse de l'entreprise\nT├®l├®phone: 00 00 00 00 00")
    footer_text = models.TextField(default="Merci de votre confiance.", blank=True)
    
    header_layout = models.CharField(max_length=20, choices=HEADER_LAYOUT_CHOICES, default='split')
    primary_color = models.CharField(max_length=7, default="#000000") # Hex code
    centralized_cash_register = models.BooleanField(default=False, help_text="Activer le mode Caisse Centralis├®e")

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
        # Actions g├®n├®riques CRUD
        CREATE = 'CREATE', 'Cr├®ation'
        UPDATE = 'UPDATE', 'Modification'
        DELETE = 'DELETE', 'Suppression'
        LOGIN = 'LOGIN', 'Connexion'
        EXPORT = 'EXPORT', 'Export'
        OTHER = 'OTHER', 'Autre'
        # Actions m├®tier explicites
        STOCK_ADJUST = 'STOCK_ADJ', 'Ajustement stock'
        PRICE_CHANGE = 'PRICE_CHG', 'Changement prix'
        CLOTURE_CAISSE = 'CLOTURE', 'Cl├┤ture caisse'
        INVOICE_CANCEL = 'INV_CANCEL', 'Annulation facture'
        INVOICE_DELETE = 'INV_DEL', 'Suppression facture'
        INVOICE_VALIDATE = 'INV_VALID', 'Validation facture'
        INVENTORY_CREATE = 'INV_CRE', 'Cr├®ation inventaire'
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
    """Tra├ºabilit├® des ajustements manuels de stock."""
    
    class ReasonType(models.TextChoices):
        INVENTAIRE = 'INVENTAIRE', 'Ajustement inventaire'
        CASSE = 'CASSE', 'Cass├®'
        VOL = 'VOL', 'Vol'
        CONFUSION = 'CONFUSION', 'Confusion'
        ERREUR_ENTREE = 'ERR_ENTREE', 'Erreur d\'entr├®e en stock'
        AVARIE = 'AVARIE', 'Avari├®'
        USAGE_INTERNE = 'USAGE_INT', 'Usage interne'
    
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustments')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    stock_lot = models.ForeignKey('StockLot', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustments')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    quantity_before = models.IntegerField(help_text="Stock avant ajustement")
    quantity_after = models.IntegerField(help_text="Stock apr├¿s ajustement")
    quantity_change = models.IntegerField(help_text="Diff├®rence (+/-)")
    
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
        DELIVRE = 'DEL', 'D├®livr├®'
        ANNULE = 'ANN', 'Annul├®'

    facture = models.ForeignKey('Facture', on_delete=models.SET_NULL, related_name='promis', null=True, blank=True)
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='promis')
    client_name = models.CharField(max_length=100, blank=True, help_text="Nom du client (pour clients de passage)")
    client_phone = models.CharField(max_length=20, blank=True, help_text="T├®l├®phone du client")
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='promis')
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegard├®")
    quantite = models.IntegerField(help_text="Quantit├® promise au client")
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




# Signaux pour mise ├á jour automatique des totaux de Facture
# Plac├®s ici car FactureProduit doit ├¬tre d├®fini
@receiver(post_save, sender=FactureProduit)
@receiver(post_delete, sender=FactureProduit)
def update_facture_totals_on_line_change(sender, instance, **kwargs):
    if instance.facture:
        instance.facture.calculate_totals()

@receiver(post_save, sender=Facture)
def update_facture_totals_on_change(sender, instance, created, **kwargs):
    # Eviter r├®cursion infinie si le save vient de calculate_totals
    update_fields = kwargs.get('update_fields')
    if update_fields and ('total_ht' in update_fields or 'total_ttc' in update_fields):
        return

    if not created:
         instance.calculate_totals(save=True)


class ClotureCaisse(models.Model):
    """Model representing a cash register closure (cl├┤ture de caisse)."""
    date = models.DateTimeField(default=timezone.now)
    montant_reel = models.DecimalField(max_digits=12, decimal_places=2, help_text="Montant r├®ellement compt├® en caisse")
    montant_theorique = models.DecimalField(max_digits=12, decimal_places=2, help_text="Montant th├®orique calcul├®")
    ecart_caisse = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="├ëcart entre r├®el et th├®orique")
    
    # D├®tails
    total_ventes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_entrees = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Entr├®es de caisse hors ventes")
    total_sorties = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Sorties de caisse")
    details_paiement = models.JSONField(default=dict, blank=True, help_text="D├®tails par mode de paiement")
    
    # P├®riode couverte
    date_debut = models.DateTimeField(null=True, blank=True, help_text="D├®but de la p├®riode de cl├┤ture")
    date_fin = models.DateTimeField(null=True, blank=True, help_text="Fin de la p├®riode de cl├┤ture")
    
    # Caissier
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='clotures_caisse')
    observation = models.TextField(blank=True, null=True, help_text="Notes ou observations sur la cl├┤ture")
    
    class Meta:
        ordering = ['-date']
        verbose_name = "Cl├┤ture de caisse"
        verbose_name_plural = "Cl├┤tures de caisse"
    
    def __str__(self):
        return f"Cl├┤ture du {self.date.strftime('%d/%m/%Y %H:%M')} - ├ëcart: {self.ecart_caisse} F"


class Ordonnancier(models.Model):
    """Registre des m├®dicaments d├®livr├®s sur ordonnance (ordonnancier de la pharmacie)."""
    numero_ordre = models.AutoField(primary_key=True)  # Num├®ro chronologique
    date_delivrance = models.DateTimeField(default=timezone.now)
    
    # Patient
    patient_nom = models.CharField(max_length=200, help_text="Nom du patient")
    
    # Prescripteur
    prescripteur_nom = models.CharField(max_length=200, help_text="Nom du m├®decin prescripteur")
    
    # Lien avec la facture
    facture = models.ForeignKey('Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='ordonnancier_entries')
    
    # Utilisateur qui a enregistr├®
    enregistre_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='ordonnancier_entries')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-numero_ordre']
        verbose_name = "Ordonnancier"
        verbose_name_plural = "Ordonnancier"
    
    def __str__(self):
        return f"Ord. #{self.numero_ordre} - {self.patient_nom} ({self.date_delivrance.strftime('%d/%m/%Y')})"


class LigneOrdonnancier(models.Model):
    """Ligne de l'ordonnancier (un m├®dicament d├®livr├®)."""
    ordonnancier = models.ForeignKey(Ordonnancier, on_delete=models.CASCADE, related_name='lignes')
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, related_name='ordonnancier_lignes')
    produit_nom = models.CharField(max_length=200, help_text="Copie du nom pour historique")
    quantite = models.IntegerField()
    
    # Cat├®gorie de surveillance (copie pour historique)
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
    dans les mod├¿les li├®s qui ont un champ produit_nom.
    """
    if not instance.pk:
        return
        
    nom = instance.name
    
    # Mod├¿les li├®s (via related_names et sets implicites)
    # Note: On utilise update() pour une requ├¬te SQL unique efficace
    
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
    
    # Mod├¿les sans related_name explicite (utilise modelname_set)
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


class CouponMonnaie(models.Model):
    """
    Coupon de monnaie pour gérer le manque de pièces.
    Permet de donner un bon au client pour le reste non-rendu.
    """
    class Status(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        UTILISE = 'UTILISE', 'Utilisé'
        EXPIRE = 'EXPIRE', 'Expiré'
        ANNULE = 'ANNULE', 'Annulé'
    
    numero = models.CharField(max_length=10, unique=True, editable=False)  # Format: 0001, 0002...
    montant = models.DecimalField(max_digits=10, decimal_places=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIF)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_utilisation = models.DateTimeField(null=True, blank=True)
    
    # Traçabilité
    cree_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='coupons_crees')
    utilise_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons_utilises')
    facture_origine = models.ForeignKey('Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons_generes')
    facture_utilisation = models.ForeignKey('Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons_utilises')
    
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Coupon Monnaie"
        verbose_name_plural = "Coupons Monnaie"
        ordering = ['-date_creation']
    
    def __str__(self):
        return f"Coupon #{self.numero} - {self.montant} F"
    
    def save(self, *args, **kwargs):
        if not self.numero:
            # Auto-generate numero: 0001, 0002...
            last = CouponMonnaie.objects.order_by('-id').first()
            if last and last.numero:
                try:
                    next_num = int(last.numero) + 1
                except ValueError:
                    next_num = 1
            else:
                next_num = 1
            self.numero = str(next_num).zfill(4)
        super().save(*args, **kwargs)

