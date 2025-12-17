from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
from django.db.models import Sum, F, DecimalField
from decimal import Decimal
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# Create your models here

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    allowed_menus = models.JSONField(default=list, blank=True)
    can_do_returns = models.BooleanField(default=False)
    can_sell_negative_stock = models.BooleanField(default=False)

    def __str__(self):
        return f"Profile of {self.user.username}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()



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
    
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name

    @property
    def current_debt(self):
        """
        Calcule la dette actuelle du client.
        Somme des restes à payer sur les factures VALIDEE.
        """
        total_dette = Decimal('0.00')
        
        # On ne prend que les factures VALIDEE. 
        # Si une facture est PAYEE, la dette est nulle.
        # Si elle est BROUILLON ou ANNULEE, pas de dette.
        factures = self.facture_set.filter(status='VAL')
        
        for facture in factures:
             # Somme des paiements réels (excluant 'en_compte')
             # On utilise l'attribut factice 'paiements' via related_name
             paiements_reels = facture.paiements.filter(
                 statut='completee'
             ).exclude(
                 mode_paiement='en_compte'
             ).aggregate(
                 total=Sum('montant')
             )['total'] or Decimal('0.00')
             
             reste = facture.total_ttc - paiements_reels
             
             # On ne compte que si le reste est positif (éviter négatifs bizarres)
             if reste > 0:
                 total_dette += reste
                 
        return total_dette


class AyantDroit(models.Model):
    """Model representing a beneficiary for a professional client."""
    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='ayants_droit')
    matricule = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    societe = models.CharField(max_length=200, blank=True, null=True)
    date_creation = models.DateField(default=timezone.now)

    def __str__(self):
        return f"{self.nom} ({self.matricule})"


class Commande(models.Model):
    """Model representing an order."""
    class Status(models.TextChoices):
        EN_PREPARATION = 'PREP', 'En préparation'
        EN_ATTENTE = 'ATT', 'En attente'
        CLOTUREE = 'CLOT', 'Clôturée'

    id = models.AutoField(primary_key=True)
    # On utilise PROTECT pour éviter de supprimer des commandes si un fournisseur est effacé.
    fournisseur = models.ForeignKey(Fournisseur, on_delete=models.PROTECT)
    numero_facture = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
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
    produit = models.ForeignKey('Produit', on_delete=models.CASCADE)
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField(help_text="Quantité commandée et payée")
    unites_gratuites = models.IntegerField(default=0, help_text="Unités gratuites reçues (ex: promotion 3+1)")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    price_cost = models.DecimalField(max_digits=10, decimal_places=2)
    lot = models.CharField(max_length=20, blank=True, null=True)
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


class Facture(models.Model):
    """Model representing a sales invoice."""
    class Status(models.TextChoices):
        BROUILLON = 'BROU', 'Brouillon'
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

    def __str__(self):
        return f"Facture {self.numero_facture or self.id}"
    
    @property
    def total_ht(self):
        """Calcule le total hors taxes."""
        total_value = self.produits.aggregate(
            total=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )['total']
        return total_value or Decimal('0.00')
    
    @property
    def total_tva(self):
        """Calcule le montant de la TVA."""
        try:
            total_ht = Decimal(str(self.total_ht))
            remise = Decimal(str(self.remise))
            tva_rate = Decimal(str(self.tva))
            result = (total_ht - remise) * (tva_rate / 100)
            return result.quantize(Decimal('0.01'))
        except (ValueError, TypeError, AttributeError):
            return Decimal('0.00')
    
    @property
    def total_ttc(self):
        """Calcule le total toutes taxes comprises."""
        try:
            total_ht = Decimal(str(self.total_ht))
            remise = Decimal(str(self.remise))
            tva = self.total_tva
            result = total_ht - remise + tva
            return result.quantize(Decimal('0.01'))
        except (ValueError, TypeError, AttributeError):
            return Decimal('0.00')


class FactureProduit(models.Model):
    """Model representing a product in an invoice."""
    id = models.AutoField(primary_key=True)
    produit = models.ForeignKey('Produit', on_delete=models.CASCADE)
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField()
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    lot = models.CharField(max_length=20, blank=True, null=True)
    date_expiration = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ligne de facture {self.id}"


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
    
    def __str__(self):
        return f"Paiement {self.id} - {self.montant} F - {self.get_mode_paiement_display()}"
    
    class Meta:
        ordering = ['-date_paiement']

