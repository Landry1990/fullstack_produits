from decimal import Decimal

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import (
    AvoirClient,
    Caisse,
    Commande,
    CompteComptable,
    EcritureComptable,
    ExerciceComptable,
    Facture,
    JournalComptable,
    LigneEcriture,
    MouvementCaisse,
    MouvementStock,
    PaiementFournisseur,
)


def get_exercice_courant():
    """Récupère l'exercice comptable en cours, ou en crée un par défaut."""
    today = timezone.now().date()
    exercice = ExerciceComptable.objects.filter(
        date_debut__lte=today,
        date_fin__gte=today,
        est_cloture=False
    ).first()
    
    if not exercice:
        # Créer un exercice par défaut pour l'année courante
        year = today.year
        exercice, _ = ExerciceComptable.objects.get_or_create(
            nom=f"Exercice {year}",
            defaults={
                'date_debut': f"{year}-01-01",
                'date_fin': f"{year}-12-31",
                'est_cloture': False
            }
        )
    
    return exercice

@receiver(post_save, sender=PaiementFournisseur)
def generer_ecriture_paiement_fournisseur(sender, instance, created, **kwargs):
    """Génère les écritures de règlement fournisseur (Débit 401, Crédit 571/521)."""
    if getattr(instance.fournisseur, 'is_divers', False):
        return
        
    with transaction.atomic():
        # Déterminer le journal et le compte de trésorerie
        is_cash = instance.mode_paiement == 'ESP'
        code_j = 'CA' if is_cash else 'BQ'
        nom_j = 'Caisse' if is_cash else 'Banque'
        journal, _ = JournalComptable.objects.get_or_create(code=code_j, defaults={'nom': nom_j})
        
        # Référence de l'écriture
        ref = instance.reference or f"PAI_FOURN_{instance.id}"
        
        ecriture, created_ecr = EcritureComptable.objects.get_or_create(
            paiement_fournisseur=instance,
            defaults={
                'reference': ref,
                'journal': journal,
                'exercice': get_exercice_courant(),
                'date': instance.date_paiement,
                'libelle': f"Règlement Fournisseur {instance.fournisseur.name} ({instance.get_mode_paiement_display()})"
            }
        )
        
        if not created_ecr:
            ecriture.date = instance.date_paiement
            ecriture.reference = ref
            if not ecriture.exercice_id:
                ecriture.exercice = get_exercice_courant()
            ecriture.save()
        
        # Nettoyage des anciennes lignes si mise à jour
        ecriture.lignes.all().delete()
        
        # 1. Débit Fournisseur (401100) - On réduit la dette
        compte_fourn, _ = CompteComptable.objects.get_or_create(
            numero='401100', defaults={'libelle': 'Fournisseurs', 'type': 'PASSIF'}
        )
        LigneEcriture.objects.create(ecriture=ecriture, compte=compte_fourn, debit=instance.montant)
        
        # 2. Crédit Trésorerie (Caisse ou Banque)
        compte_t = '571100' if is_cash else '521100'
        lib_t = 'Caisse' if is_cash else 'Banque'
        compte_treso, _ = CompteComptable.objects.get_or_create(
            numero=compte_t, defaults={'libelle': lib_t, 'type': 'ACTIF'}
        )
        LigneEcriture.objects.create(ecriture=ecriture, compte=compte_treso, credit=instance.montant)

