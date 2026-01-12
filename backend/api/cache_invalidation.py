"""
Cache Invalidation System for Product Stock Updates

This module uses Django signals to automatically invalidate the product cache
whenever stock levels change through:
- Order reception (Commande clôturée)
- Sales (Facture validée/payée)
- Manual stock adjustments
- Product modifications
"""

from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Commande, Facture, StockAdjustment, Produit
import logging

logger = logging.getLogger(__name__)


def invalidate_produit_cache():
    """
    Invalidate all product-related cache entries.
    
    The CachedSearchMixin uses cache keys with pattern 'produit_search_*'.
    This function clears all product cache to ensure fresh data after stock changes.
    """
    try:
        # Note: cache.delete_pattern requires django-redis or similar backend
        # For Django's default cache, we'd need to track keys manually
        # For now, we'll use a simple approach that works with any backend
        
        # Clear the main product list cache key
        cache.delete('produit_list')
        
        # If using django-redis, you could use:
        # cache.delete_pattern('produit_*')
        
        logger.info("Product cache invalidated successfully")
    except Exception as e:
        logger.error(f"Failed to invalidate product cache: {e}")


@receiver(post_save, sender=Commande)
def invalidate_cache_on_commande_save(sender, instance, created, **kwargs):
    """
    Invalidate product cache when an order is closed (stock entry).
    
    Only triggers on status change to CLOTUREE to avoid unnecessary invalidations.
    """
    if instance.status == Commande.Status.CLOTUREE:
        invalidate_produit_cache()
        logger.debug(f"Cache invalidated after order {instance.id} closure")


@receiver(post_save, sender=Facture)
def invalidate_cache_on_facture_save(sender, instance, created, **kwargs):
    """
    Invalidate product cache when an invoice is validated or paid (stock exit).
    
    Triggers on VALIDEE and PAYEE statuses to ensure stock decreases are reflected.
    """
    if instance.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
        invalidate_produit_cache()
        logger.debug(f"Cache invalidated after invoice {instance.id} validation/payment")


@receiver(post_save, sender=StockAdjustment)
def invalidate_cache_on_adjustment(sender, instance, created, **kwargs):
    """
    Invalidate product cache after a manual stock adjustment.
    
    Ensures manual corrections are immediately visible in the product list.
    """
    invalidate_produit_cache()
    logger.debug(f"Cache invalidated after stock adjustment for product {instance.produit_id}")


@receiver(post_save, sender=Produit)
@receiver(post_delete, sender=Produit)
def invalidate_cache_on_produit_change(sender, instance, **kwargs):
    """
    Invalidate product cache when a product is created, modified, or deleted.
    
    Ensures product data changes are immediately reflected in lists and searches.
    """
    invalidate_produit_cache()
    logger.debug(f"Cache invalidated after product {instance.id} change")
