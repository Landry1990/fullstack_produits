from datetime import timedelta
from decimal import Decimal

from django.db.models import F, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...centralized_configs import PaginationDefaults, PaginationHelper
from ...models import Facture, Produit, StockLot


class CadencierViewSet(viewsets.ViewSet):
    """
    Cadencier de stock : aide à la décision d'approvisionnement.
    Calcule rotation, couverture et quantités suggérées par produit.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        coverage_days = int(request.query_params.get('coverage_days', 30))
        coverage_days = max(coverage_days, 1)
        coverage_days = min(coverage_days, 365)

        rayon_id = request.query_params.get('rayon')
        fournisseur_id = request.query_params.get('fournisseur')
        search = (request.query_params.get('search') or '').strip()
        request.query_params.get('type', 'grossiste')  # grossiste | divers
        only_below_target = request.query_params.get('only_below_target', 'true').lower() != 'false'
        min_rotation = request.query_params.get('min_rotation')

        # Produits actifs
        queryset = Produit.objects.filter(is_active=True)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(cip1__icontains=search) |
                Q(cip2__icontains=search) |
                Q(cip3__icontains=search)
            )

        if rayon_id:
            queryset = queryset.filter(rayon_id=rayon_id)

        if fournisseur_id:
            queryset = queryset.filter(fournisseur_id=fournisseur_id)
        # Note : on ne filtre pas par fournisseur par defaut car de nombreux produits actifs
        # n'ont pas de fournisseur principal renseigne mais peuvent neanmoins etre commandes.

        # Annotation du dernier prix d'achat via StockLot et des ventes sur la période
        last_price_subquery = StockLot.objects.filter(
            produit=OuterRef('pk')
        ).order_by('-date_reception').values('price_cost')[:1]

        # Utiliser une période d'analyse suffisante (max 90j) pour avoir une rotation fiable
        analyse_days = max(coverage_days, 30)
        date_debut = timezone.now() - timedelta(days=analyse_days)

        queryset = queryset.select_related('fournisseur', 'rayon').annotate(
            last_price_cost=Coalesce(Subquery(last_price_subquery), F('cost_price'), Decimal('0.00')),
            ventes_periode=Coalesce(Sum(
                'factureproduit__quantity',
                filter=Q(
                    factureproduit__facture__date__gte=date_debut,
                    factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
                )
            ), 0)
        )

        # Calculer toutes les métriques en Python, filtrer, puis paginer
        all_results = []
        for p in queryset:
            stock = int(p.stock or 0)
            ventes_periode = int(p.ventes_periode or 0)

            # Rotation journalière basée sur les ventes réelles de la période
            rotation_jour = ventes_periode / float(analyse_days) if analyse_days > 0 else 0.0
            # Rotation mensuelle (blend entre ventes réelles et rotation_moyenne stockée)
            rotation_mensuelle_stockee = float(p.rotation_moyenne or 0)
            rotation_mensuelle = round(rotation_jour * 30, 2)
            if rotation_mensuelle_stockee > 0 and rotation_mensuelle == 0:
                rotation_mensuelle = rotation_mensuelle_stockee
                rotation_jour = rotation_mensuelle / 30.0

            if rotation_jour > 0:
                couverture_jours = int(stock / rotation_jour)
            else:
                couverture_jours = 9999

            stock_cible = int(rotation_jour * coverage_days)
            if rotation_jour > 0 and stock_cible < 1:
                stock_cible = 1

            quantite_suggeree = max(0, stock_cible - stock)

            # Ne commander que si :
            # - Il y a une rotation (ventes récentes) ET stock < stock_cible
            # - OU le stock est sous le minimum défini
            if rotation_jour > 0 and stock < stock_cible:
                # Cas normal : rotation > 0, on complète jusqu'au stock cible
                quantite_suggeree = stock_cible - stock
            elif p.stock_minimum and p.stock_minimum > 0 and stock < p.stock_minimum:
                # Cas alerte : rotation nulle mais stock minimum défini
                quantite_suggeree = p.stock_minimum - stock
                stock_cible = p.stock_minimum
            else:
                # Pas de commande nécessaire (rotation nulle ET pas de stock minimum)
                quantite_suggeree = 0
                stock_cible = stock

            # Appliquer les contraintes max/min après le calcul
            if p.stock_maximum and p.stock_maximum > 0:
                stock_cible = min(stock_cible, int(p.stock_maximum))
                quantite_suggeree = max(0, stock_cible - stock)

            prix_achat = float(p.last_price_cost or p.cost_price or 0)
            montant_ht = prix_achat * quantite_suggeree

            # Détermination de l'urgence
            if stock <= 0 and rotation_jour > 0:
                # Rupture seulement s'il y a une rotation (produit demandé)
                urgence = 'rupture'
            elif p.stock_minimum and p.stock_minimum > 0 and stock < p.stock_minimum:
                urgence = 'alerte'
            elif rotation_jour > 0 and couverture_jours < coverage_days / 2:
                urgence = 'surveillance'
            else:
                urgence = 'ok'

            item = {
                'produit_id': p.id,
                'produit_nom': p.name,
                'cip1': p.cip1 or '',
                'stock': stock,
                'stock_minimum': p.stock_minimum or 0,
                'stock_maximum': p.stock_maximum or 0,
                'rotation_moyenne': round(rotation_mensuelle, 2),
                'rotation_jour': round(rotation_jour, 4),
                'ventes_periode': ventes_periode,
                'couverture_jours': couverture_jours,
                'couverture_cible': coverage_days,
                'stock_cible': stock_cible,
                'quantite_suggeree': quantite_suggeree,
                'prix_achat': prix_achat,
                'montant_ht': round(montant_ht, 2),
                'fournisseur_id': p.fournisseur.id if p.fournisseur else None,
                'fournisseur_nom': p.fournisseur.name if p.fournisseur else None,
                'rayon_id': p.rayon.id if p.rayon else None,
                'rayon_nom': p.rayon.name if p.rayon else None,
                'urgence': urgence,
                'is_supplier_exclusive': p.is_supplier_exclusive,
                'tva': str(p.tva or '0'),
                'taux_marge': str(p.taux_marge or '1.3'),
            }

            # Filtre "uniquement ceux qui méritent d'être commandés"
            # On garde les ruptures/alertes même si la quantité suggérée est faible
            if only_below_target and urgence == 'ok' and quantite_suggeree <= 0:
                continue

            if min_rotation:
                try:
                    if rotation_mensuelle < float(min_rotation):
                        continue
                except (ValueError, TypeError):
                    pass

            all_results.append(item)

        # Tri par urgence puis par montant HT
        urgence_order = {'rupture': 0, 'alerte': 1, 'surveillance': 2, 'ok': 3}
        all_results.sort(key=lambda x: (urgence_order.get(x['urgence'], 99), -x['montant_ht']))

        total_ht = sum(item['montant_ht'] for item in all_results)
        total_quantite = sum(item['quantite_suggeree'] for item in all_results)
        count = len(all_results)

        # Pagination manuelle après filtrage
        page_size = PaginationHelper.get_page_size(request, PaginationDefaults.DEFAULT_LIST_PAGE_SIZE)
        page_param = request.query_params.get('page', 1)
        try:
            page_num = max(1, int(page_param))
        except (ValueError, TypeError):
            page_num = 1

        start = (page_num - 1) * page_size
        end = start + page_size
        paginated = all_results[start:end]

        total_pages = max(1, (count + page_size - 1) // page_size)
        next_link = f'?page={page_num + 1}' if page_num < total_pages else None
        previous_link = f'?page={page_num - 1}' if page_num > 1 else None

        return Response({
            'count': count,
            'coverage_days': coverage_days,
            'total_ht': round(total_ht, 2),
            'total_quantite': total_quantite,
            'next': next_link,
            'previous': previous_link,
            'results': paginated
        })