import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Facture)
def generer_ecriture_vente(sender, instance, created, **kwargs):
    """Génère les écritures de vente automatiquement (Journal VT) - TOLÉRANT AUX ERREURS."""
    # Exclure les factures contenant des produits divers
    try:
        if instance.produits.filter(allocations__stock_lot__is_divers=True).exists():
            return

        if instance.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE] and instance.is_active:
            with transaction.atomic():
                journal, _ = JournalComptable.objects.get_or_create(code='VT', defaults={'nom': 'Ventes'})
                
                ecriture, created_ecr = EcritureComptable.objects.get_or_create(
                    facture=instance,
                    defaults={
                        'date': instance.date.date(),
                        'journal': journal,
                        'exercice': get_exercice_courant(),
                        'reference': instance.numero_facture or f"F{instance.id}",
                        'libelle': f"Vente Facture {instance.numero_facture or instance.id}"
                    }
                )
                
                # Mise à jour si déjà existant
                if not created_ecr:
                    ecriture.date = instance.date.date()
                    ecriture.reference = instance.numero_facture or f"F{instance.id}"
                    if not ecriture.exercice_id:
                        ecriture.exercice = get_exercice_courant()
                    ecriture.save()
                
                ecriture.lignes.all().delete()
                
                # Débit Client (411100) - TTC
                compte_client, _ = CompteComptable.objects.get_or_create(
                    numero='411100', defaults={'libelle': 'Clients', 'type': 'ACTIF'}
                )
                LigneEcriture.objects.create(ecriture=ecriture, compte=compte_client, debit=instance.total_ttc)
                
                # Crédit Ventes (701100) - HT
                compte_ventes, _ = CompteComptable.objects.get_or_create(
                    numero='701100', defaults={'libelle': 'Ventes de marchandises', 'type': 'PRODUIT'}
                )
                LigneEcriture.objects.create(ecriture=ecriture, compte=compte_ventes, credit=instance.total_ht)
                
                # Crédit TVA Collectée (443100)
                if instance.total_tva > 0:
                    compte_tva, _ = CompteComptable.objects.get_or_create(
                        numero='443100', defaults={'libelle': 'TVA Collectée', 'type': 'PASSIF'}
                    )
                    LigneEcriture.objects.create(ecriture=ecriture, compte=compte_tva, credit=instance.total_tva)
                    
                logger.info(f"[COMPTA] Écriture vente créée pour facture {instance.id}")
                
    except Exception as e:
        # IMPORTANT : Ne jamais bloquer la vente ! Logger l'erreur pour correction manuelle
        logger.error(f"[COMPTA] ERREUR création écriture vente pour facture {instance.id}: {e!s}")
        logger.error("[COMPTA] L'écriture devra être créée manuellement ou via la commande de régénération")


@receiver(post_save, sender=Caisse)
def generer_ecriture_paiement(sender, instance, created, **kwargs):
    """Génère les écritures de règlement (Journal CA ou BQ) - TOLÉRANT AUX ERREURS."""
    try:
        if instance.facture and instance.facture.produits.filter(allocations__stock_lot__is_divers=True).exists():
            return

        if instance.statut == 'completee':
            with transaction.atomic():
                is_cash = instance.mode_paiement == 'especes'
                code_j = 'CA' if is_cash else 'BQ'
                nom_j = 'Caisse' if is_cash else 'Banque'
                journal, _ = JournalComptable.objects.get_or_create(code=code_j, defaults={'nom': nom_j})
                
                ecriture, created_ecr = EcritureComptable.objects.get_or_create(
                    paiement=instance,
                    defaults={
                        'date': instance.date_paiement.date(),
                        'journal': journal,
                        'exercice': get_exercice_courant(),
                        'reference': instance.facture.numero_facture or f"F{instance.facture.id}",
                        'libelle': f"Règlement {instance.get_mode_paiement_display()} Fact {instance.facture.numero_facture or instance.facture.id}"
                    }
                )
                
                if not created_ecr:
                    ecriture.date = instance.date_paiement.date()
                    if not ecriture.exercice_id:
                        ecriture.exercice = get_exercice_courant()
                    ecriture.save()
                
                ecriture.lignes.all().delete()
                
                # Débit Trésorerie
                compte_t = '571100' if is_cash else '521100'
                lib_t = 'Caisse' if is_cash else 'Banque'
                compte_treso, _ = CompteComptable.objects.get_or_create(
                    numero=compte_t, defaults={'libelle': lib_t, 'type': 'ACTIF'}
                )
                LigneEcriture.objects.create(ecriture=ecriture, compte=compte_treso, debit=instance.montant)
                
                # Crédit Client
                compte_client, _ = CompteComptable.objects.get_or_create(
                    numero='411100', defaults={'libelle': 'Clients', 'type': 'ACTIF'}
                )
                LigneEcriture.objects.create(ecriture=ecriture, compte=compte_client, credit=instance.montant)
                
                logger.info(f"[COMPTA] Écriture paiement créée pour caisse {instance.id}")
                
    except Exception as e:
        # IMPORTANT : Ne jamais bloquer le paiement ! Logger l'erreur pour correction manuelle
        logger.error(f"[COMPTA] ERREUR création écriture paiement pour caisse {instance.id}: {e!s}")
        logger.error("[COMPTA] L'écriture devra être créée manuellement ou via la commande de régénération")


