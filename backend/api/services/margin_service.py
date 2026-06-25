"""
Service centralisé pour tous les calculs de marge
Évite les duplications et assure la cohérence des formules
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple, Union
from datetime import timedelta
from django.db.models import Sum, F, DecimalField, Q, Value, Count, Avg, Exists, OuterRef
from django.db.models.functions import Coalesce
from django.utils import timezone
from api.models import Produit, Facture, FactureProduit, FactureProduitAllocation, StockLot

class MarginService:
    """
    Service centralisé pour le calcul des marges
    Formules standardisées et optimisées
    """
    
    @staticmethod
    def calculate_product_margin(
        cost_price: Decimal, 
        selling_price: Decimal,
        rounding: bool = True
    ) -> Dict[str, Decimal]:
        """
        Calcule la marge pour un produit selon les formules standard
        
        Args:
            cost_price: Prix d'achat
            selling_price: Prix de vente
            rounding: Arrondir à 2 décimales
            
        Returns:
            Dict avec taux_marge, pourcentage_marge, marge_unitaire
        """
        if not cost_price or cost_price <= 0:
            return {
                'taux_marge': Decimal('0.00'),
                'pourcentage_marge': Decimal('0.00'),
                'marge_unitaire': Decimal('0.00')
            }
        
        if not selling_price or selling_price <= 0:
            return {
                'taux_marge': Decimal('0.00'),
                'pourcentage_marge': Decimal('0.00'),
                'marge_unitaire': Decimal('0.00')
            }
        
        # Formules standardisées
        taux_marge = selling_price / cost_price
        marge_unitaire = selling_price - cost_price
        pourcentage_marge = (marge_unitaire / selling_price) * 100 if selling_price > 0 else Decimal('0.00')
        
        if rounding:
            taux_marge = taux_marge.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            pourcentage_marge = pourcentage_marge.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            marge_unitaire = marge_unitaire.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        return {
            'taux_marge': taux_marge,
            'pourcentage_marge': pourcentage_marge,
            'marge_unitaire': marge_unitaire
        }
    
    @staticmethod
    def calculate_lot_margin(
        lot: StockLot,
        selling_price: Optional[Decimal] = None
    ) -> Dict[str, Decimal]:
        """
        Calcule la marge pour un lot de stock
        
        Args:
            lot: Objet StockLot
            selling_price: Prix de vente (optionnel, utilise lot.selling_price par défaut)
            
        Returns:
            Dict avec marges calculées
        """
        price = selling_price or lot.selling_price
        return MarginService.calculate_product_margin(lot.price_cost, price)
    
    @staticmethod
    def calculate_facture_margin(facture: Facture) -> Dict[str, Decimal]:
        """
        Calcule la marge brute pour une facture
        
        Args:
            facture: Objet Facture
            
        Returns:
            Dict avec cout_achat, marge_brute, marge_pct
        """
        # Optimisé avec une seule requête
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        ).aggregate(
            cout_achat=Coalesce(
                Sum(F('cost_price') * F('quantity'), output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            )
        )
        
        cout_achat = allocations['cout_achat']
        ca_ht = facture.total_ht or Decimal('0.00')
        marge_brute = ca_ht - cout_achat
        marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')
        
        return {
            'cout_achat': cout_achat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_brute': marge_brute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_pct': marge_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        }
    
    @staticmethod
    def calculate_period_margin(
        date_debut, 
        date_fin,
        factures_qs=None
    ) -> Dict[str, Decimal]:
        """
        Calcule la marge sur une période avec requête optimisée
        
        Args:
            date_debut: Date de début
            date_fin: Date de fin
            factures_qs: Queryset de factures (optionnel)
            
        Returns:
            Dict avec statistiques de marge sur la période
        """
        if factures_qs is None:
            factures_qs = Facture.objects.filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__gte=date_debut,
                date__lt=date_fin
            )
        
        # Requête optimisée avec annotations
        factures_with_margin = factures_qs.annotate(
            cout_achat_facture=Coalesce(
                Sum(
                    F('produits__factureproduitallocation__cost_price') * 
                    F('produits__factureproduitallocation__quantity'),
                    output_field=DecimalField()
                ),
                Value(0, output_field=DecimalField())
            )
        ).aggregate(
            ca_ht_total=Coalesce(Sum('total_ht'), Value(0, output_field=DecimalField())),
            cout_achat_total=Coalesce(Sum('cout_achat_facture'), Value(0, output_field=DecimalField())),
            nb_factures=Count('id')
        )
        
        ca_ht = factures_with_margin['ca_ht_total']
        cout_achat = factures_with_margin['cout_achat_total']
        marge_brute = ca_ht - cout_achat
        marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')
        
        return {
            'ca_ht_total': ca_ht.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'cout_achat_total': cout_achat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_brute': marge_brute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_pct': marge_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'nb_factures': factures_with_margin['nb_factures']
        }
    
    @staticmethod
    def calculate_period_margin_with_discounts(
        date_debut,
        date_fin,
        factures_qs=None,
        exclude_is_divers=True
    ) -> Dict[str, Decimal]:
        """
        Calcule la marge sur une période avec prise en compte des remises globales
        Formule unifiée : (CA TTC * ratio_remise) - coût_achat
        où ratio_remise = total_ttc / (total_ttc + remise_globale)
        
        Args:
            date_debut: Date de début
            date_fin: Date de fin
            factures_qs: Queryset de factures (optionnel)
            exclude_is_divers: Exclure les lots is_divers (défaut True)
            
        Returns:
            Dict avec statistiques de marge sur la période
        """
        if factures_qs is None:
            factures_qs = Facture.objects.filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__gte=date_debut,
                date__lt=date_fin
            )
        
        # Exclure les factures avec uniquement des produits is_divers si demandé
        if exclude_is_divers:
            factures_qs = factures_qs.exclude(
                produits__allocations__stock_lot__is_divers=True
            ).distinct()
        
        # Coût des produits alloués (exclure is_divers)
        allocations_qs = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=factures_qs
        )
        if exclude_is_divers:
            allocations_qs = allocations_qs.exclude(stock_lot__is_divers=True)
        
        cost_allocated = allocations_qs.aggregate(
            total=Coalesce(
                Sum(F('cost_price') * F('quantity'), output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            )
        )['total']
        
        # Coût des produits non alloués (fallback PMP)
        unallocated_qs = FactureProduit.objects.filter(
            facture__in=factures_qs
        ).annotate(
            has_alloc=Exists(
                FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk'))
            )
        ).filter(has_alloc=False)
        
        if exclude_is_divers:
            unallocated_qs = unallocated_qs.exclude(produit__stock_lots__is_divers=True)
        
        cost_unallocated = unallocated_qs.aggregate(
            total=Coalesce(
                Sum(F('produit__pmp') * F('quantity'), output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            )
        )['total']
        
        total_cost = cost_allocated + cost_unallocated
        
        # CA TTC total
        ca_ttc_total = factures_qs.aggregate(
            total=Coalesce(Sum('total_ttc'), Value(0, output_field=DecimalField()))
        )['total']
        
        # Calcul de la marge avec ratio de remise globale
        # ratio_remise = total_ttc / (total_ttc + remise_globale)
        total_remise = factures_qs.aggregate(
            total=Coalesce(Sum('remise'), Value(0, output_field=DecimalField()))
        )['total']
        
        ratio_remise = Decimal('1')
        if ca_ttc_total + total_remise > 0:
            ratio_remise = ca_ttc_total / (ca_ttc_total + total_remise)
        
        ca_ttc_net = ca_ttc_total * ratio_remise
        marge_brute = ca_ttc_net - total_cost
        marge_pct = (marge_brute / ca_ttc_net * 100) if ca_ttc_net > 0 else Decimal('0.00')
        
        return {
            'ca_ttc_total': ca_ttc_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'ca_ttc_net': ca_ttc_net.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'cout_achat_total': total_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'remise_globale': total_remise.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'ratio_remise': ratio_remise.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
            'marge_brute': marge_brute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_pct': marge_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'nb_factures': Decimal(str(factures_qs.count()))
        }
    
    @staticmethod
    def update_product_margins(product_ids: Optional[List[int]] = None) -> int:
        """
        Met à jour les marges des produits en lot
        
        Args:
            product_ids: Liste des IDs de produits (optionnel, tous si None)
            
        Returns:
            Nombre de produits mis à jour
        """
        queryset = Produit.objects.all()
        if product_ids:
            queryset = queryset.filter(id__in=product_ids)
        
        updated_count = 0
        for product in queryset:
            if product.cost_price and product.selling_price:
                margins = MarginService.calculate_product_margin(
                    product.cost_price, 
                    product.selling_price
                )
                product.taux_marge = margins['taux_marge']
                product.pourcentage_marge = margins['pourcentage_marge']
                product.save(update_fields=['taux_marge', 'pourcentage_marge'])
                updated_count += 1
        
        return updated_count
    
    @staticmethod
    def get_margin_variance_analysis(
        date_debut, 
        date_fin,
        date_debut_compare=None,
        date_fin_compare=None
    ) -> Dict:
        """
        Analyse de variance des marges entre deux périodes
        
        Args:
            date_debut: Date début période actuelle
            date_fin: Date fin période actuelle
            date_debut_compare: Date début période comparaison
            date_fin_compare: Date fin période comparaison
            
        Returns:
            Dict avec analyse de variance
        """
        # Période actuelle
        current_stats = MarginService.calculate_period_margin(date_debut, date_fin)
        
        # Période comparaison (par défaut période précédente)
        if not date_debut_compare or not date_fin_compare:
            days_diff = (date_fin - date_debut).days
            date_fin_compare = date_debut - timedelta(days=1)
            date_debut_compare = date_fin_compare - timedelta(days=days_diff)
        
        compare_stats = MarginService.calculate_period_margin(date_debut_compare, date_fin_compare)
        
        # Calcul variance
        variance_amount = current_stats['marge_brute'] - compare_stats['marge_brute']
        variance_pct = (variance_amount / compare_stats['marge_brute'] * 100) if compare_stats['marge_brute'] > 0 else Decimal('0.00')
        
        return {
            'period1': {
                'label': f"{date_debut.strftime('%d/%m/%Y')} - {date_fin.strftime('%d/%m/%Y')}",
                'stats': current_stats
            },
            'period2': {
                'label': f"{date_debut_compare.strftime('%d/%m/%Y')} - {date_fin_compare.strftime('%d/%m/%Y')}",
                'stats': compare_stats
            },
            'variance_amount': variance_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'variance_pct': variance_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        }
    
    @staticmethod
    def get_products_with_anomalous_margins(
        margin_threshold: float = 80.0,
        min_ca: Decimal = Decimal('1000.00')
    ) -> List[Dict]:
        """
        Identifie les produits avec des marges anormalement élevées
        
        Args:
            margin_threshold: Seuil de marge en pourcentage
            min_ca: CA minimum pour considérer le produit
            
        Returns:
            Liste des produits avec marges anormales
        """
        from django.db.models import Avg, Count
        
        # Requête optimisée pour identifier les produits suspects
        suspicious = FactureProduit.objects.filter(
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            cost_price__gt=0
        ).values('produit__id', 'produit__name', 'produit__pmp').annotate(
            total_ca=Coalesce(
                Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            ),
            avg_margin_pct=Avg(
                (F('selling_price') - F('cost_price')) / F('selling_price') * 100,
                output_field=DecimalField()
            ),
            nb_ventes=Count('id')
        ).filter(
            total_ca__gte=min_ca,
            avg_margin_pct__gte=margin_threshold
        ).order_by('-avg_margin_pct')[:20]
        
        return [
            {
                'produit_id': item['produit__id'],
                'produit_name': item['produit__name'],
                'produit_pmp': item['produit__pmp'],
                'avg_margin_pct': item['avg_margin_pct'],
                'total_ca': item['total_ca'],
                'nb_ventes': item['nb_ventes']
            }
            for item in suspicious
        ]


# Instance globale pour faciliter l'utilisation
margin_service = MarginService()
