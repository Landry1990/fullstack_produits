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
from django.contrib.postgres.indexes import GinIndex
from django.dispatch import receiver
from decimal import Decimal
from typing import TYPE_CHECKING
from typing_extensions import Self


class PosteCaisse(models.Model):
    """Représente un poste de caisse physique."""
    nom = models.CharField(max_length=100, unique=True)
    code = models.SlugField(max_length=50, unique=True, help_text="Code court pour identification (ex: CAISSE-01)")
    est_ouvert = models.BooleanField(default=False)
    ouvert_par = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='postes_caisses_ouverts'
    )
    date_ouverture = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Poste de Caisse"
        verbose_name_plural = "Postes de Caisse"
        ordering = ['nom']

    def __str__(self):
        return f"{self.nom} ({'Ouverte' if self.est_ouvert else 'Fermée'})"


class Facture(models.Model):
    """
    Model representing a sales invoice.
    
    Optimistic Locking:
    - Utilise le champ 'version' pour éviter les conflits concurrents
    - La méthode update_with_optimistic_lock est disponible via OptimisticLockingMixin
    - Appeler depuis optimistic_locking.py: Facture.update_with_optimistic_lock(...)
    """
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
    numero_facture = models.CharField(max_length=100, blank=True, null=True, unique=True)
    date = models.DateTimeField(auto_now_add=True)
    poste_caisse = models.ForeignKey(
        'PosteCaisse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='factures_assignees',
        help_text="Poste de caisse auquel cette facture est assignée"
    )
    status = models.CharField(
        max_length=4,
        choices=Status.choices,
        default=Status.BROUILLON,
    )
    is_active = models.BooleanField(default=True)
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
    
    # Optimistic Locking - évite les verrous pessimistes (select_for_update)
    version = models.IntegerField(
        default=1,
        help_text="Version pour optimistic locking (concurrency control)"
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

    if TYPE_CHECKING:
        paiements: models.Manager['Caisse']
        produits: models.Manager['FactureProduit']

    def get_status_display(self) -> str: ...

    def __str__(self):
        return f"Facture {self.numero_facture or self.id}"
    
    def calculate_totals(self, save=True):
        """Calcule les totaux HT, TVA et TTC avec une seule requête d'agrégation (haute performance)."""
        from django.db.models import Sum, F, DecimalField, ExpressionWrapper
        
        # Agrégation SQL de base pour les totaux bruts des lignes
        # On calcule le TTC de chaque ligne directement en SQL : quantite * (prix_vente - remise_ligne)
        stats = self.produits.aggregate(
            ttc_brut=Sum(
                ExpressionWrapper(
                    F('quantity') * (F('selling_price') - F('discount')),
                    output_field=DecimalField()
                )
            ),
            # Pour la TVA et le HT, on fait une estimation agrégée ou on traite les taux distincts si nécessaire.
            # Ici, on simplifie pour le total TTC qui est le plus critique.
        )
        
        total_ttc_brut = stats['ttc_brut'] or Decimal('0.00')
        
        # Calcul de la répartition TVA (on garde la boucle ici mais optimisée avec values() pour éviter de charger les objets)
        total_ht = Decimal('0.00')
        total_tva = Decimal('0.00')
        
        lignes_data = self.produits.values('quantity', 'selling_price', 'discount', 'tva')
        for ligne in lignes_data:
            ttc_ligne = Decimal(str(ligne['quantity'])) * (ligne['selling_price'] - ligne['discount'])
            if ttc_ligne > 0:
                tva_taux = ligne['tva']
                if tva_taux > 0:
                    ht = (ttc_ligne / (1 + tva_taux / 100)).quantize(Decimal('0.01'))
                    total_ht += ht
                    total_tva += (ttc_ligne - ht)
                else:
                    total_ht += ttc_ligne

        # Application de la remise globale au prorata
        remise_globale = Decimal(str(self.remise))
        total_ttc_net = total_ttc_brut - remise_globale
        
        if total_ttc_brut > 0:
            ratio = total_ttc_net / total_ttc_brut
            self.total_ht = (total_ht * ratio).quantize(Decimal('0.01'))
            self.total_tva = (total_tva * ratio).quantize(Decimal('0.01'))
        else:
            self.total_ht = Decimal('0.00')
            self.total_tva = Decimal('0.00')
            
        self.total_ttc = total_ttc_net
        
        # Tiers Payant
        if self.client and self.client.taux_couverture > 0:
            taux_client = Decimal('100.00') - self.client.taux_couverture
            self.part_client = (self.total_ttc * max(taux_client, Decimal('0')) / Decimal('100.00')).quantize(Decimal('0.01'))
        else:
            self.part_client = self.total_ttc

        if save:
            # Crucial: update_fields évite de déclencher post_save inutilement sur d'autres colonnes
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

    @classmethod
    def update_with_optimistic_lock(cls, pk, expected_version, update_func, max_retries=3):
        """
        Mise à jour avec Optimistic Locking (sans select_for_update).
        
        Args:
            pk: ID de la facture
            expected_version: Version attendue
            update_func: Fonction de mise à jour (reçoit l'instance)
            max_retries: Nombre max de tentatives
        
        Returns:
            Tuple (facture, None) ou (None, ConcurrentModificationError)
        """
        from django.db import transaction
        from ..optimistic_locking import ConcurrentModificationError
        import time
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    facture = cls.objects.get(pk=pk)
                    
                    if facture.version != expected_version:
                        error = ConcurrentModificationError(
                            'Facture', pk, expected_version, facture.version
                        )
                        if attempt == max_retries - 1:
                            return None, error
                        time.sleep(0.1 * (2 ** attempt))
                        expected_version = cls.objects.get(pk=pk).version
                        continue
                    
                    # Appliquer les modifications
                    update_func(facture)
                    
                    # Incrémenter la version
                    facture.version += 1
                    facture.save(update_fields=['version'])
                    
                    return facture, None
                    
            except cls.DoesNotExist:
                raise
        
        return None, ConcurrentModificationError('Facture', pk, expected_version, -1)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['-date']),
            GinIndex(fields=['numero_facture'], name='facture_num_trgm_idx', opclasses=['gin_trgm_ops']),
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
    treatment_duration_days = models.IntegerField(
        null=True, blank=True,
        help_text="Durée du traitement en jours pour ce produit (pour rappels chroniques)"
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
    id: int
    facture_produit = models.ForeignKey(
        'FactureProduit', on_delete=models.CASCADE, related_name='allocations'
    )
    stock_lot = models.ForeignKey('StockLot', on_delete=models.PROTECT, null=True, blank=True)
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
    id: int
    MODES_PAIEMENT = [
        ('especes', 'Espèces'),
        ('cheque', 'Chèque'),
        ('carte', 'Carte'),
        ('virement', 'Virement'),
        ('om', 'Orange Money'),
        ('momo', 'Mobile Money'),
        ('coupon', 'Coupon'),
        ('en_compte', 'En compte'),
        ('depot', 'Dépôt/Acompte'),
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
    
    def get_mode_paiement_display(self) -> str: ...
    def get_statut_display(self) -> str: ...
    
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
        related_name='clotures_caisse',
        help_text="Le caissier dont la caisse est clôturée"
    )
    cloture_par = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='clotures_effectuees',
        help_text="L'utilisateur (admin) ayant effectué la clôture"
    )
    observation = models.TextField(blank=True, null=True, help_text="Notes ou observations sur la clôture")
    poste_caisse = models.ForeignKey(
        'PosteCaisse', on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='clotures',
        help_text="Le poste de caisse physique associé"
    )
    
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
    
    numero = models.CharField(max_length=50, unique=True, editable=False)
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
    id: int
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
    is_active = models.BooleanField(default=True, help_text="Promis actif (non supprimé dans la corbeille)")
    
    def get_status_display(self) -> str: ...

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
    # Guard against recursive signal: calculate_totals(save=True) triggers post_save again
    if getattr(instance, '_skip_recalculate', False):
        return
    update_fields = kwargs.get('update_fields')
    if update_fields and ('total_ht' in update_fields or 'total_ttc' in update_fields):
        return
    if not created:
        instance._skip_recalculate = True
        try:
            instance.calculate_totals(save=True)
        finally:
            instance._skip_recalculate = False