@receiver(post_save, sender=Commande)
def generer_ecriture_achat(sender, instance, created, **kwargs):
    """Génère les écritures d'achat lors de la réception de commande (Journal AC)."""
    if getattr(instance, 'type', '') == 'DIV' or (instance.fournisseur and getattr(instance.fournisseur, 'is_divers', False)):
        return

    # Utilisation du statut correct 'CLOT' (Clôturée)
    if instance.status == 'CLOT' and instance.is_active:
        with transaction.atomic():
            journal, _ = JournalComptable.objects.get_or_create(code='AC', defaults={'nom': 'Achats'})
            
            ecriture, created_ecr = EcritureComptable.objects.get_or_create(
                commande=instance,
                defaults={
                    'date': (instance.date_cloture or instance.date or timezone.now()).date(),
                    'journal': journal,
                    'exercice': get_exercice_courant(),
                    'reference': instance.numero_facture or f"BC{instance.id}",
                    'libelle': f"Achat Fournisseur {instance.fournisseur.name if instance.fournisseur else instance.fournisseur_nom}"
                }
            )
            
            # Mise à jour si déjà existant (re-clôture ou correction)
            if not created_ecr:
                ecriture.date = (instance.date_cloture or instance.date or timezone.now()).date()
                ecriture.reference = instance.numero_facture or f"BC{instance.id}"
                if not ecriture.exercice_id:
                    ecriture.exercice = get_exercice_courant()
                ecriture.save()

            ecriture.lignes.all().delete()
            
            # Débit Achats (601100)
            compte_achats, _ = CompteComptable.objects.get_or_create(
                numero='601100', defaults={'libelle': 'Achats de marchandises', 'type': 'CHARGE'}
            )
            LigneEcriture.objects.create(ecriture=ecriture, compte=compte_achats, debit=instance.total_ht)
            
            # Crédit Fournisseur (401100)
            compte_fourn, _ = CompteComptable.objects.get_or_create(
                numero='401100', defaults={'libelle': 'Fournisseurs', 'type': 'PASSIF'}
            )
            LigneEcriture.objects.create(ecriture=ecriture, compte=compte_fourn, credit=instance.total_ttc)
            
            # Débit TVA déductible (445100)
            if instance.total_tva > 0:
                compte_tva, _ = CompteComptable.objects.get_or_create(
                    numero='445100', defaults={'libelle': 'TVA Déductible', 'type': 'ACTIF'}
                )
                LigneEcriture.objects.create(ecriture=ecriture, compte=compte_tva, debit=instance.total_tva)


def _compte(numero, libelle, type_):
    compte, _ = CompteComptable.objects.get_or_create(
        numero=numero, defaults={'libelle': libelle, 'type': type_})
    return compte


def _ecriture(journal_code, journal_nom, date, reference, libelle, **links):
    """Crée/met à jour l'écriture liée à l'objet métier et vide ses lignes."""
    journal, _ = JournalComptable.objects.get_or_create(
        code=journal_code, defaults={'nom': journal_nom})
    ecriture, created = EcritureComptable.objects.get_or_create(
        defaults={'date': date, 'journal': journal,
                  'exercice': get_exercice_courant(),
                  'reference': reference, 'libelle': libelle},
        **links)
    if not created:
        ecriture.date = date
        ecriture.reference = reference
        if not ecriture.exercice_id:
            ecriture.exercice = get_exercice_courant()
        ecriture.save()
    ecriture.lignes.all().delete()
    return ecriture


