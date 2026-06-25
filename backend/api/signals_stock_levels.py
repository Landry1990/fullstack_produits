"""
Calcul automatique des seuils de stock (mini/maxi) pour chaque produit.

NOUVELLE FORMULE SIMPLE:
- Si je vends X quantités par mois
- STOCK MINIMUM = (X / 30) × délai_livraison_fournisseur
  → Quantité pour tenir pendant le délai de livraison
- STOCK MAXIMUM = X × 1.2
  → Quantité pour tenir 1 mois + 20% de sécurité

Le délai de couverture est géré dans la programmation de commande, pas ici.

Recalcule automatiquement:
1. Le 1er de chaque mois (via cron/scheduler)
2. Après chaque vente (pour réactivité immédiate)
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from .models import FactureProduit, Produit, Fournisseur
from .cache_utils import SearchCache


def calculate_ventes_mensuelles(produit):
    """
    Calcule les ventes mensuelles moyennes.
    Stratégie progressive :
    - 1. Essaie sur 30 jours
    - 2. Si 0, essaie sur 90 jours (ramené à /mois)
    - 3. Si 0, essaie sur toute l'historique (ramené à /mois)
    Retourne la moyenne mensuelle estimée.
    """
    today = timezone.now().date()

    # 1. 30 derniers jours
    date_30j = today - timedelta(days=30)
    ventes_30j = FactureProduit.objects.filter(
        produit=produit,
        facture__status__in=['VAL', 'PAY'],
        facture__date__gte=date_30j
    ).aggregate(total=Sum('quantity'))['total'] or 0

    if ventes_30j > 0:
        return float(ventes_30j)

    # 2. 90 derniers jours → moyenne mensuelle
    date_90j = today - timedelta(days=90)
    ventes_90j = FactureProduit.objects.filter(
        produit=produit,
        facture__status__in=['VAL', 'PAY'],
        facture__date__gte=date_90j
    ).aggregate(total=Sum('quantity'))['total'] or 0

    if ventes_90j > 0:
        return float(ventes_90j) / 3.0  # ramené à 1 mois

    # 3. Toute l'historique → moyenne mensuelle
    premiere_vente = FactureProduit.objects.filter(
        produit=produit,
        facture__status__in=['VAL', 'PAY'],
    ).order_by('facture__date').values_list('facture__date', flat=True).first()

    if premiere_vente:
        jours_total = max(30, (today - premiere_vente).days)
        ventes_total = FactureProduit.objects.filter(
            produit=produit,
            facture__status__in=['VAL', 'PAY'],
        ).aggregate(total=Sum('quantity'))['total'] or 0
        return float(ventes_total) / (jours_total / 30.0)

    return 0.0


def calculate_and_apply_stock_levels(produit_id=None):
    """
    Calcule et applique les seuils min/max pour un produit ou tous les produits.
    
    Formule:
    - MINIMUM = (ventes_mensuelles / 30) × délai_livraison
    - MAXIMUM = ventes_mensuelles × 1.2
    
    Args:
        produit_id: Si None, calcule pour tous les produits
    
    Returns:
        Nombre de produits mis à jour
    """
    # Délai par défaut pour fournisseurs locaux (même jour ou 2 jours max)
    DELAI_LIVRAISON_DEFAULT = 2  # jours
    COEFFICIENT_SECURITE = 1.2   # 20% de sécurité pour le max
    
    updated_count = 0
    
    # Sélectionner les produits
    if produit_id:
        produits = Produit.objects.filter(id=produit_id)
    else:
        produits = Produit.objects.all()
    
    for produit in produits:
        try:
            # 1. Calculer les ventes mensuelles (30 derniers jours)
            ventes_mensuelles = calculate_ventes_mensuelles(produit)
            
            if ventes_mensuelles == 0:
                # Si aucune vente, ne pas modifier les seuils existants
                continue
            
            # 2. Récupérer le délai de livraison du fournisseur principal
            fournisseur = produit.fournisseur
            if fournisseur and hasattr(fournisseur, 'delai_livraison_jours'):
                delai_livraison = fournisseur.delai_livraison_jours or DELAI_LIVRAISON_DEFAULT
            else:
                delai_livraison = DELAI_LIVRAISON_DEFAULT
            
            # 3. Calculer les seuils
            # MINIMUM: quantité pour tenir pendant le délai de livraison
            ventes_par_jour = ventes_mensuelles / 30.0
            stock_minimum = ventes_par_jour * delai_livraison
            
            # MAXIMUM: quantité pour tenir 1 mois + 20% de sécurité
            stock_maximum = ventes_mensuelles * COEFFICIENT_SECURITE
            
            # 4. Convertir en entiers (arrondi)
            stock_minimum_int = int(Decimal(str(stock_minimum)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            stock_maximum_int = int(Decimal(str(stock_maximum)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            
            # Minimum 1 unité si le produit se vend
            if stock_minimum_int < 1 and ventes_mensuelles > 0:
                stock_minimum_int = 1
            
            # Garantir la cohérence : max doit toujours être > min
            if stock_maximum_int <= stock_minimum_int:
                stock_maximum_int = stock_minimum_int + max(1, stock_minimum_int)
            
            # 5. Toujours mettre à jour les deux ensemble pour garantir la cohérence
            produit.stock_minimum = stock_minimum_int
            produit.stock_maximum = stock_maximum_int
            produit.save(update_fields=['stock_minimum', 'stock_maximum'])
            updated_count += 1
            print(f"[StockLevels] Produit #{produit.id}: min={stock_minimum_int}, max={stock_maximum_int} (Ventes/mois={ventes_mensuelles:.0f})")
                
        except Exception as e:
            print(f"[StockLevels] Erreur produit #{produit.id}: {e}")
            continue
    
    return updated_count


@receiver(post_save, sender=FactureProduit)
def update_stock_levels_on_sale(sender, instance, created, **kwargs):
    """
    Recalcule les seuils après chaque vente pour ce produit spécifique.
    Léger et rapide (un seul produit).
    """
    if created and instance.produit_id:
        updated = calculate_and_apply_stock_levels(instance.produit_id)
        if updated:
            print(f"[StockLevels] Recalculé pour produit #{instance.produit_id} (vente)")


def monthly_stock_levels_update():
    """
    Recalcule les seuils pour TOUS les produits.
    À exécuter le 1er de chaque mois via le scheduler.
    """
    print(f"[StockLevels] Début recalcul mensuel - {timezone.now()}")
    updated = calculate_and_apply_stock_levels()
    
    # Invalider le cache produit pour forcer le rechargement des nouvelles valeurs min/max
    if updated > 0:
        SearchCache.invalidate_all_products()
        print(f"[StockLevels] Cache produit invalidé ({updated} produits mis à jour)")
    
    print(f"[StockLevels] Fin recalcul: {updated} produits mis à jour")
    return updated
