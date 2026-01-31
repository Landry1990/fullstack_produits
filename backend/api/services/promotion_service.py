from decimal import Decimal
from django.utils import timezone
from django.db import models
from ..models import Promotion, FactureProduit, Produit

class PromotionService:
    """
    Service pour gérer l'application des promotions sur les factures.
    Politique: "Best Deal" (la meilleure offre s'applique).
    """

    @staticmethod
    def get_active_promotions():
        return Promotion.objects.filter(
            active=True
        ).filter(
            start_date__lte=timezone.now()
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=timezone.now())
        ).order_by('-priority')

    @staticmethod
    def calculate_best_promotion(produit, quantity):
        """
        Trouve la meilleure promotion applicable pour un produit et une quantité donnés.
        Retourne (discount_amount_per_unit, free_quantity, applied_promotion_name)
        """
        now = timezone.now()
        active_promos = Promotion.objects.filter(
            active=True,
            start_date__lte=now
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
        ).filter(
            models.Q(products=produit) | models.Q(rayons=produit.rayon)
        ).order_by('-priority', '-id') # Priorité manuelle puis le plus récent

        best_discount_value = Decimal('0.00') # Valeur totale de l'économie
        best_result = (Decimal('0.00'), 0, None) # (remise_unitaire, qté_gratuite, nom)

        # Prix de référence
        price = produit.selling_price
        if not price or price <= 0:
            return best_result

        for promo in active_promos:
            current_discount_value = Decimal('0.00')
            result = (Decimal('0.00'), 0, None)

            # --- TYPE: BUY X GET Y ---
            if promo.discount_type == Promotion.DiscountType.BUY_X_GET_Y:
                if quantity >= promo.buy_quantity:
                    # Combien de fois on peut appliquer l'offre ?
                    # Ex: 2 achetés = 1 offert. Si j'ai pris 5, j'ai 2 offerts ? ou il faut prendre 2+1 ?
                    # LOGIQUE CLASSIQUE: "Pour chaque lot de X achetés, Y offerts".
                    # Mais attention, dans la facture on a 'quantity' qui est ce que le client prend.
                    # Est-ce que 'quantity' INCLUT les gratuits ?
                    # Convention ici: 'quantity' est le nombre d'articles PAYÉS (ou TOTAL ?).
                    # Plan validé: "Buy X Get Y Free. Adds a `free_quantity` field".
                    # Donc le client commande X, on lui donne X (facturés) + Y (gratuits, champ à part).
                    # Le stock sortira X+Y.
                    
                    sets = quantity // promo.buy_quantity
                    total_free = sets * promo.get_quantity
                    
                    if total_free > 0:
                        # Valeur de l'économie = Prix * Quantité offerte
                        current_discount_value = total_free * price
                        result = (Decimal('0.00'), total_free, promo.name)
            
            # --- TYPE: PERCENTAGE ---
            elif promo.discount_type == Promotion.DiscountType.PERCENTAGE:
                # Vérifier min quantity (simulé via buy_quantity pour simplifier le modèle si besoin, 
                # ou on assume buy_quantity est le seuil min)
                if quantity >= promo.buy_quantity:
                    # value est en % (ex: 20 pour 20%)
                    discount_per_unit = (price * promo.value / Decimal('100.00')).quantize(Decimal('0.01'))
                    total_discount = discount_per_unit * quantity
                    
                    current_discount_value = total_discount
                    result = (discount_per_unit, 0, promo.name)

            # --- TYPE: FIXED AMOUNT ---
            elif promo.discount_type == Promotion.DiscountType.FIXED_AMOUNT:
                if quantity >= promo.buy_quantity:
                    discount_per_unit = promo.value
                    if discount_per_unit > price:
                        discount_per_unit = price # On ne rembourse pas
                    
                    total_discount = discount_per_unit * quantity
                    current_discount_value = total_discount
                    result = (discount_per_unit, 0, promo.name)

            # COMPARISON (Best Deal)
            if current_discount_value > best_discount_value:
                best_discount_value = current_discount_value
                best_result = result

        return best_result


    @staticmethod
    def apply_promotions_to_invoice(facture):
        """
        Parcourt toutes les lignes de la facture et applique les meilleures promotions.
        """
        lines = FactureProduit.objects.filter(facture=facture).select_related('produit', 'produit__rayon')
        updated = False

        for line in lines:
            if not line.produit:
                continue

            # Skip s'il y a déjà une remise manuelle forcée ? 
            # -> Pour l'instant on écrase ou on applique si discount == 0 ? 
            # -> Politique: L'automatique l'emporte, sauf si on ajoute un flag 'manual_override' plus tard.
            # Pour l'instant, appliquons la promo.
            
            discount, free_qty, promo_name = PromotionService.calculate_best_promotion(line.produit, line.quantity)
            
            # Si on a trouvé une promo ou si on doit nettoyer une ancienne promo
            if promo_name or line.free_quantity > 0 or line.discount > 0:
                line.discount = discount
                line.free_quantity = free_qty
                # On pourrait stocker le nom de la promo dans 'produit_nom' ou un champ dédié si besoin de tracer
                line.save()
                updated = True
        
        return updated
