from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Facture, FactureProduit, Commande, CommandeProduit, Produit

@receiver(pre_save, sender=Facture)
def capture_old_status(sender, instance, update_fields=None, **kwargs):
    # Don't capture old status if we are only updating specific fields (and not status)
    if update_fields is not None and 'status' not in update_fields:
        return
        
    if instance.pk:
        try:
            old_instance = Facture.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
        except Facture.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None

@receiver(post_save, sender=Facture)
def refill_restock_order(sender, instance, created, update_fields=None, **kwargs):
    # Don't process restock logic if we are only updating specific fields (and not status)
    if update_fields is not None and 'status' not in update_fields:
        return

    old_status = getattr(instance, '_old_status', None)

    if instance.status == Facture.Status.VALIDEE and old_status != Facture.Status.VALIDEE:
        _process_valid_facture(instance)
    elif instance.status == Facture.Status.ANNULEE and old_status != Facture.Status.ANNULEE:
        _process_cancelled_facture(instance)

def _process_valid_facture(facture):
    """Ajoute les produits vendus à la commande de réassort en cours"""
    # 1. Trouver ou créer la commande de réassort BROUILLON
    commande, _ = Commande.objects.get_or_create(
        status=Commande.Status.EN_PREPARATION,
        numero_facture='REASSORT_AUTO',
        defaults={'fournisseur': None} # Commande globale sans fournisseur initial
    )

    # 2. Itérer sur les produits de la facture
    for ligne_facture in facture.produits.all():
        produit = ligne_facture.produit
        qte_vendue = ligne_facture.quantity
        
        # 3. Mettre à jour ou créer la ligne de commande
        ligne_commande, created = CommandeProduit.objects.get_or_create(
            commande=commande,
            produit=produit,
            defaults={
                'quantity': 0,
                'price': produit.cost_price or 0,
                'price_cost': produit.cost_price or 0,
                'selling_price': produit.selling_price or 0
            }
        )
        
        # On ajoute la quantité vendue
        ligne_commande.quantity += qte_vendue
        ligne_commande.save()

def _process_cancelled_facture(facture):
    """Retire les produits de la commande de réassort (si elle est toujours en brouillon)"""
    try:
        commande = Commande.objects.get(
            status=Commande.Status.EN_PREPARATION,
            numero_facture='REASSORT_AUTO'
        )
    except Commande.DoesNotExist:
        # Si la commande a été validée ou n'existe plus, on ne peut rien faire automatiquement
        return

    for ligne_facture in facture.produits.all():
        produit = ligne_facture.produit
        qte_vendue = ligne_facture.quantity
        
        try:
            ligne_commande = CommandeProduit.objects.get(commande=commande, produit=produit)
            if ligne_commande.quantity >= qte_vendue:
                ligne_commande.quantity -= qte_vendue
                if ligne_commande.quantity <= 0:
                    ligne_commande.delete()
                else:
                    ligne_commande.save()
        except CommandeProduit.DoesNotExist:
            pass
