from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.utils import timezone


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
    avoir_client = models.ForeignKey('AvoirClient', on_delete=models.SET_NULL, null=True, blank=True, related_name='ecritures_compta')
    mouvement_caisse = models.ForeignKey('MouvementCaisse', on_delete=models.SET_NULL, null=True, blank=True, related_name='ecritures_compta')

    # Écritures générées par signal sans FK dédiée — identifiées par la
    # référence système (préfixe). Toute autre écriture auto est liée par FK.
    REFERENCES_AUTO = ('MST-', 'IMMO-', 'RECL-CHARGE-')

    class Meta:
        verbose_name = "Écriture Comptable"
        verbose_name_plural = "Écritures Comptables"
        ordering = ['exercice', 'journal', 'numero_piece']
        unique_together = [['exercice', 'journal', 'numero_piece']]
        indexes = [
            # Perf (migration 0262) — index créé en CONCURRENTLY
            models.Index(fields=['date'], name='ecriture_date_idx'),
        ]

    @property
    def est_liee(self):
        """True si l'écriture est générée depuis/liée à un document métier.

        Modifier ou supprimer une telle écriture créerait une discordance
        avec sa source (commande, facture, caisse, stock, immobilisation) :
        la correction doit se faire sur le document d'origine.
        """
        if any((
            self.facture_id, self.commande_id, self.paiement_id,
            self.paiement_fournisseur_id, self.avoir_client_id,
            self.mouvement_caisse_id,
        )):
            return True
        if self.dotations_amortissement.exists():
            return True
        return (self.reference or '').startswith(self.REFERENCES_AUTO)

    def save(self, *args, **kwargs):
        # Validation OHADA: Exercice obligatoire et non cloturé
        if not self.exercice_id:
            raise ValidationError("Une écriture doit obligatoirement appartenir à un exercice comptable.")
        
        # Charger l'exercice si pas encore fait (sécurité)
        exercice = self.exercice
        if exercice.est_cloture:
            raise ValidationError(f"L'exercice {exercice.nom} est cloturé. Aucune écriture n'est possible.")
        
        # Génération du numéro de pièce (foliotage OHADA) : compteur + insert
        # dans la même transaction — hors transaction appelante, un échec de
        # l'insert ne laisserait sinon un trou dans la séquence.
        from django.db import transaction
        with transaction.atomic():
            if not self.numero_piece:
                self.numero_piece = self._generer_numero_piece()

            super().save(*args, **kwargs)
    
    def _generer_numero_piece(self):
        """Génère un numéro de pièce unique selon le format OHADA: EX{année}-{journal}-{séquence}

        La séquence vit dans DocumentCounter (ligne verrouillée en
        select_for_update) : deux écritures concurrentes du même journal ne
        peuvent pas tirer le même numéro — l'ancien Max()+1 finissait en
        IntegrityError sous charge."""
        from django.db.models import IntegerField, Max
        from django.db.models.functions import Cast, Substr
        from .billing import DocumentCounter

        exercice_nom = self.exercice.nom.replace(' ', '').replace('.', '')[:6]  # EX2026
        journal_code = self.journal.code  # VT, AC, CA, BQ...
        prefix = f"{exercice_nom}-{journal_code}"

        def max_seq_existant():
            # Amorce du compteur : max déjà émis pour ce préfixe.
            # Format: EX2026-CA-00015 -> extraire 00015 -> 15
            return EcritureComptable.objects.filter(
                exercice=self.exercice,
                journal=self.journal,
                numero_piece__startswith=f"{prefix}-"
            ).annotate(
                seq_str=Substr('numero_piece', len(prefix) + 2, 10)
            ).aggregate(
                max_seq=Max(Cast('seq_str', output_field=IntegerField()))
            )['max_seq'] or 0

        from django.db import transaction
        with transaction.atomic():
            counter, _ = DocumentCounter.objects.select_for_update().get_or_create(
                name=prefix, defaults={'value': max_seq_existant()})
            counter.value += 1
            counter.save(update_fields=['value'])
        return f"{prefix}-{counter.value:05d}"
    
    def clean(self):
        super().clean()
        # Validation supplémentaire au niveau modèle
        if self.exercice and self.date and (self.date < self.exercice.date_debut or self.date > self.exercice.date_fin):
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