@receiver(post_save, sender=AvoirClient)
def generer_ecriture_avoir(sender, instance, created, **kwargs):
    """Avoir client validé → journal AV : D 701100 + D 443100 / C 411100."""
    try:
        if instance.statut != AvoirClient.Statut.VALIDEE:
            return
        with transaction.atomic():
            total_ht = total_tva = Decimal('0.00')
            for l in instance.lignes.all():
                ttc_ligne = (l.prix_unitaire * l.quantity) - l.remise
                ht_ligne = ttc_ligne / (Decimal('1') + l.tva / Decimal('100'))
                total_ht += ht_ligne
                total_tva += ttc_ligne - ht_ligne

            ecriture = _ecriture(
                'AV', 'Avoirs clients', instance.date, instance.numero,
                f"Avoir client {instance.numero} ({instance.get_type_motif_display()})",
                avoir_client=instance)

            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=_compte('701100', 'Ventes de marchandises', 'PRODUIT'),
                debit=total_ht)
            if total_tva > 0:
                LigneEcriture.objects.create(
                    ecriture=ecriture,
                    compte=_compte('443100', 'TVA Collectée', 'PASSIF'),
                    debit=total_tva)
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=_compte('411100', 'Clients', 'ACTIF'),
                credit=instance.montant_total)
            logger.info(f"[COMPTA] Écriture avoir créée pour {instance.numero}")
    except Exception as e:
        logger.error(f"[COMPTA] ERREUR écriture avoir {instance.numero}: {e!s}")


@receiver(post_save, sender=MouvementCaisse)
def generer_ecriture_mouvement_caisse(sender, instance, created, **kwargs):
    """Mouvement de caisse → journal CA/BQ :
    - remboursement avoir : D 411100 / C trésorerie
    - entrée diverse      : D trésorerie / C 758100
    - sortie diverse      : D 658100 / C trésorerie
    """
    try:
        if not created:
            return
        with transaction.atomic():
            is_cash = instance.mode_paiement in ('especes', 'cash')
            treso = _compte('571100' if is_cash else '521100',
                            'Caisse' if is_cash else 'Banque', 'ACTIF')
            is_refund = (instance.motif or '').startswith('Remboursement avoir client')

            ecriture = _ecriture(
                'CA' if is_cash else 'BQ',
                'Caisse' if is_cash else 'Banque',
                instance.date.date(),
                f"MOUV-{instance.id}", instance.motif or f"Mouvement caisse {instance.id}",
                mouvement_caisse=instance)

            if is_refund:
                LigneEcriture.objects.create(
                    ecriture=ecriture, compte=_compte('411100', 'Clients', 'ACTIF'),
                    debit=instance.montant)
            elif instance.type == 'ENTREE':
                LigneEcriture.objects.create(
                    ecriture=ecriture, compte=treso, debit=instance.montant)
                LigneEcriture.objects.create(
                    ecriture=ecriture,
                    compte=_compte('758100', 'Produits divers', 'PRODUIT'),
                    credit=instance.montant)
                return
            else:  # SORTIE diverse
                LigneEcriture.objects.create(
                    ecriture=ecriture,
                    compte=_compte('658100', 'Charges diverses', 'CHARGE'),
                    debit=instance.montant)
            LigneEcriture.objects.create(
                ecriture=ecriture, compte=treso, credit=instance.montant)
            logger.info(f"[COMPTA] Écriture mouvement caisse {instance.id} créée")
    except Exception as e:
        logger.error(f"[COMPTA] ERREUR écriture mouvement caisse {instance.id}: {e!s}")


