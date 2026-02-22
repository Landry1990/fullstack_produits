# -*- coding: utf-8 -*-
"""
Billing-related models: Facture, FactureProduit, Caisse, etc.
"""
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Sum, F, DecimalField, Q, Value
from django.db.models.functions import Coalesce
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from decimal import Decimal


class Facture(models.Model):
    """Model representing a sales invoice."""
    class Status(models.TextChoices):
        BROUILLON = 'BROU', 'Brouillon'
        PROFORMA = 'PROF', 'Proforma'
        VALIDEE = 'VAL', 'Validée'
        PAYEE = 'PAY', 'Payée'
        ANNULEE = 'ANN', 'Annulée'

    id = models.AutoField(primary_key=True)
    client = models.ForeignKey('Client', on_delete=models.PROTECT, null=True, blank=True)
    client_name_override = models.CharField(max_length=100, blank=True, null=True)
    ayant_droit = models.ForeignKey(
        'AyantDroit', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='factures'
    )
    numero_facture = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=4,
        choices=Status.choices,
        default=Status.BROUILLON,
    )
    remise = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tva = models.DecimalField(max_digits=5, decimal_places=2, default=19.25)
    notes = models.TextField(blank=True, null=True)
    date_annulation = models.DateTimeField(null=True, blank=True)
    date_document = models.DateTimeField(null=True, blank=True, help_text="Date affichée sur les documents (si différente de la date de création)")
    
    points_fidelite_gagnes = models.IntegerField(default=0)
    points_fidelite_utilises = models.IntegerField(default=0)
    montant_fidelite = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    part_client = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, 
        help_text="Part à payer par le client (Tiers Payant)"
    )
    
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='factures_created', 
        help_text="Utilisateur qui a créé la facture"
    )
    
    total_ht = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_tva = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    ticket_session = models.IntegerField(null=True, blank=True, help_text="Numéro de ticket pour la session du jour")

    validated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='factures_validated',
        help_text="Utilisateur qui a validé la facture"
    )

    cancelled_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='factures_cancelled',
        help_text="Utilisateur qui a annulé la facture"
    )

    def __str__(self):
        return f"Facture {self.numero_facture or self.id}"
    
    def calculate_totals(self, save=True):
        """Calcule les totaux HT, TVA et TTC ligne par ligne."""
        # Calcul via boucle pour supporter les remises ligne
        total_ttc_brut = Decimal('0.00')
        
        total_ht = Decimal('0.00')
        total_tva = Decimal('0.00')
        
        for ligne in self.produits.all():
            # Prix unitaire net = Selling Price - Unit Discount
            prix_unitaire_net = ligne.selling_price - ligne.discount
            if prix_unitaire_net < 0:
                prix_unitaire_net = Decimal('0.00')

            ttc_ligne = ligne.quantity * prix_unitaire_net
            
            if ligne.tva > 0:
                ht_ligne = (ttc_ligne / (1 + ligne.tva / 100)).quantize(Decimal('0.01'))
                tva_ligne = (ttc_ligne - ht_ligne).quantize(Decimal('0.01'))
            else:
                ht_ligne = ttc_ligne
                tva_ligne = Decimal('0.00')
            
            total_ht += ht_ligne
            total_tva += tva_ligne
            total_ttc_brut += ttc_ligne
        
        remise = Decimal(str(self.remise))
        total_ttc_apres_remise = total_ttc_brut - remise
        
        if total_ttc_brut > 0:
            ratio_remise = total_ttc_apres_remise / total_ttc_brut
            total_ht = (total_ht * ratio_remise).quantize(Decimal('0.01'))
            total_tva = (total_tva * ratio_remise).quantize(Decimal('0.01'))
        
        self.total_ht = total_ht
        self.total_tva = total_tva
        self.total_ttc = total_ttc_apres_remise
        
        if self.client and self.client.taux_couverture > 0:
            taux_assurance = self.client.taux_couverture
            taux_client = Decimal('100.00') - taux_assurance
            if taux_client < 0:
                taux_client = Decimal('0.00')
            self.part_client = (self.total_ttc * taux_client / Decimal('100.00')).quantize(Decimal('0.01'))
        else:
            self.part_client = self.total_ttc

        if save:
            self.save(update_fields=['total_ht', 'total_tva', 'total_ttc', 'part_client'])

    def get_tva_analysis(self):
        """Calcule la répartition par taux de TVA."""
        analysis = {}
        
        for ligne in self.produits.all():
            taux = ligne.tva
            if taux not in analysis:
                analysis[taux] = {'base_ht': Decimal('0.00'), 'montant_tva': Decimal('0.00')}
            
            pu_ttc_net = ligne.selling_price - ligne.discount
            total_ttc_ligne = pu_ttc_net * ligne.quantity
            
            if taux > 0:
                ht_ligne = (total_ttc_ligne / (1 + taux / Decimal('100.00'))).quantize(Decimal('0.01'))
                tva_ligne = total_ttc_ligne - ht_ligne
            else:
                ht_ligne = total_ttc_ligne
                tva_ligne = Decimal('0.00')
                
            analysis[taux]['base_ht'] += ht_ligne
            analysis[taux]['montant_tva'] += tva_ligne

        total_ttc_brut = sum(data['base_ht'] + data['montant_tva'] for data in analysis.values())
        
        if total_ttc_brut > 0 and self.remise > 0:
            total_ttc_net = total_ttc_brut - self.remise
            ratio = total_ttc_net / total_ttc_brut
            
            for taux in analysis:
                analysis[taux]['base_ht'] = (analysis[taux]['base_ht'] * ratio).quantize(Decimal('0.01'))
                analysis[taux]['montant_tva'] = (analysis[taux]['montant_tva'] * ratio).quantize(Decimal('0.01'))

        return analysis

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['-date']),
        ]