class Immobilisation(models.Model):
    """Immobilisation amortissable (linéaire, prorata temporis l'année 1).

    Écritures : acquisition générée par signal (D compte_immo / C trésorerie
    ou 404100), dotations annuelles via action `generer_dotation`
    (D 681100 / C compte_amortissement)."""

    class ModePaiement(models.TextChoices):
        ESPECES = 'especes', 'Espèces'
        BANQUE = 'banque', 'Banque'
        CREDIT = 'credit', 'Crédit fournisseur'

    nom = models.CharField(max_length=200)
    compte_immo = models.ForeignKey(
        CompteComptable, on_delete=models.PROTECT, related_name='immobilisations',
        help_text='Compte d\'immobilisation (classe 2 : 241, 244, 245…)')
    compte_amortissement = models.ForeignKey(
        CompteComptable, on_delete=models.PROTECT,
        related_name='amortissements_immobilisations',
        help_text='Compte d\'amortissements (28x)')
    date_acquisition = models.DateField()
    valeur_acquisition = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))])
    duree_annees = models.PositiveIntegerField(
        default=5, help_text='Durée d\'amortissement linéaire en années')
    valeur_residuelle = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))])
    mode_paiement = models.CharField(
        max_length=10, choices=ModePaiement.choices, default=ModePaiement.BANQUE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Immobilisation"
        ordering = ['-date_acquisition']

    def __str__(self):
        return f"{self.nom} ({self.valeur_acquisition} F sur {self.duree_annees} ans)"

    @property
    def base_amortissable(self):
        return self.valeur_acquisition - self.valeur_residuelle

    @property
    def dotation_annuelle(self):
        return self.base_amortissable / self.duree_annees

    def montant_dotation(self, annee):
        """Dotation de l'année : prorata temporis l'année d'acquisition."""
        total_mois = self.duree_annees * 12
        if total_mois <= 0:
            return Decimal('0.00')
        debut = max(0, min(total_mois, (annee - self.date_acquisition.year) * 12 - self.date_acquisition.month + 1))
        fin = max(0, min(total_mois, (annee + 1 - self.date_acquisition.year) * 12 - self.date_acquisition.month + 1))
        cumul_debut = (self.base_amortissable * debut / total_mois).quantize(Decimal('0.01'))
        cumul_fin = (self.base_amortissable * fin / total_mois).quantize(Decimal('0.01'))
        return cumul_fin - cumul_debut

    @property
    def cumul_amortissements(self):
        return self.dotations.aggregate(
            models.Sum('montant'))['montant__sum'] or Decimal('0.00')

    @property
    def valeur_nette_comptable(self):
        return self.valeur_acquisition - self.cumul_amortissements


class DotationAmortissement(models.Model):
    """Dotation aux amortissements générée pour une immobilisation/année."""
    immobilisation = models.ForeignKey(
        Immobilisation, on_delete=models.CASCADE, related_name='dotations')
    annee = models.PositiveIntegerField()
    montant = models.DecimalField(max_digits=14, decimal_places=2)
    ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dotations_amortissement')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['immobilisation', 'annee']]
        ordering = ['immobilisation', 'annee']

    def __str__(self):
        return f"{self.immobilisation.nom} — dotation {self.annee} ({self.montant})"


class LigneEcriture(models.Model):
    """
    Une ligne au sein d'une écriture comptable.
    """
    ecriture = models.ForeignKey(EcritureComptable, on_delete=models.CASCADE, related_name='lignes')
    compte = models.ForeignKey(CompteComptable, on_delete=models.PROTECT, related_name='lignes')
    libelle_ligne = models.CharField(max_length=255, blank=True)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = "Ligne d'Écriture"
        verbose_name_plural = "Lignes d'Écritures"
        indexes = [
            # Perf (migration 0262) — index créé en CONCURRENTLY
            models.Index(fields=['compte', 'ecriture'], name='ligneecriture_compte_ecr_idx'),
        ]

    def __str__(self):
        return f"{self.compte.numero} | D:{self.debit} | C:{self.credit}"


class Regularisation(models.Model):
    """Écriture de régularisation d'inventaire (cut-off) avec extourne
    automatique au premier jour de l'exercice suivant.

    Sens des écritures (plan local) :
    - CCA 481000 (actif)   : D 481 / C compte charge   → extourne D charge / C 481
    - PCA 486000 (passif)  : D compte produit / C 486  → extourne D 486 / C produit
    - CAP 482000 (passif)  : D compte charge / C 482   → extourne D 482 / C charge
    - PAR 487000 (actif)   : D 487 / C compte produit  → extourne D produit / C 487
    """

    class Type(models.TextChoices):
        CCA = 'CCA', "Charge constatée d'avance"
        PCA = 'PCA', "Produit constaté d'avance"
        CAP = 'CAP', "Charge à payer"
        PAR = 'PAR', "Produit à recevoir"

    # type → (numéro compte de régularisation, type attendu du compte de
    # charge/produit, le compte de régularisation est-il débité à l'initiale ?)
    PARAMS = {
        'CCA': ('481000', 'CHARGE', True),
        'PCA': ('486000', 'PRODUIT', False),
        'CAP': ('482000', 'CHARGE', False),
        'PAR': ('487000', 'PRODUIT', True),
    }

    type = models.CharField(max_length=3, choices=Type.choices)
    compte = models.ForeignKey(
        CompteComptable, on_delete=models.PROTECT, related_name='regularisations',
        help_text='Compte de charge (CCA/CAP) ou de produit (PCA/PAR)')
    montant = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))])
    date = models.DateField()
    description = models.CharField(max_length=255)
    ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='regularisations')
    extourne_ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='regularisations_extournees')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Régularisation"
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.type} | {self.compte.numero} | {self.montant} | {self.date}"


