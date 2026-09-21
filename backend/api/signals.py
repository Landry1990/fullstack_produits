from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Caisse, Client, EcritureComptable, Facture, LigneEcriture, Produit


@receiver([post_save, post_delete], sender=Facture)
@receiver([post_save, post_delete], sender=Caisse)
@receiver([post_save, post_delete], sender=Client)
@receiver([post_save, post_delete], sender=Produit)
@receiver([post_save, post_delete], sender=EcritureComptable)
@receiver([post_save, post_delete], sender=LigneEcriture)
def invalidate_secondary_caches(sender, instance, **kwargs):
    """
    Invalide les caches secondaires (listes de factures, suggestions, dettes fournisseurs, compta).
    Le cache dashboard est géré séparément par DashboardCache dans cache_invalidation.py.
    """
    # Invalider le cache de la liste des factures
    try:
        cache.delete_pattern('factures_list:*')
    except AttributeError:
        pass
    # Invalider le cache des suggestions de commande
    try:
        cache.delete_pattern('suggestions:*')
    except AttributeError:
        pass
    # Invalider le cache des dettes fournisseurs
    try:
        cache.delete_pattern('supplier_debts:*')
    except AttributeError:
        pass
    # Invalider le cache de comptabilité
    try:
        cache.delete_pattern('compta_*')
    except AttributeError:
        pass
