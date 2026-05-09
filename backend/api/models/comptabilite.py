# -*- coding: utf-8 -*-
from django.db import models
from django.utils import timezone
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
        ordering = ['-date', '-created_at']

    def save(self, *args, **kwargs):
        # Assigner automatiquement l'exercice si non précisé
        if not self.exercice and self.date:
            exercice = ExerciceComptable.objects.filter(
                date_debut__lte=self.date, 
                date_fin__gte=self.date,
                est_cloture=False
            ).first()
            if exercice:
                self.exercice = exercice
        super().save(*args, **kwargs)

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
