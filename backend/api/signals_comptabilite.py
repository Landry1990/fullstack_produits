# -*- coding: utf-8 -*-
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone
from .models import (
    Facture, Caisse, Commande, EcritureComptable, 
    LigneEcriture, CompteComptable, JournalComptable, PaiementFournisseur,
    ExerciceComptable
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
from decimal import Decimal

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
        logger.error(f"[COMPTA] ERREUR création écriture vente pour facture {instance.id}: {str(e)}")
        logger.error(f"[COMPTA] L'écriture devra être créée manuellement ou via la commande de régénération")


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
        logger.error(f"[COMPTA] ERREUR création écriture paiement pour caisse {instance.id}: {str(e)}")
        logger.error(f"[COMPTA] L'écriture devra être créée manuellement ou via la commande de régénération")


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
