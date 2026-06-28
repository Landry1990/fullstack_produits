from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import F, Sum, DecimalField, Q
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from ...models import (
    StockLot, Produit, Fournisseur, Commande, CommandeProduit
)
from ...pagination import StandardResultsSetPagination


class StatsUGViewSet(viewsets.GenericViewSet):
    """
    ViewSet pour les statistiques des unités gratuites (UG).
    """
    queryset = StockLot.objects.all()
    
    @action(detail=False, methods=['get'])
    def par_fournisseur(self, request):
        fournisseur_id = request.query_params.get('fournisseur_id')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        lots_query = StockLot.objects.filter(quantity_free__gt=0)
        if fournisseur_id:
            lots_query = lots_query.filter(fournisseur_id=fournisseur_id)
        if date_debut:
            lots_query = lots_query.filter(date_reception__gte=date_debut)
        if date_fin:
            lots_query = lots_query.filter(date_reception__lte=date_fin)
        
        # Coalesce: use Command Supplier if available, else Lot Supplier
        stats = lots_query.annotate(
            effective_fournisseur_id=Coalesce(
                'commande_produit__commande__fournisseur_id',
                'fournisseur_id'
            ),
            effective_fournisseur_name=Coalesce(
                'commande_produit__commande__fournisseur__name',
                'fournisseur__name'
            )
        ).values(
            'effective_fournisseur_id',
            'effective_fournisseur_name'
        ).annotate(
            ug_recues=Sum('quantity_free'),
            ug_restantes=Sum('quantity_free_remaining'),
            valeur_acquise=Sum(F('quantity_free') * F('selling_price'), 
                                output_field=DecimalField()),
            valeur_restante=Sum(F('quantity_free_remaining') * F('selling_price'),
                output_field=DecimalField()
            )
        ).order_by('-ug_recues')
        
        results = []
        for stat in stats:
            ug_recues = int(stat['ug_recues'] or 0)
            if ug_recues <= 0: continue
                
            ug_restantes = int(stat['ug_restantes'] or 0)
            ug_vendues = ug_recues - ug_restantes
            valeur_acquise = float(stat['valeur_acquise'] or 0)
            valeur_restante = float(stat['valeur_restante'] or 0)
            valeur_vendue = valeur_acquise - valeur_restante

            results.append({
                'fournisseur_id': stat['effective_fournisseur_id'],
                'fournisseur_nom': stat['effective_fournisseur_name'],
                'ug_recues': ug_recues,
                'ug_vendues': ug_vendues,
                'ug_restantes': ug_restantes,
                'valeur_acquise': valeur_acquise,
                'valeur_vendue': valeur_vendue,
                'valeur_restante': valeur_restante
            })
        
        return Response({
            'results': results,
            'total': {
                'ug_recues': sum(r['ug_recues'] for r in results),
                'ug_vendues': sum(r['ug_vendues'] for r in results),
                'ug_restantes': sum(r['ug_restantes'] for r in results),
                'valeur_acquise': sum(r['valeur_acquise'] for r in results),
                'valeur_vendue': sum(r['valeur_vendue'] for r in results),
                'valeur_restante': sum(r['valeur_restante'] for r in results)
            }
        })
    
    @action(detail=False, methods=['get'])
    def par_produit(self, request):
        produit_id = request.query_params.get('produit_id')
        if not produit_id:
            return Response({'error': 'produit_id est requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        lots = StockLot.objects.filter(
            produit_id=produit_id,
            quantity_free__gt=0
        ).select_related('fournisseur', 'commande_produit__commande').order_by('-date_reception')
        
        historique = []
        ug_en_stock = 0
        
        for lot in lots:
            ug_remaining_in_lot = lot.quantity_free_remaining
            ug_en_stock += ug_remaining_in_lot
            
            historique.append({
                'commande_id': lot.commande_produit.commande.id,
                'fournisseur': lot.fournisseur.name,
                'date_reception': lot.date_reception,
                'ug_recues': lot.quantity_free,
                'ug_restantes': ug_remaining_in_lot,
                'lot_numero': lot.lot,
                'date_expiration': lot.date_expiration
            })
        
        total_ug_recues = lots.aggregate(total=Sum('quantity_free'))['total'] or 0
        
        return Response({
            'produit_id': produit_id,
            'total_ug_recues': int(total_ug_recues),
            'ug_en_stock': ug_en_stock,
            'ug_vendues': int(total_ug_recues) - ug_en_stock,
            'historique': historique
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_summary(self, request):
        now = timezone.now()
        debut_mois = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        total_ug_stock = StockLot.objects.filter(quantity_free_remaining__gt=0).aggregate(
            total=Sum('quantity_free_remaining')
        )['total'] or 0
        
        ug_mois = CommandeProduit.objects.filter(
            created_at__gte=debut_mois, unites_gratuites__gt=0
        ).aggregate(total=Sum('unites_gratuites'))['total'] or 0
        
        valeur_economisee = StockLot.objects.filter(quantity_free__gt=0).aggregate(
            total=Sum(F('quantity_free') * F('selling_price'), output_field=DecimalField())
        )['total'] or 0
        
        return Response({
            'ug_en_stock': int(total_ug_stock),
            'ug_recues_mois': int(ug_mois),
            'valeur_economisee': float(valeur_economisee),
            'periode': {'debut': debut_mois.isoformat(), 'fin': now.isoformat()}
        })


class StockAnalysisUnsoldView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fournisseur_id = request.query_params.get('fournisseur', None)
        days_threshold = int(request.query_params.get('days', 30))  # Default: 30 jours après dernière entrée
        
        # Paramètres de pagination
        try:
            page = int(request.query_params.get('page', 1))
            if page < 1: page = 1
        except ValueError:
            page = 1
            
        from ...centralized_configs import PaginationHelper, PaginationDefaults
        page_size = PaginationHelper.get_page_size(request, PaginationDefaults.DEFAULT_ANALYSIS_PAGE_SIZE)
        
        today = timezone.now()
        cutoff_date = (today - timedelta(days=days_threshold)).date()
        
        # Invendus = produits en stock dont la dernière ENTRÉE (dernier_achat)
        # date de plus de X jours ET aucune vente depuis cette entrée
        produits = Produit.objects.filter(
            stock__gt=0,
            dernier_achat__isnull=False,
            dernier_achat__lte=cutoff_date  # Entrée en stock depuis + de X jours
        ).filter(
            # Pas de vente du tout, OU dernière vente AVANT la dernière entrée en stock
            Q(dernier_vente__isnull=True) | Q(dernier_vente__lt=F('dernier_achat'))
        ).select_related('fournisseur')
        
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
        results = []
        total_value = Decimal('0.00')
        
        for produit in produits:
            value = Decimal(str(produit.stock)) * Decimal(str(produit.cost_price))
            
            # Calculate days since last sale
            if produit.dernier_vente:
                days_since_sale = (today.date() - produit.dernier_vente).days
            elif produit.dernier_achat:
                days_since_sale = (today.date() - produit.dernier_achat).days
            else:
                days_since_sale = (today - produit.created_at).days
            
            results.append({
                'id': produit.id,
                'cip': produit.cip1 if hasattr(produit, 'cip1') else '',
                'name': produit.name,
                'stock': produit.stock,
                'stock_maximum': produit.stock_maximum,
                'cost_price': float(produit.cost_price or 0),
                'selling_price': float(produit.selling_price or 0),
                'value': float(value),
                'days_since_sale': days_since_sale,
                'derniere_vente': produit.dernier_vente,
                'dernier_achat': produit.dernier_achat,
                'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A'
            })
            total_value += value
        
        # Sort by days since sale (most stagnant first)
        results.sort(key=lambda x: x['days_since_sale'], reverse=True)
        
        # Pagination
        total_items = len(results)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_results = results[start:end]
        
        return Response({
            'type': 'invendus',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': total_items, # Conserve global count
            'total_value': float(total_value), # Conserve global value
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'items': paginated_results
        })

class StockAnalysisOverstockView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fournisseur_id = request.query_params.get('fournisseur', None)
        
        # Paramètres de pagination
        try:
            page = int(request.query_params.get('page', 1))
            if page < 1: page = 1
        except ValueError:
            page = 1
            
        try:
            page_size = int(request.query_params.get('page_size', 50))
            if page_size < 1: page_size = 50
        except ValueError:
            page_size = 50
        
        produits = Produit.objects.filter(stock__gt=0, rotation_moyenne__gt=0).select_related('fournisseur')
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
        results = []
        total_value = Decimal('0.00')
        
        for produit in produits:
            rotation = float(produit.rotation_moyenne)
            threshold = rotation * 1.7
            
            if produit.stock > threshold:
                excess_qty = produit.stock - int(threshold)
                excess_value = Decimal(excess_qty) * Decimal(str(produit.cost_price))
                
                results.append({
                    'id': produit.id,
                    'cip': produit.cip1 if hasattr(produit, 'cip1') else '',
                    'name': produit.name,
                    'stock': produit.stock,
                    'rotation': rotation,
                    'threshold': round(threshold, 2),
                    'excess_qty': excess_qty,
                    'cost_price': float(produit.cost_price or 0),
                    'selling_price': float(produit.selling_price or 0),
                    'value': float(excess_value),
                    'total_value_stock': float(Decimal(produit.stock) * Decimal(str(produit.cost_price))),
                    'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A'
                })
                total_value += excess_value
        
        # Pagination
        total_items = len(results)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_results = results[start:end]
        
        return Response({
            'type': 'surstock',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': total_items, # Conserve global count
            'total_value': float(total_value), # Conserve global value
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'items': paginated_results
        })


class StockAnalysisShortageView(APIView):
    """
    Prévision intelligente des ruptures de stock.
    
    Améliorations par rapport à une moyenne simple :
    1. Moyenne pondérée : les 7 derniers jours pèsent 2x plus que les 23 précédents
       → détecte les hausses/baisses récentes de demande
    2. Commandes en cours : les commandes PREP/ATT sont prises en compte
       comme réapprovisionnement attendu
    3. Tendance : compare la semaine récente à la période précédente
       → identifie si la demande accélère ou ralentit
    4. Suggestion commande : quantité recommandée pour assurer 30j de couverture
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ...models import Facture, FactureProduit

        fournisseur_id = request.query_params.get('fournisseur', None)
        horizon_jours = int(request.query_params.get('horizon', 30))
        
        # Paramètres de pagination
        try:
            page = int(request.query_params.get('page', 1))
            if page < 1: page = 1
        except ValueError:
            page = 1
            
        try:
            page_size = int(request.query_params.get('page_size', 50))
            if page_size < 1: page_size = 50
        except ValueError:
            page_size = 50
            
        today = timezone.localtime(timezone.now()).date()
        date_30_days_ago = today - timedelta(days=30)
        date_7_days_ago = today - timedelta(days=7)

        # ── 1. Produits avec stock > 0 ──
        produits = Produit.objects.filter(stock__gt=0).select_related('fournisseur')
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)

        # ── 2. Ventes des 30 derniers jours (séparées en 2 périodes) ──
        # Période récente : 7 derniers jours
        ventes_recentes = (
            FactureProduit.objects
            .filter(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=date_7_days_ago,
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(total_vendu=Sum('quantity'))
        )
        map_recentes = {v['produit_id']: v['total_vendu'] for v in ventes_recentes}

        # Période ancienne : jours 8 à 30
        ventes_anciennes = (
            FactureProduit.objects
            .filter(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=date_30_days_ago,
                facture__date__date__lt=date_7_days_ago,
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(total_vendu=Sum('quantity'))
        )
        map_anciennes = {v['produit_id']: v['total_vendu'] for v in ventes_anciennes}

        # ── 3. Commandes en cours (réapprovisionnement attendu) ──
        commandes_en_cours = (
            CommandeProduit.objects
            .filter(
                commande__status__in=[Commande.Status.EN_PREPARATION, Commande.Status.EN_ATTENTE],
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(
                qte_commandee=Sum('quantity'),
                ug_commandees=Sum('unites_gratuites')
            )
        )
        map_commandes = {
            c['produit_id']: (c['qte_commandee'] or 0) + (c['ug_commandees'] or 0)
            for c in commandes_en_cours
        }

        # ── 4. Calcul prédictif pour chaque produit ──
        results = []
        total_value_at_risk = Decimal('0.00')

        for produit in produits:
            vendu_recent = map_recentes.get(produit.id, 0)    # 7 derniers jours
            vendu_ancien = map_anciennes.get(produit.id, 0)    # jours 8-30
            qte_en_commande = map_commandes.get(produit.id, 0)

            # Pas de ventes du tout → pas de prédiction possible
            if vendu_recent + vendu_ancien <= 0:
                continue

            # ── Moyenne pondérée ──
            taux_journalier_recent = vendu_recent / 7.0
            taux_journalier_ancien = vendu_ancien / 23.0 if vendu_ancien > 0 else 0

            if taux_journalier_ancien > 0:
                # Moyenne pondérée : récent pèse 2x
                ventes_jour = (taux_journalier_recent * 2 + taux_journalier_ancien) / 3.0
            else:
                # Pas de données anciennes, utiliser uniquement le récent
                ventes_jour = taux_journalier_recent

            if ventes_jour <= 0:
                continue

            # ── Tendance (hausse/baisse de demande) ──
            if taux_journalier_ancien > 0:
                tendance_pct = ((taux_journalier_recent - taux_journalier_ancien) / taux_journalier_ancien) * 100
            else:
                tendance_pct = 0

            # Déterminer direction de la tendance
            if tendance_pct > 15:
                tendance = 'hausse'
            elif tendance_pct < -15:
                tendance = 'baisse'
            else:
                tendance = 'stable'

            # ── Stock effectif (stock actuel + commandes en cours) ──
            stock_effectif = produit.stock + qte_en_commande

            # ── Jours avant rupture ──
            jours_avant_rupture = produit.stock / ventes_jour  # Sans les commandes
            jours_avec_commandes = stock_effectif / ventes_jour  # Avec les commandes

            # Filtrer : n'afficher que les produits à risque dans l'horizon
            if jours_avant_rupture > horizon_jours:
                continue

            # ── Niveau d'urgence ──
            if jours_avant_rupture < 7:
                urgence = 'critical'
            elif jours_avant_rupture < 14:
                urgence = 'warning'
            else:
                urgence = 'caution'

            # ── Quantité suggérée à commander ──
            couverture_cible = 30
            besoin_total = ventes_jour * couverture_cible
            qte_suggeree = max(0, int(besoin_total - stock_effectif + 0.5))

            # ── Valeur à risque ──
            value_at_risk = Decimal(str(produit.stock)) * Decimal(str(produit.cost_price or 0))
            total_value_at_risk += value_at_risk

            results.append({
                'id': produit.id,
                'cip': produit.cip1 if hasattr(produit, 'cip1') else '',
                'name': produit.name,
                'stock': produit.stock,
                'avg_daily_sales': round(ventes_jour, 2),
                'days_until_stockout': round(jours_avant_rupture, 1),
                'days_with_pending_orders': round(jours_avec_commandes, 1),
                'cost_price': float(produit.cost_price or 0),
                'selling_price': float(produit.selling_price or 0),
                'value': float(value_at_risk),
                'urgency': urgence,
                'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A',
                # Nouvelles données intelligentes
                'pending_orders': qte_en_commande,
                'suggested_order_qty': qte_suggeree,
                'trend': tendance,
                'trend_pct': round(tendance_pct, 1),
                'sold_last_7d': vendu_recent,
                'sold_prev_23d': vendu_ancien,
            })

        # Trier par urgence (jours restants croissants)
        results.sort(key=lambda x: x['days_until_stockout'])

        # Compteurs par urgence globaux
        critical_count = sum(1 for r in results if r['urgency'] == 'critical')
        warning_count = sum(1 for r in results if r['urgency'] == 'warning')
        trending_up = sum(1 for r in results if r['trend'] == 'hausse')
        
        # Pagination
        total_items = len(results)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_results = results[start:end]

        return Response({
            'type': 'shortage',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': total_items, # Conserve global
            'total_value': float(total_value_at_risk), # Conserve global
            'critical_count': critical_count,
            'warning_count': warning_count,
            'trending_up_count': trending_up,
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'items': paginated_results
        })
