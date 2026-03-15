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

    try:
        if instance.status == Facture.Status.VALIDEE and old_status != Facture.Status.VALIDEE:
            _process_valid_facture(instance)
        elif instance.status == Facture.Status.ANNULEE and old_status != Facture.Status.ANNULEE:
            _process_cancelled_facture(instance)
    except Exception as e:
        # CRITICAL: On ne veut JAMAIS bloquer une vente à cause du réassort auto
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erreur lors du réassort automatique pour la facture {instance.numero_facture}: {e}", exc_info=True)

def _process_valid_facture(facture):
    """Ajoute les produits vendus à la commande de réassort en cours"""
    from django.db import IntegrityError
    
    # 1. Trouver ou créer la commande de réassort BROUILLON
    # On utilise un bloc try/except + transaction.atomic pour gérer la concurrence
    from django.db import transaction
    try:
        with transaction.atomic():
            # Chercher d'abord si une commande active existe
            commande = Commande.objects.filter(
                status=Commande.Status.EN_PREPARATION,
                numero_facture='REASSORT_AUTO'
            ).first()
            
            if not commande:
                # Si pas de commande active, vérifier si une commande close occupe le numéro
                existing_old = Commande.objects.filter(numero_facture='REASSORT_AUTO').first()
                if existing_old:
                    # Libérer le numéro pour la nouvelle commande
                    existing_old.numero_facture = f"REASSORT_OLD_{existing_old.id}"
                    existing_old.save(update_fields=['numero_facture'])
                
                # Créer la nouvelle commande
                commande = Commande.objects.create(
                    status=Commande.Status.EN_PREPARATION,
                    numero_facture='REASSORT_AUTO',
                    fournisseur=None
                )
    except IntegrityError:
        # En cas de collision résiduelle bizarre
        commande = Commande.objects.filter(
            status=Commande.Status.EN_PREPARATION,
            numero_facture='REASSORT_AUTO'
        ).first()
        if not commande:
             # Should practically not happen if logic above is correct
             raise Exception("Incapacité à obtenir une commande de réassort auto")

    # 2. Itérer sur les produits de la facture
    from django.db.models import F
    
    for ligne_facture in facture.produits.all():
        produit = ligne_facture.produit
        qte_vendue = ligne_facture.quantity
        
        # Ignorer les retours (quantité négative ou nulle) pour ne pas créer de lignes de commande négatives
        if qte_vendue <= 0:
            continue
        
        # 3. Mettre à jour ou créer la ligne de commande
        # On utilise une boucle simple pour gérer la création concurrente si nécessaire
        try:
            ligne_commande, created = CommandeProduit.objects.get_or_create(
                commande=commande,
                produit=produit,
                defaults={
                    'quantity': qte_vendue,
                    'price': produit.cost_price or 0,
                    'price_cost': produit.cost_price or 0,
                    'selling_price': produit.selling_price or 0
                }
            )
            if not created:
                # Si elle existait déjà, on incrémente de façon atomique
                CommandeProduit.objects.filter(id=ligne_commande.id).update(
                    quantity=F('quantity') + qte_vendue
                )
        except IntegrityError:
            # Sécurité au cas où un unique constraint (commande, produit) existerait
            CommandeProduit.objects.filter(commande=commande, produit=produit).update(
                quantity=F('quantity') + qte_vendue
            )

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
                    from django.db.models.deletion import ProtectedError
                    try:
                        ligne_commande.delete()
                    except ProtectedError:
                        # Si la ligne est déjà référencée (ex: stock déjà reçu), on ne peut pas la supprimer
                        # On la laisse à 0 pour indiquer qu'elle n'est plus "demandée" par cette vente
                        ligne_commande.quantity = 0
                        ligne_commande.save(update_fields=['quantity'])
                else:
                    ligne_commande.save()
        except CommandeProduit.DoesNotExist:
            pass
