from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Facture, Caisse, Client, Produit

@receiver([post_save, post_delete], sender=Facture)
@receiver([post_save, post_delete], sender=Caisse)
@receiver([post_save, post_delete], sender=Client)
@receiver([post_save, post_delete], sender=Produit)
def invalidate_dashboard_stats(sender, instance, **kwargs):
    """
    Invalidate dashboard stats cache when data changes.
    """
    cache.delete('dashboard_stats')
    # print(f"Cache invalidated due to change in {sender.__name__}") # Debug
