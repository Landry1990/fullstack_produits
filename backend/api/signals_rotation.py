"""
Signaux Django pour recalculer automatiquement la rotation après chaque vente.

Avantages par rapport au recalcul manuel:
1. Automatique après chaque vente (impossible d'oublier)
2. Optimisé: ne recalcule que les produits vendus (pas tous)
3. Temps réel: la rotation est toujours à jour
4. STOCKE la date de première vente pour calcul rapide
"""

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Facture, FactureProduit
from .services.replenishment_service import recalculate_products_rotation


def calculate_rotation_for_product(produit_id):
    """
    Recalcule la rotation pour UN seul produit (optimisé)
    
    Formule: rotation = total_vendu / mois_depuis_premiere_vente
    
    AMELIORATION: Utilise le champ date_premiere_vente s'il existe, sinon
    cherche dans la base de données. Stocke la date pour les prochains calculs.
    """
    try:
        return recalculate_products_rotation([produit_id]) > 0
    except Exception as e:
        print(f"[Rotation] Erreur calcul produit {produit_id}: {e}")
        return False


def _schedule_rotation_update(produit_ids):
    ids = tuple(sorted({pid for pid in produit_ids if pid}))
    if not ids:
        return

    def recalculate():
        recalculate_products_rotation(ids)

    transaction.on_commit(recalculate, robust=True)


@receiver(post_save, sender=FactureProduit)
def update_rotation_on_sale(sender, instance, created, **kwargs):
    """
    Recalcule la rotation après chaque vente (FactureProduit créé/modifié)
    
    Déclenché automatiquement quand:
    - Un produit est vendu (encaissement)
    - Une facture est modifiée (ajout/retrait de produit)
    """
    if instance.produit_id:
        _schedule_rotation_update([instance.produit_id])


@receiver(post_delete, sender=FactureProduit)
def update_rotation_on_sale_delete(sender, instance, **kwargs):
    """
    Recalcule la rotation après suppression d'une vente
    
    Déclenché quand:
    - Une ligne de facture est supprimée (annulation)
    """
    if instance.produit_id:
        _schedule_rotation_update([instance.produit_id])


@receiver(post_save, sender=Facture)
def update_rotation_on_invoice_save(sender, instance, update_fields=None, **kwargs):
    if update_fields is not None and 'status' not in update_fields:
        return
    if instance.status not in [
        Facture.Status.VALIDEE,
        Facture.Status.PAYEE,
        Facture.Status.ANNULEE,
    ]:
        return
    produit_ids = instance.produits.exclude(produit_id__isnull=True).values_list('produit_id', flat=True)
    _schedule_rotation_update(produit_ids)


# Hook pour recalculer en batch (optionnel, pour maintenance)
def recalculate_all_rotations():
    """
    Recalcule la rotation pour TOUS les produits (usage: migration ou maintenance)
    
    AMELIORATION: Utilise la date de première vente pour chaque produit.
    """
    return recalculate_products_rotation()