class FactureProduit(models.Model):
    """Model representing a product in an invoice."""
    id = models.AutoField(primary_key=True)
    produit = models.ForeignKey('Produit', on_delete=models.SET_NULL, null=True, blank=True)
    produit_nom = models.CharField(max_length=150, blank=True, null=True, help_text="Nom du produit sauvegardé")
    facture = models.ForeignKey(Facture, on_delete=models.CASCADE, related_name='produits')
    quantity = models.IntegerField()
    free_quantity = models.IntegerField(default=0, help_text="Unités gratuites (Promotion)")
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00, 
        help_text="Montant de la remise unitaire"
    )
    tva = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.00,
        help_text="TVA applicable à cette ligne"
    )
    lot = models.CharField(max_length=20, blank=True, null=True)
    stock_lot = models.ForeignKey(
        'StockLot', on_delete=models.SET_NULL, null=True, blank=True, 
        help_text="Lot spécifique choisi manuellement"
    )
    date_expiration = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ligne de facture {self.id}"

    class Meta:
        indexes = [
            models.Index(fields=['produit']),
            models.Index(fields=['facture', 'produit']),
        ]


class FactureProduitAllocation(models.Model):
    """Traçabilité: enregistre quelle part d'une vente provient de quel lot."""
    facture_produit = models.ForeignKey(
        'FactureProduit', on_delete=models.CASCADE, related_name='allocations'
    )
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


class RelevePaiement(models.Model):
    """Regroupe plusieurs paiements de factures effectués en une seule opération (bulk)."""
    id = models.AutoField(primary_key=True)
    client = models.ForeignKey('Client', on_delete=models.PROTECT, related_name='releves')
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=50, unique=True, help_text="Ex: REL-20231212-001")

    def __str__(self):
        return f"Relevé {self.reference} - {self.client.name} ({self.total_amount})"

    class Meta:
        ordering = ['-created_at']


class Caisse(models.Model):
    """Model representing payments."""
    MODES_PAIEMENT = [
        ('especes', 'Espèces'),
        ('cheque', 'Chèque'),
        ('carte', 'Carte'),
        ('virement', 'Virement'),
        ('om', 'Orange Money'),
        ('momo', 'Mobile Money'),
        ('coupon', 'Coupon'),
        ('en_compte', 'En compte'),
        ('recouvrement', 'Recouvrement'),
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
    user = models.ForeignKey(
        User, on_delete=models.PROTECT, null=True, blank=True, 
        related_name='transactions_caisse'
    )
    releve = models.ForeignKey(
        RelevePaiement, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='paiements_caisse'
    )
    part_patient = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, 
        help_text="Part payée par le patient (tiers payant)"
    )
    part_assurance = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, 
        help_text="Part prise en charge par l'assurance"
    )
    
    def __str__(self):
        return f"Paiement {self.id} - {self.montant} F - {self.get_mode_paiement_display()}"
    
    class Meta:
        ordering = ['-date_paiement']
        indexes = [
            models.Index(fields=['statut']),
            models.Index(fields=['facture', 'statut']),
            models.Index(fields=['-date_paiement']),
        ]


class ClotureCaisse(models.Model):
    """Model representing a cash register closure."""
    date = models.DateTimeField(default=timezone.now)
    montant_reel = models.DecimalField(
        max_digits=12, decimal_places=2, 
        help_text="Montant réellement compté en caisse"
    )
    montant_theorique = models.DecimalField(
        max_digits=12, decimal_places=2, 
        help_text="Montant théorique calculé"
    )
    ecart_caisse = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, 
        help_text="Écart entre réel et théorique"
    )
    
    total_ventes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_entrees = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, 
        help_text="Entrées de caisse hors ventes"
    )
    total_sorties = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, 
        help_text="Sorties de caisse"
    )
    details_paiement = models.JSONField(
        default=dict, blank=True, 
        help_text="Détails par mode de paiement"
    )
    
    date_debut = models.DateTimeField(null=True, blank=True, help_text="Début de la période de clôture")
    date_fin = models.DateTimeField(null=True, blank=True, help_text="Fin de la période de clôture")
    
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='clotures_caisse'
    )
    observation = models.TextField(blank=True, null=True, help_text="Notes ou observations sur la clôture")
    
    class Meta:
        ordering = ['-date']
        verbose_name = "Clôture de caisse"
        verbose_name_plural = "Clôtures de caisse"
    
    def __str__(self):
        return f"Clôture du {self.date.strftime('%d/%m/%Y %H:%M')} - Écart: {self.ecart_caisse} F"