@receiver(post_save, sender=Caisse)
def update_facture_status_on_payment(sender, instance, created, **kwargs):
    """
    Met à jour automatiquement le statut de la facture vers PAYEE
    lorsque le total des paiements atteint ou dépasse le montant total TTC.
    Exception: les paiements 'en_compte' ne marquent pas la facture comme payée.
    """
    if instance.statut == 'completee':
        # Ne pas marquer comme payée si le mode de paiement est 'en_compte'
        if instance.mode_paiement != 'en_compte':
            facture = instance.facture
            if facture.status == Facture.Status.VALIDEE:
                # Calculer le total des paiements complétés (hors 'en_compte')
                total_paiements = facture.paiements.filter(
                    statut='completee'
                ).exclude(
                    mode_paiement='en_compte'
                ).aggregate(
                    total=Sum('montant')
                )['total'] or Decimal('0.00')
                
                # Marquer comme payée si le total des paiements >= total TTC
                if total_paiements >= facture.total_ttc:
                    facture.status = Facture.Status.PAYEE
                    facture.save(update_fields=['status'])


class StockLot(models.Model):
    """
    Représente un lot de stock reçu d'un fournisseur.
    Permet la traçabilité FIFO et le calcul du CA par fournisseur.
    """
    produit = models.ForeignKey('Produit', on_delete=models.CASCADE, related_name='stock_lots')
    commande_produit = models.ForeignKey('CommandeProduit', on_delete=models.CASCADE, related_name='stock_lot')
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.PROTECT)
    quantity_initial = models.IntegerField(help_text="Quantité totale initiale (payée + gratuites)")
    quantity_paid = models.IntegerField(default=0, help_text="Quantité payée uniquement")
    quantity_free = models.IntegerField(default=0, help_text="Unités gratuites (UG)")
    quantity_remaining = models.IntegerField(help_text="Quantité restante dans le lot")
    price_cost = models.DecimalField(max_digits=10, decimal_places=2, help_text="Prix d'achat unitaire effectif (ajusté avec UG)")
    lot = models.CharField(max_length=20, blank=True, null=True)
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

    def __str__(self):
        ug_info = f" dont {self.quantity_free} UG" if self.quantity_free > 0 else ""
        return f"Lot {self.id} - {self.produit.name} ({self.quantity_remaining}/{self.quantity_initial}{ug_info})"


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


class ClotureCaisse(models.Model):
    date = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    montant_theorique = models.DecimalField(max_digits=12, decimal_places=2)
    montant_reel = models.DecimalField(max_digits=12, decimal_places=2)
    ecart = models.DecimalField(max_digits=12, decimal_places=2)
    details = models.JSONField(default=dict) # Détails par mode de paiement
    
    def __str__(self):
        return f"Clôture du {self.date} par {self.user}"


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
    produit = models.ForeignKey(Produit, on_delete=models.PROTECT) # Protect to exclude deleted products from historical inventories
    stock_theorique = models.IntegerField(help_text="Stock au moment de l'ajout dans l'inventaire")
    quantite_physique = models.IntegerField(default=0)
    ecart = models.IntegerField(default=0, editable=False)
    pmp_snapshot = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    def save(self, *args, **kwargs):
        self.ecart = self.quantite_physique - self.stock_theorique
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.produit.name} : {self.quantite_physique} (Th: {self.stock_theorique})"

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
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='mouvements_caisse')
    
    class Meta:
        ordering = ['-date']
        
    def __str__(self):
        return f"{self.type} - {self.montant} ({self.motif})"
from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
from django.db.models import Sum, F, DecimalField
from decimal import Decimal
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from datetime import date

# ... (existing models above)

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
    fournisseur = models.ForeignKey('Fournisseur', on_delete=models.PROTECT, related_name='avoirs')
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
    produit = models.ForeignKey('Produit', on_delete=models.PROTECT)
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

    produit = models.ForeignKey('Produit', on_delete=models.CASCADE, related_name='mouvements_stock')
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
        on_delete=models.CASCADE, 
        related_name='hist_trans_source'
    )
    produit_destination = models.ForeignKey(
        'Produit', 
        on_delete=models.CASCADE, 
        related_name='hist_trans_dest'
    )
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
        create = 'CREATE', 'Création'
        update = 'UPDATE', 'Modification'
        delete = 'DELETE', 'Suppression'
        login = 'LOGIN', 'Connexion'
        export = 'EXPORT', 'Export'
        other = 'OTHER', 'Autre'

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=10, choices=Action.choices)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, blank=True, null=True)
    details = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.action} {self.model_name} at {self.timestamp}"
