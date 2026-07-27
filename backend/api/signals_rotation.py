"""
Signaux Django pour recalculer automatiquement la rotation après chaque vente.

Avantages par rapport au recalcul manuel:
1. Automatique après chaque vente (impossible d'oublier)
2. Optimisé: ne recalcule que les produits vendus (pas tous)
3. Temps réel: la rotation est toujours à jour
4. STOCKE la date de première vente pour calcul rapide
"""

from decimal import Decimal

from django.db.models import Min, Sum
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Facture, FactureProduit, Produit
from .services.replenishment_service import get_replenishment_metrics


def calculate_rotation_for_product(produit_id):
    """
    Recalcule la rotation pour UN seul produit (optimisé)
    
    Formule: rotation = total_vendu / mois_depuis_premiere_vente
    
    AMELIORATION: Utilise le champ date_premiere_vente s'il existe, sinon
    cherche dans la base de données. Stocke la date pour les prochains calculs.
    """
    try:
        produit = Produit.objects.get(id=produit_id)
        first_sale = FactureProduit.objects.filter(
            produit=produit,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        ).order_by('facture__date').values_list('facture__date', flat=True).first()
        metrics = get_replenishment_metrics(produit.id)
        rotation = metrics['consommation_mensuelle']
        update_fields = []

        if produit.date_premiere_vente != (first_sale.date() if first_sale else None):
            produit.date_premiere_vente = first_sale.date() if first_sale else None
            update_fields.append('date_premiere_vente')

        current_rotation = getattr(produit, 'rotation_moyenne', 0) or 0
        if abs(float(current_rotation) - rotation) > 0.001:
            produit.rotation_moyenne = Decimal(str(rotation))
            update_fields.append('rotation_moyenne')

        if update_fields:
            produit.save(update_fields=update_fields)
            return True

        return False
        
    except Produit.DoesNotExist:
        return False
    except Exception as e:
        print(f"[Rotation] Erreur calcul produit {produit_id}: {e}")
        return False


@receiver(post_save, sender=FactureProduit)
def update_rotation_on_sale(sender, instance, created, **kwargs):
    """
    Recalcule la rotation après chaque vente (FactureProduit créé/modifié)
    
    Déclenché automatiquement quand:
    - Un produit est vendu (encaissement)
    - Une facture est modifiée (ajout/retrait de produit)
    """
    if instance.produit_id:
        updated = calculate_rotation_for_product(instance.produit_id)
        if updated:
            print(f"[Rotation] Recalculée pour produit #{instance.produit_id} (vente)")


@receiver(post_delete, sender=FactureProduit)
def update_rotation_on_sale_delete(sender, instance, **kwargs):
    """
    Recalcule la rotation après suppression d'une vente
    
    Déclenché quand:
    - Une ligne de facture est supprimée (annulation)
    """
    if instance.produit_id:
        updated = calculate_rotation_for_product(instance.produit_id)
        if updated:
            print(f"[Rotation] Recalculée pour produit #{instance.produit_id} (annulation)")


@receiver(post_save, sender=Facture)
def update_rotation_on_invoice_save(sender, instance, **kwargs):
    produit_ids = instance.produits.exclude(produit_id__isnull=True).values_list('produit_id', flat=True)
    for produit_id in produit_ids:
        calculate_rotation_for_product(produit_id)


@receiver(post_save, sender=FactureProduit)
def set_first_sale_date(sender, instance, created, **kwargs):
    """
    Stocke la date de première vente lors de la première vente d'un produit.
    
    Déclenché quand:
    - Un produit est vendu pour la première fois
    """
    if not created or not instance.produit_id:
        return
    
    try:
        if instance.facture.status not in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
            return

        produit = Produit.objects.get(id=instance.produit_id)
        
        # Vérifier si le champ existe et si la date n'est pas déjà stockée
        if hasattr(produit, 'date_premiere_vente') and not produit.date_premiere_vente:
            # C'est la première vente - stocker la date
            from datetime import date
            produit.date_premiere_vente = instance.facture.date.date() if instance.facture.date else date.today()
            produit.save(update_fields=['date_premiere_vente'])
            print(f"[Rotation] Date première vente stockée pour produit #{produit.id}")
    except Produit.DoesNotExist:
        pass


# Hook pour recalculer en batch (optionnel, pour maintenance)
def recalculate_all_rotations():
    """
    Recalcule la rotation pour TOUS les produits (usage: migration ou maintenance)
    
    AMELIORATION: Utilise la date de première vente pour chaque produit.
    """
    from django.db import transaction
    
    today = timezone.now().date()
    produits = Produit.objects.all()
    updated_count = 0
    
    # Récupérer toutes les ventes
    ventes_par_produit = FactureProduit.objects.filter(
        facture__status__in=['VAL', 'PAY']
    ).values('produit_id').annotate(
        total=Sum('quantity')
    )
    sold_dict = {item['produit_id']: (item['total'] or 0) for item in ventes_par_produit}
    
    # Récupérer les dates de première vente pour tous les produits
    first_sales = FactureProduit.objects.filter(
        facture__status__in=['VAL', 'PAY']
    ).values('produit_id').annotate(
        first_date=Min('facture__date')
    )
    first_sale_dict = {item['produit_id']: item['first_date'] for item in first_sales}
    
    with transaction.atomic():
        for produit in produits:
            # Chercher la date de première vente pour ce produit
            first_sale_date = first_sale_dict.get(produit.id)
            
            if not first_sale_date:
                # Aucune vente: rotation = 0
                if produit.rotation_moyenne != 0:
                    produit.rotation_moyenne = 0
                    produit.save(update_fields=['rotation_moyenne'])
                    updated_count += 1
                continue
            
            # Calculer depuis la première vente
            months_since_first = (today - first_sale_date.date()).days / 30.0
            months = max(1.0, months_since_first)
            
            total_sold = sold_dict.get(produit.id, 0)
            rotation = float(total_sold) / months
            
            current_rotation = getattr(produit, 'rotation_moyenne', 0) or 0
            if abs(float(current_rotation) - rotation) > 0.001:
                produit.rotation_moyenne = Decimal(str(rotation))
                produit.save(update_fields=['rotation_moyenne'])
                updated_count += 1
    
    return updated_count
