"""
Signaux Django pour invalider automatiquement le cache lors des modifications.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .cache_utils import CacheInvalidator, ClientDebtCache, SearchCache
from .models import Caisse, CommandeProduit, FactureProduit, StockLot

# Note: Les signaux pour Produit, Commande, Facture, StockAdjustment
# sont gérés dans cache_invalidation.py (importé dans apps.py).
# Ce fichier gère uniquement les signaux sur les modèles "enfants"
# qui affectent le stock indirectement.


# Invalidation du cache lors de changements de stock
@receiver(post_save, sender=StockLot)
@receiver(post_delete, sender=StockLot)
def invalidate_cache_on_stock_change(sender, instance, **kwargs):
    """
    Invalide le cache quand un lot de stock change.
    """
    CacheInvalidator.invalidate_on_stock_change(sender, instance, **kwargs)


# Invalidation lors de clôture de commande (changement de stock)
@receiver(post_save, sender=CommandeProduit)
def invalidate_cache_on_command_product_change(sender, instance, **kwargs):
    """
    Invalide le cache quand une ligne de commande change.
    Cela peut affecter le stock du produit.
    """
    if hasattr(instance, 'produit') and instance.produit:
        SearchCache.invalidate_product(instance.produit.id)


# Invalidation lors de vente (changement de stock)
@receiver(post_save, sender=FactureProduit)
def invalidate_cache_on_invoice_product_change(sender, instance, **kwargs):
    """
    Invalide le cache quand une ligne de facture change.
    Cela peut affecter le stock du produit.
    """
    if hasattr(instance, 'produit') and instance.produit:
        SearchCache.invalidate_product(instance.produit.id)


# Invalidation du cache de dette client lors d'un paiement
@receiver(post_save, sender=Caisse)
@receiver(post_delete, sender=Caisse)
def invalidate_client_debt_on_payment(sender, instance, **kwargs):
    """
    Invalide le cache de dette client quand un paiement est enregistré.
    """
    if instance.facture and instance.facture.client_id:
        ClientDebtCache.invalidate_client(instance.facture.client_id)


# Signal pour logger les hits/miss de cache (optionnel, pour monitoring)
class CacheMonitor:
    """
    Classe utilitaire pour monitorer l'utilisation du cache.
    """
    
    @staticmethod
    def log_cache_hit(cache_key: str, hit: bool):
        """
        Log un hit ou miss de cache.
        Peut être étendu pour envoyer des métriques à un service de monitoring.
        """
        # Pour l'instant, juste un log simple
        import logging
        logger = logging.getLogger('api.cache')
        
        if hit:
            logger.debug(f"Cache HIT: {cache_key}")
        else:
            logger.debug(f"Cache MISS: {cache_key}")
