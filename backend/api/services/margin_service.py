"""
Service centralisé pour tous les calculs de marge
Évite les duplications et assure la cohérence des formules
"""
from datetime import date as date_type
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import (
    Avg,
    DecimalField,
    Exists,
    F,
    OuterRef,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from api.models import (
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    Produit,
    StockLot,
)
from api.utils.dates import day_start


def _to_aware_datetime(d):
    """Convert a date or naive datetime to a timezone-aware datetime."""
    if isinstance(d, date_type) and not isinstance(d, datetime):
        d = datetime(d.year, d.month, d.day)
    if timezone.is_naive(d):
        d = timezone.make_aware(d)
    return d


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
    ) -> dict[str, Decimal]:
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
        selling_price: Decimal | None = None
    ) -> dict[str, Decimal]:
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
    def calculate_facture_margin(facture: Facture) -> dict[str, Decimal]:
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
        
        # Lignes vendues sans allocation de lot : coût au PMP du produit
        # (sinon coût 0 → marge gonflée).
        sans_lot = FactureProduit.objects.filter(facture=facture).annotate(
            has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
        ).filter(has_alloc=False).aggregate(
            cout=Coalesce(
                Sum(F('quantity') * Coalesce(F('produit__pmp'), Value(0, output_field=DecimalField())),
                    output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            )
        )

        cout_achat = allocations['cout_achat'] + sans_lot['cout']
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
    ) -> dict[str, Decimal]:
        """
        Calcule la marge sur une période avec requête optimisée
        
        Args:
            date_debut: Date de début
            date_fin: Date de fin
            factures_qs: Queryset de factures (optionnel)
            
        Returns:
            Dict avec statistiques de marge sur la période
        """
        from api.services.ventes_lots import collect_sales_records, factures_retenues

        if factures_qs is None:
            factures_qs = factures_retenues().filter(
                date__gte=_to_aware_datetime(date_debut),
                date__lt=_to_aware_datetime(date_fin)
            )

        records = collect_sales_records(invoices=factures_qs)
        ca_ht = sum((r['vente_ht'] for r in records), Decimal(0))
        cout_achat = sum((r['achat'] for r in records), Decimal(0))
        marge_brute = ca_ht - cout_achat
        marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')

        return {
            'ca_ht_total': ca_ht.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'cout_achat_total': cout_achat.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_brute': marge_brute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_pct': marge_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'nb_factures': len({r['facture_id'] for r in records})
        }
    
    @staticmethod
    def calculate_period_margin_with_discounts(
        date_debut,
        date_fin,
        factures_qs=None,
        exclude_is_divers=True
    ) -> dict[str, Decimal]:
        """
        Calcule la marge sur une période via collect_sales_records() :
        ventes tracées par lot au coût du lot, lignes sans allocation au PMP,
        remises ligne/globale et TVA par ligne. Marge calculée sur le CA HT.
        ratio_remise est conservé pour compatibilité (CA TTC net / brut).
        
        Args:
            date_debut: Date de début
            date_fin: Date de fin
            factures_qs: Queryset de factures (optionnel)
            exclude_is_divers: Exclure les lots is_divers (défaut True)
            
        Returns:
            Dict avec statistiques de marge sur la période
        """
        from api.services.ventes_lots import collect_sales_records, factures_retenues

        if factures_qs is None:
            factures_qs = factures_retenues().filter(
                date__gte=_to_aware_datetime(date_debut),
                date__lt=_to_aware_datetime(date_fin)
            )

        records = collect_sales_records(invoices=factures_qs)
        if exclude_is_divers:
            records = [r for r in records if not r['is_divers']]

        # vente = TTC net de remises (ligne + globale) ; marge sur le HT
        ca_ttc_net = sum((r['vente'] for r in records), Decimal(0))
        ca_ht = sum((r['vente_ht'] for r in records), Decimal(0))
        total_cost = sum((r['achat'] for r in records), Decimal(0))
        total_remise = Decimal(factures_qs.filter(
            pk__in={r['facture_id'] for r in records}
        ).aggregate(
            total=Coalesce(Sum('remise'), Value(0, output_field=DecimalField()))
        )['total'] or 0)

        ratio_remise = Decimal(1)
        if ca_ttc_net + total_remise > 0:
            ratio_remise = ca_ttc_net / (ca_ttc_net + total_remise)

        marge_brute = ca_ht - total_cost
        marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')

        return {
            'ca_ttc_total': ca_ttc_net.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'ca_ttc_net': ca_ttc_net.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'cout_achat_total': total_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'remise_globale': total_remise.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'ratio_remise': ratio_remise.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
            'marge_brute': marge_brute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'marge_pct': marge_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'nb_factures': Decimal(str(len({r['facture_id'] for r in records})))
        }
    
    @staticmethod
    def calculate_daily_margin_with_discounts(
        date_debut,
        date_fin,
        exclude_is_divers=True
    ) -> dict[date_type, dict[str, Decimal]]:
        """
        Calcule les marges journalières sur une période via collect_sales_records(),
        regroupées par jour local. Même logique que calculate_period_margin_with_discounts :
        marge sur le CA HT, CA TTC net de remises, coût lot ou PMP.
        
        Args:
            date_debut: Date de début (date ou datetime)
            date_fin: Date de fin (date ou datetime)
            exclude_is_divers: Exclure les lots is_divers (même logique que calculate_period_margin_with_discounts)
            
        Returns:
            Dict {date: {ca_ttc_total, ca_ttc_net, cout_achat_total, remise_globale,
                         ratio_remise, marge_brute, marge_pct, nb_factures}}
        """
        from api.services.ventes_lots import collect_sales_records, factures_retenues

        if isinstance(date_debut, datetime):
            date_debut = date_debut.date()
        if isinstance(date_fin, datetime):
            date_fin = date_fin.date()

        factures_qs = factures_retenues().filter(
            date__gte=day_start(date_debut),
            date__lt=day_start(date_fin + timedelta(days=1)),
        )
        records = collect_sales_records(invoices=factures_qs)
        if exclude_is_divers:
            records = [r for r in records if not r['is_divers']]

        remises = dict(
            Facture.objects.filter(pk__in={r['facture_id'] for r in records})
            .values_list('id', 'remise')
        )

        results: dict[date_type, dict[str, Decimal]] = {}
        days: dict[date_type, dict] = {}
        for r in records:
            day = timezone.localtime(r['date']).date()
            entry = days.setdefault(day, {
                'ca_ttc': Decimal(0), 'ca_ht': Decimal(0), 'cost': Decimal(0),
                'factures': set(),
            })
            entry['ca_ttc'] += r['vente']
            entry['ca_ht'] += r['vente_ht']
            entry['cost'] += r['achat']
            entry['factures'].add(r['facture_id'])

        for day, entry in days.items():
            total_remise = sum(
                (remises.get(f_id) or Decimal(0) for f_id in entry['factures']), Decimal(0)
            )
            ca_ttc_net = entry['ca_ttc']
            ratio_remise = Decimal(1)
            if ca_ttc_net + total_remise > 0:
                ratio_remise = ca_ttc_net / (ca_ttc_net + total_remise)
            ca_ht = entry['ca_ht']
            marge_brute = ca_ht - entry['cost']
            marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')

            results[day] = {
                'ca_ttc_total': ca_ttc_net.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'ca_ttc_net': ca_ttc_net.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'cout_achat_total': entry['cost'].quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'remise_globale': total_remise.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'ratio_remise': ratio_remise.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
                'marge_brute': marge_brute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'marge_pct': marge_pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'nb_factures': len(entry['factures'])
            }

        return results
    
    @staticmethod
    def update_product_margins(product_ids: list[int] | None = None) -> int:
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
    ) -> dict:
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
    ) -> list[dict]:
        """
        Identifie les produits avec des marges anormalement élevées
        
        Args:
            margin_threshold: Seuil de marge en pourcentage
            min_ca: CA minimum pour considérer le produit
            
        Returns:
            Liste des produits avec marges anormales
        """
        from django.db.models import Count
        
        # Requête optimisée pour identifier les produits suspects
        suspicious = FactureProduit.objects.filter(
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            produit__cost_price__gt=0
        ).values('produit__id', 'produit__name', 'produit__pmp').annotate(
            total_ca=Coalesce(
                Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            ),
            avg_margin_pct=Avg(
                (F('selling_price') - F('produit__cost_price')) / F('selling_price') * 100,
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