class CouponMonnaie(models.Model):
    """Coupon de monnaie pour gérer le manque de pièces."""
    class Status(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        UTILISE = 'UTILISE', 'Utilisé'
        EXPIRE = 'EXPIRE', 'Expiré'
        ANNULE = 'ANNULE', 'Annulé'
    
    numero = models.CharField(max_length=10, unique=True, editable=False)
    montant = models.DecimalField(max_digits=10, decimal_places=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIF)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_utilisation = models.DateTimeField(null=True, blank=True)
    
    cree_par = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='coupons_crees'
    )
    utilise_par = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons_utilises'
    )
    facture_origine = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons_generes'
    )
    facture_utilisation = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons_utilises'
    )
    
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Coupon Monnaie"
        verbose_name_plural = "Coupons Monnaie"
        ordering = ['-date_creation']
    
    def __str__(self):
        return f"Coupon #{self.numero} - {self.montant} F"
    
    def save(self, *args, **kwargs):
        if not self.numero:
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


class Promis(models.Model):
    """Model representing a product promised to a client."""
    class Status(models.TextChoices):
        EN_ATTENTE = 'ATT', 'En attente'
        DELIVRE = 'DEL', 'Délivré'
        ANNULE = 'ANN', 'Annulé'

    facture = models.ForeignKey(
        'Facture', on_delete=models.SET_NULL, related_name='promis', null=True, blank=True
    )
    client = models.ForeignKey(
        'Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='promis'
    )
    client_name = models.CharField(max_length=100, blank=True, help_text="Nom du client (pour clients de passage)")
    client_phone = models.CharField(max_length=20, blank=True, help_text="Téléphone du client")
    produit = models.ForeignKey(
        'Produit', on_delete=models.SET_NULL, null=True, blank=True, related_name='promis'
    )
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
        produit_name = self.produit.name if self.produit else self.produit_nom or 'Produit inconnu'
        return f"Promis #{self.id} - {produit_name} x{self.quantite} pour {client_display}"

    @property
    def client_display(self):
        if self.client:
            return self.client.name
        return self.client_name or 'Client de passage'

    @property
    def client_phone_display(self):
        if self.client:
            return self.client.phone
        return self.client_phone or ''

    @property
    def produit_name(self):
        return self.produit.name if self.produit else ''


# ============== SIGNALS ==============

@receiver(pre_save, sender=FactureProduit)
def copy_tva_from_product(sender, instance, **kwargs):
    """Copie automatiquement la TVA du produit vers la ligne de facture."""
    if instance.produit and instance.tva == Decimal('0.00'):
        instance.tva = instance.produit.tva


@receiver(post_save, sender=FactureProduit)
@receiver(post_delete, sender=FactureProduit)
def update_facture_totals_on_line_change(sender, instance, **kwargs):
    if instance.facture:
        instance.facture.calculate_totals()


@receiver(post_save, sender=Facture)
def update_facture_totals_on_change(sender, instance, created, **kwargs):
    update_fields = kwargs.get('update_fields')
    if update_fields and ('total_ht' in update_fields or 'total_ttc' in update_fields):
        return
    if not created:
        instance.calculate_totals(save=True)


@receiver(post_save, sender=Caisse)
def handle_caisse_post_save(sender, instance, created, **kwargs):
    """Logique métier après enregistrement d'un règlement."""
    if instance.statut != 'completee':
        return

    facture = instance.facture
    
    # 1. Marquage Tiers Payant (Part Patient)
    if facture.part_client is not None and instance.mode_paiement != 'en_compte':
        if not instance.part_patient and (instance.part_assurance is None or instance.part_assurance == 0):
            Caisse.objects.filter(id=instance.id).update(
                part_patient=instance.montant,
                part_assurance=Decimal('0.00')
            )

    # 2. Split Billing (Génération automatique de la créance)
    if created and facture.part_client is not None and instance.mode_paiement != 'en_compte':
        paiements_reels = Caisse.objects.filter(
            facture=facture, 
            statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0')
        
        if paiements_reels >= facture.part_client:
            reste_a_couvrir = facture.total_ttc - paiements_reels
            if reste_a_couvrir > Decimal('1.00'):
                deja_traite = Caisse.objects.filter(
                    facture=facture, 
                    mode_paiement='en_compte',
                    reference__startswith='AUTO-CREDIT'
                ).exists()
                
                if not deja_traite:
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
    if facture.status not in [Facture.Status.ANNULEE, Facture.Status.PAYEE]:
        total_encaisse = Caisse.objects.filter(
            facture=facture, 
            statut='completee'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        if total_encaisse >= facture.total_ttc:
            facture.status = Facture.Status.PAYEE
            facture.save(update_fields=['status'])
