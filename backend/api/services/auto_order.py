"""
Shared utility for creating auto-generated orders from suggestions.
Used by both the management command and the trigger_now API action.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from ..models import Commande, CommandeProduit, Produit

logger = logging.getLogger(__name__)


def create_order_from_suggestions(schedule, suggestions, total_ht):
    """
    Creates a draft Commande from a list of suggestion dicts.
    
    Args:
        schedule: OrderSchedule instance (provides fournisseur + config)
        suggestions: list of dicts from calculer_*() functions
        total_ht: float, total HT of the suggestions
        
    Returns:
        tuple: (commande, nb_produits_created)
        
    Raises:
        ValueError: if suggestions is empty
    """
    if not suggestions:
        raise ValueError("Aucune suggestion fournie")

    # Check minimum conditions
    count_items = len(suggestions)
    total_ht_decimal = Decimal(str(total_ht))

    if schedule.min_amount > 0 or schedule.min_items > 0:
        meets_amount = total_ht_decimal >= schedule.min_amount if schedule.min_amount > 0 else True
        meets_items = count_items >= schedule.min_items if schedule.min_items > 0 else True

        if schedule.condition_logic == 'AND':
            should_create = meets_amount and meets_items
        else:  # OR
            should_create = meets_amount or meets_items

        if not should_create:
            logger.info(
                f"Conditions non remplies pour {schedule.fournisseur.name}: "
                f"Montant {total_ht_decimal}/{schedule.min_amount}, Articles {count_items}/{schedule.min_items}"
            )
            return None, 0

    # Generate a meaningful numero_facture
    now = timezone.now()
    numero = f"AUTO-{schedule.fournisseur.name[:10].upper().replace(' ', '')}-{now.strftime('%d%m%y-%H%M')}"

    with transaction.atomic():
        commande = Commande.objects.create(
            type=Commande.Type.LOCALE,
            fournisseur=schedule.fournisseur,
            fournisseur_nom=schedule.fournisseur.name,
            numero_facture=numero,
            status=Commande.Status.EN_PREPARATION,
            date=now,
            source=Commande.Source.AUTO_SCHEDULE,
        )

        nb_created = 0
        for item in suggestions:
            try:
                produit = Produit.objects.get(id=item['produit_id'])
                CommandeProduit.objects.create(
                    commande=commande,
                    produit=produit,
                    produit_nom=produit.name,
                    quantity=item['quantite_suggeree'],
                    price=Decimal(str(item['prix_achat'])),
                    price_cost=Decimal(str(item['prix_achat'])),
                    tva=Decimal(str(item.get('tva', 0))),
                    selling_price=Decimal(str(item.get('prix_vente', 0))),
                )
                nb_created += 1
            except Produit.DoesNotExist:
                logger.warning(f"Produit {item['produit_id']} introuvable, ignoré")

    logger.info(
        f"Commande AUTO #{commande.id} ({numero}) créée: "
        f"{nb_created} produits, total HT={total_ht_decimal} F"
    )
    return commande, nb_created


def run_suggestions_for_schedule(schedule):
    """
    Runs the appropriate suggestion algorithm for a given schedule.
    
    Returns:
        tuple: (suggestions, total_ht)
    """
    from ..views.commandes.suggestions import (
        calculer_optimisation_intelligente,
        calculer_reapprovisionnement_simple,
        calculer_reapprovisionnement_cumulatif,
    )

    if schedule.execution_mode == 'OPTIMISE':
        return calculer_optimisation_intelligente(
            periode=schedule.analysis_period_days,
            fournisseur_id=schedule.fournisseur.id,
            budget_max=None,
        )
    elif schedule.execution_mode == 'CUMULATIF':
        return calculer_reapprovisionnement_cumulatif(
            fournisseur_id=schedule.fournisseur.id,
            periode_fallback=schedule.analysis_period_days,
            budget_max=None,
        )
    else:
        return calculer_reapprovisionnement_simple(
            periode=schedule.analysis_period_days,
            fournisseur_id=schedule.fournisseur.id,
            budget_max=None,
        )