class CreanceDouteuse(models.Model):
    """Dépréciation d'une créance client marquée manuellement.

    Marquage      : D 691000 / C 491000
    Recouvrement  : D 491000 / C 781000
    Irrécouvrable : D 651000 / C 411100 (perte) + D 491000 / C 781000 (reprise)
    """

    class Statut(models.TextChoices):
        DOUTEUSE = 'douteuse', 'Douteuse'
        RECOUVREE = 'recouvree', 'Recouvrée'
        IRRECOUVRABLE = 'irrecouvrable', 'Irrécouvrable'

    client = models.ForeignKey(
        'Client', on_delete=models.PROTECT, related_name='creances_douteuses')
    montant = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))])
    statut = models.CharField(
        max_length=15, choices=Statut.choices, default=Statut.DOUTEUSE)
    commentaire = models.CharField(max_length=255, blank=True)
    dotation_ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='depreciations_clients')
    sortie_ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sorties_depreciations_clients',
        help_text='OD de reprise (recouvrement ou perte)')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Créance douteuse"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client} | {self.montant} | {self.get_statut_display()}"


class DepreciationStock(models.Model):
    """Dotation annuelle (ou périodique) de dépréciation du stock périmé :
    D 691000 / C 391000 — reprise D 391000 / C 781000."""

    class Statut(models.TextChoices):
        DOTEE = 'dotee', 'Dotée'
        REPRISE = 'reprise', 'Reprise'

    libelle = models.CharField(max_length=255)
    montant = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))])
    statut = models.CharField(
        max_length=10, choices=Statut.choices, default=Statut.DOTEE)
    dotation_ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='depreciations_stock')
    reprise_ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reprises_depreciations_stock')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Dépréciation de stock"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.libelle} | {self.montant} | {self.get_statut_display()}"


class Employe(models.Model):
    """Employé pour le suivi des paies mensuelles."""

    nom = models.CharField(max_length=200)
    poste = models.CharField(max_length=100, blank=True)
    salaire_brut = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0.00'),
        help_text="Brut mensuel de référence pré-rempli à la saisie")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Employé"
        ordering = ['nom']

    def __str__(self):
        return self.nom


class PaieMois(models.Model):
    """Paie mensuelle d'un employé.

    OD générée (journal PA) : D 661 brut, D 664 charges patronales /
    C 422 net à payer, C 431 cotisations totales, C 447 IRPP."""

    class Statut(models.TextChoices):
        BROUILLON = 'brouillon', 'Brouillon'
        COMPTABILISEE = 'comptabilisee', 'Comptabilisée'

    employe = models.ForeignKey(
        Employe, on_delete=models.PROTECT, related_name='paies')
    mois = models.DateField(help_text='Toujours le 1er du mois')
    brut = models.DecimalField(max_digits=14, decimal_places=2,
                               validators=[MinValueValidator(Decimal('0'))])
    cotisations_salariales = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Part salariale CNPS et assimilées')
    irpp = models.DecimalField(max_digits=14, decimal_places=2,
                               default=Decimal('0.00'),
                               validators=[MinValueValidator(Decimal('0'))])
    charges_patronales = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))])
    statut = models.CharField(
        max_length=15, choices=Statut.choices, default=Statut.BROUILLON)
    ecriture = models.ForeignKey(
        EcritureComptable, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='paies')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Paie mensuelle"
        unique_together = [['employe', 'mois']]
        ordering = ['-mois', 'employe__nom']

    @property
    def net_a_payer(self):
        return self.brut - self.cotisations_salariales - self.irpp

    def __str__(self):
        return f"{self.employe.nom} | {self.mois:%Y-%m} | {self.net_a_payer}"


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
