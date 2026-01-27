# -*- coding: utf-8 -*-
"""
Signals for soft delete (preserving names before deletion).
"""
from django.db.models.signals import pre_delete
from django.dispatch import receiver


@receiver(pre_delete, sender='api.Produit')
def preserve_product_name_on_delete(sender, instance, **kwargs):
    """
    Avant la suppression d'un produit, on sauvegarde son nom 
    dans les modèles liés qui ont un champ produit_nom.
    """
    if not instance.pk:
        return
        
    nom = instance.name
    
    # FactureProduit
    try:
        instance.factureproduit_set.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # CommandeProduit
    try:
        instance.commandeproduit_set.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # StockLot
    try:
        instance.stock_lots.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # MouvementStock
    try:
        instance.mouvements_stock.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # StockAdjustment
    try:
        instance.adjustments.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # Promis
    try:
        instance.promis.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # HistoriqueTransformation (source)
    try:
        instance.hist_trans_source.all().update(produit_source_nom=nom)
    except Exception:
        pass
    
    # HistoriqueTransformation (destination)
    try:
        instance.hist_trans_dest.all().update(produit_destination_nom=nom)
    except Exception:
        pass
    
    # LigneOrdonnancier
    try:
        instance.ordonnancier_lignes.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # LigneInventaire
    try:
        instance.ligneinventaire_set.all().update(produit_nom=nom)
    except Exception:
        pass
    
    # LigneAvoir
    try:
        instance.ligneavoir_set.all().update(produit_nom=nom)
    except Exception:
        pass
