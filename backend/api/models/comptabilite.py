# -*- coding: utf-8 -*-
from django.db import models
from django.db.models import Sum
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal

class CompteComptable(models.Model):
    """
    Modèle pour le Plan Comptable (OHADA).
    """
    class Type(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        PASSIF = 'PASSIF', 'Passif'
        CHARGE = 'CHARGE', 'Charge'
        PRODUIT = 'PRODUIT', 'Produit'

    numero = models.CharField(max_length=20, unique=True, help_text="Numéro de compte (ex: 701100)")
    libelle = models.CharField(max_length=200)
    type = models.CharField(max_length=10, choices=Type.choices)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = "Compte Comptable"
        verbose_name_plural = "Comptes Comptables"
        ordering = ['numero']

    def __str__(self):
        return f"{self.numero} - {self.libelle}"


class JournalComptable(models.Model):
    """
    Journaux comptables (Ventes, Achats, Caisse, Banque, OD).
    """
    code = models.CharField(max_length=10, unique=True)
    nom = models.CharField(max_length=100)

    class Meta:
        verbose_name = "Journal Comptable"
        verbose_name_plural = "Journaux Comptables"

    def __str__(self):
        return f"{self.code} - {self.nom}"


class ExerciceComptable(models.Model):
    """
    Période fiscale (généralement du 01/01 au 31/12).
    """
    nom = models.CharField(max_length=100, help_text="Ex: Exercice 2026")
    date_debut = models.DateField()
    date_fin = models.DateField()
    est_cloture = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Exercice Comptable"
        verbose_name_plural = "Exercices Comptables"
        ordering = ['-date_debut']

    def __str__(self):
        status = "[CLOTURÉ]" if self.est_cloture else "[EN COURS]"
        return f"{self.nom} ({self.date_debut} au {self.date_fin}) {status}"


class EcritureComptable(models.Model):
    """
    Une écriture (pièce) comptable regroupant plusieurs lignes.
    """
    date = models.DateField(default=timezone.now)
    exercice = models.ForeignKey(ExerciceComptable, on_delete=models.PROTECT, related_name='ecritures', null=True, blank=True)
    journal = models.ForeignKey(JournalComptable, on_delete=models.PROTECT, related_name='ecritures')
    numero_piece = models.CharField(max_length=30, unique=True, blank=True, null=True,
                                    help_text="Numéro folioté OHADA (EX2026-VT-00001)")
    reference = models.CharField(max_length=100, help_text="N° de facture ou référence pièce")
    libelle = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Liens optionnels vers les objets métiers pour traçabilité
    facture = models.ForeignKey('Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='ecritures_compta')
    commande = models.ForeignKey('Commande', on_delete=models.SET_NULL, null=True, blank=True, related_name='ecritures_compta')
    paiement = models.ForeignKey('Caisse', on_delete=models.SET_NULL, null=True, blank=True, related_name='ecritures_compta')
    paiement_fournisseur = models.ForeignKey('PaiementFournisseur', on_delete=models.SET_NULL, null=True, blank=True, related_name='ecritures_compta')

    class Meta:
        verbose_name = "Écriture Comptable"
        verbose_name_plural = "Écritures Comptables"
        ordering = ['exercice', 'journal', 'numero_piece']
        unique_together = [['exercice', 'journal', 'numero_piece']]

    def save(self, *args, **kwargs):
        # Validation OHADA: Exercice obligatoire et non cloturé
        if not self.exercice_id:
            raise ValidationError("Une écriture doit obligatoirement appartenir à un exercice comptable.")
        
        # Charger l'exercice si pas encore fait (sécurité)
        exercice = self.exercice
        if exercice.est_cloture:
            raise ValidationError(f"L'exercice {exercice.nom} est cloturé. Aucune écriture n'est possible.")
        
        # Génération du numéro de pièce (foliotage OHADA)
        if not self.numero_piece:
            self.numero_piece = self._generer_numero_piece()
        
        super().save(*args, **kwargs)
    
    def _generer_numero_piece(self):
        """Génère un numéro de pièce unique selon le format OHADA: EX{année}-{journal}-{séquence}"""
        exercice_nom = self.exercice.nom.replace(' ', '').replace('.', '')[:6]  # EX2026
        journal_code = self.journal.code  # VT, AC, CA, BQ...
        
        # Trouver le numéro de séquence le plus élevé pour ce journal et exercice
        prefix = f"{exercice_nom}-{journal_code}-"
        last_piece = EcritureComptable.objects.filter(
            exercice=self.exercice,
            journal=self.journal,
            numero_piece__startswith=prefix
        ).order_by('-numero_piece').first()
        
        if last_piece:
            try:
                # Extraire la séquence numérique (ex: 00015 -> 15)
                last_seq = int(last_piece.numero_piece.split('-')[-1])
                next_seq = last_seq + 1
            except (ValueError, IndexError):
                # Fallback sur le count si le format est bizarre
                next_seq = EcritureComptable.objects.filter(
                    exercice=self.exercice,
                    journal=self.journal
                ).count() + 1
        else:
            next_seq = 1
        
        sequence = str(next_seq).zfill(5)  # 00001, 00002...
        return f"{prefix}{sequence}"
    
    def clean(self):
        super().clean()
        # Validation supplémentaire au niveau modèle
        if self.exercice and self.date:
            if self.date < self.exercice.date_debut or self.date > self.exercice.date_fin:
                raise ValidationError(
                    f"La date de l'écriture ({self.date}) doit être comprise dans l'exercice "
                    f"({self.exercice.date_debut} au {self.exercice.date_fin})."
                )

    def __str__(self):
        return f"{self.date} | {self.journal.code} | {self.reference} | {self.libelle}"

    @property
    def total_debit(self):
        return self.lignes.aggregate(models.Sum('debit'))['debit__sum'] or Decimal('0.00')

    @property
    def total_credit(self):
        return self.lignes.aggregate(models.Sum('credit'))['credit__sum'] or Decimal('0.00')

    def is_balanced(self):
        return self.total_debit == self.total_credit


class LigneEcriture(models.Model):
    """
    Une ligne au sein d'une écriture comptable.
    """
    ecriture = models.ForeignKey(EcritureComptable, on_delete=models.CASCADE, related_name='lignes')
    compte = models.ForeignKey(CompteComptable, on_delete=models.PROTECT, related_name='lignes')
    libelle_ligne = models.CharField(max_length=255, blank=True)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    class Meta:
        verbose_name = "Ligne d'Écriture"
        verbose_name_plural = "Lignes d'Écritures"

    def __str__(self):
        return f"{self.compte.numero} | D:{self.debit} | C:{self.credit}"


class Lettrage(models.Model):
    """
    Lettrage des comptes tiers (411-Clients, 401-Fournisseurs).
    Permet de marquer les lignes d'écriture comme compensées/lettrees.
    """
    code = models.CharField(max_length=20, unique=True, help_text="Code lettrage automatique (L-2024-0001)")
    date_lettrage = models.DateField(default=timezone.now)
    compte_tiers = models.ForeignKey(CompteComptable, on_delete=models.PROTECT, 
                                     limit_choices_to={'numero__startswith': '4'},
                                     help_text="Compte tiers (411xxx ou 401xxx)")
    # Lignes lettrees (factures + paiements)
    lignes = models.ManyToManyField(LigneEcriture, related_name='lettrages')
    
    # Solde du lettrage (doit être = 0 pour être équilibré)
    montant_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Statut
    est_equilibre = models.BooleanField(default=False, help_text="True si Débit = Crédit du lettrage")
    commentaire = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        verbose_name = "Lettrage"
        verbose_name_plural = "Lettrages"
        ordering = ['-date_lettrage', '-created_at']
    
    def save(self, *args, **kwargs):
        if not self.code:
            from datetime import datetime
            year = datetime.now().year
            count = Lettrage.objects.filter(date_lettrage__year=year).count()
            self.code = f"L-{year}-{str(count + 1).zfill(4)}"
        
        # Calculer le solde
        if self.pk:  # Si déjà sauvegardé
            total_debit = self.lignes.aggregate(Sum('debit'))['debit__sum'] or Decimal('0.00')
            total_credit = self.lignes.aggregate(Sum('credit'))['credit__sum'] or Decimal('0.00')
            self.montant_total = total_debit - total_credit
            self.est_equilibre = (total_debit == total_credit)
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.code} | {self.compte_tiers.numero} | Équilibré: {self.est_equilibre}"