@receiver(post_save, sender=MouvementStock)
def generer_ecriture_mouvement_stock(sender, instance, created, **kwargs):
    """Mouvements de stock → journal ST/AC (inventaire intermittent) :
    - AJUSTEMENT + / RETOUR client : D 311000 / C 603100 (stock rentré au coût)
    - AJUSTEMENT −                 : D 603100 / C 311000
    - AVOIR fournisseur            : D 401100 / C 601100
    Les entrées/sorties liées aux achats/ventes sont couvertes par leurs
    écritures propres ; les transformations ne sont pas comptabilisées (v1).
    """
    try:
        if not created:
            return
        t = instance.type_mouvement
        if t not in ('AJUSTEMENT', 'RETOUR', 'AVOIR'):
            return
        produit = instance.produit
        cout = (getattr(produit, 'pmp', None) or getattr(produit, 'cost_price', None)
                or Decimal('0.00')) if produit else Decimal('0.00')
        montant = abs(instance.quantite) * cout
        if montant <= 0:
            return
        with transaction.atomic():
            produit_nom = (produit.name if produit else instance.produit_nom) or 'Produit'
            # MouvementStock est append-only (created only) → création directe,
            # pas de get_or_create (pas de FK dédiée sur EcritureComptable).
            def _create(journal_code, journal_nom, libelle):
                journal, _ = JournalComptable.objects.get_or_create(
                    code=journal_code, defaults={'nom': journal_nom})
                return EcritureComptable.objects.create(
                    date=instance.date.date(), journal=journal,
                    exercice=get_exercice_courant(),
                    reference=f"MST-{instance.id}", libelle=libelle)

            if t == 'AVOIR':
                ecriture = _create('AC', 'Achats', f"Retour fournisseur {produit_nom}")
                LigneEcriture.objects.create(
                    ecriture=ecriture, compte=_compte('401100', 'Fournisseurs', 'PASSIF'),
                    debit=montant)
                LigneEcriture.objects.create(
                    ecriture=ecriture,
                    compte=_compte('601100', 'Achats de marchandises', 'CHARGE'),
                    credit=montant)
                return

            stock_compte = _compte('311000', 'Stocks de marchandises', 'ACTIF')
            variation = _compte('603100', 'Variation des stocks de marchandises', 'CHARGE')
            rentree = (instance.quantite > 0) or (
                t == 'RETOUR' and instance.avoir_client_id)
            lib = ('Retour client' if t == 'RETOUR' else 'Ajustement inventaire') \
                + f" {produit_nom}"
            ecriture = _create('ST', 'Stock', lib)
            LigneEcriture.objects.create(
                ecriture=ecriture, compte=stock_compte,
                debit=montant if rentree else Decimal('0.00'),
                credit=Decimal('0.00') if rentree else montant)
            LigneEcriture.objects.create(
                ecriture=ecriture, compte=variation,
                debit=Decimal('0.00') if rentree else montant,
                credit=montant if rentree else Decimal('0.00'))
            logger.info(f"[COMPTA] Écriture mouvement stock {instance.id} créée")
    except Exception as e:
        logger.error(f"[COMPTA] ERREUR écriture mouvement stock {instance.id}: {e!s}")


@receiver(post_save, sender='api.Immobilisation')
def generer_ecriture_acquisition_immo(sender, instance, created, **kwargs):
    """Acquisition d'immobilisation → journal IM :
    D compte_immo / C 571100 (espèces), 521100 (banque) ou 404100 (crédit fournisseur).
    """
    try:
        if not created:
            return
        with transaction.atomic():
            if instance.mode_paiement == 'especes':
                contrepartie = _compte('571100', 'Caisse', 'ACTIF')
            elif instance.mode_paiement == 'credit':
                contrepartie = _compte('404100', 'Fournisseurs d\'immobilisations', 'PASSIF')
            else:
                contrepartie = _compte('521100', 'Banque', 'ACTIF')

            journal, _ = JournalComptable.objects.get_or_create(
                code='IM', defaults={'nom': 'Immobilisations'})
            ecriture = EcritureComptable.objects.create(
                date=instance.date_acquisition, journal=journal,
                exercice=get_exercice_courant(),
                reference=f"IMMO-{instance.id}",
                libelle=f"Acquisition immobilisation {instance.nom}")
            LigneEcriture.objects.create(
                ecriture=ecriture, compte=instance.compte_immo,
                debit=instance.valeur_acquisition)
            LigneEcriture.objects.create(
                ecriture=ecriture, compte=contrepartie,
                credit=instance.valeur_acquisition)
            logger.info(f"[COMPTA] Écriture acquisition immobilisation {instance.id} créée")
    except Exception as e:
        logger.error(f"[COMPTA] ERREUR écriture immobilisation {instance.id}: {e!s}")
