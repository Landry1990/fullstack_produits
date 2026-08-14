"""Mixin pour les actions de reporting de la caisse :
ventes_diverses, get_totals, page_init, get_user_shift.
"""
import logging
from datetime import datetime
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ....centralized_configs import StandardResultsSetPagination
from ....models import Caisse, ClotureCaisse, MouvementCaisse
from ....serializers import MouvementCaisseSerializer
from ...rapports.tz_utils import parse_api_datetime as _parse_iso_datetime

logger = logging.getLogger(__name__)


class CaisseReportingMixin:
    """Actions de reporting et statistiques pour CaisseViewSet."""

    def _serialize_allocation(self, alloc):
        """Sérialise une FactureProduitAllocation divers."""
        return {
            'id': alloc.id,
            'date': alloc.created_at,
            'produit_name': (
                alloc.facture_produit.produit.name
                if alloc.facture_produit.produit
                else alloc.facture_produit.produit_nom or 'Produit supprimé'
            ),
            'facture_numero': alloc.facture_produit.facture.numero_facture if alloc.facture_produit.facture else 'N/A',
            'quantity': alloc.quantity,
            'selling_price': float(alloc.selling_price),
            'total': float(alloc.quantity * alloc.selling_price),
            'lot': alloc.stock_lot.lot if alloc.stock_lot else 'N/A'
        }

    @action(detail=False, methods=['get'])
    def ventes_diverses(self, request):
        """
        Liste paginée des produits divers vendus par période, avec total CA global.
        """
        from ....models import FactureProduitAllocation

        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')

        # Validation des dates
        if date_debut and date_fin:
            try:
                d_debut = datetime.strptime(date_debut, '%Y-%m-%d').date()
                d_fin = datetime.strptime(date_fin, '%Y-%m-%d').date()

                if d_debut > d_fin:
                    return Response(
                        {'detail': 'La date de début doit être antérieure à la date de fin'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Limite de plage temporelle (max 1 an)
                if (d_fin - d_debut).days > 365:
                    return Response(
                        {'detail': 'La plage de dates ne peut excéder 1 an'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except ValueError:
                return Response(
                    {'detail': 'Format de date invalide. Utiliser YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        queryset = FactureProduitAllocation.objects.filter(
            stock_lot__is_divers=True,
            facture_produit__facture__status__in=['VAL', 'PAY']
        ).select_related(
            'facture_produit__produit',
            'facture_produit__facture',
            'stock_lot'
        ).order_by('-created_at')

        if date_debut:
            queryset = queryset.filter(created_at__date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(created_at__date__lte=date_fin)

        # Agrégation DB pour le total CA (pas de boucle Python)
        from django.db.models import ExpressionWrapper
        total_ca = queryset.aggregate(
            ca=Sum(ExpressionWrapper(F('quantity') * F('selling_price'), output_field=DecimalField()))
        )['ca'] or Decimal('0.00')

        # Pagination avec DRF (headers + metadata)
        from ....centralized_configs import (
            PaginationDefaults,
            PaginationHelper,
        )
        paginator = StandardResultsSetPagination()
        paginator.page_size = PaginationHelper.get_page_size(request, PaginationDefaults.DEFAULT_LIST_PAGE_SIZE)

        group_by = request.query_params.get('group_by')
        single_date = request.query_params.get('date')

        # Filtrage sur une date unique (pour le détail d'un jour)
        if single_date:
            try:
                datetime.strptime(single_date, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date=single_date)
            except ValueError:
                return Response(
                    {'detail': 'Format de date invalide. Utiliser YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Regroupement par jour
        if group_by == 'day':
            from django.db.models.functions import TruncDate

            daily_totals = queryset.annotate(
                day=TruncDate('created_at')
            ).values('day').annotate(
                total_ca=Sum(ExpressionWrapper(F('quantity') * F('selling_price'), output_field=DecimalField())),
                total_quantity=Sum('quantity'),
                nb_produits=Count('id'),
                nb_factures=Count('facture_produit__facture', distinct=True)
            ).order_by('-day')

            data = []
            for day in daily_totals:
                data.append({
                    'date': day['day'].isoformat() if day['day'] else None,
                    'total_ca': float(day['total_ca'] or 0),
                    'total_quantity': day['total_quantity'] or 0,
                    'nb_produits': day['nb_produits'] or 0,
                    'nb_factures': day['nb_factures'] or 0,
                })

            return Response({
                'count': len(data),
                'total_ca': float(total_ca),
                'results': data
            })

        page_qs = paginator.paginate_queryset(queryset, request, view=self)

        # Si pas de pagination demandée ou erreur, prendre tout le queryset
        if page_qs is None:
            page_qs = queryset[:paginator.page_size]

        data = [self._serialize_allocation(alloc) for alloc in page_qs]

        # Structure plate compatible avec le frontend (VentesDiversesResponse)
        return Response({
            'count': paginator.page.paginator.count if paginator.page else 0,
            'total_ca': float(total_ca),
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
            'results': data
        })

    @action(detail=False, methods=['get'], url_path='get_totals')
    def get_totals(self, request):
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        user_id = request.query_params.get('user_id') or request.query_params.get('user')
        poste_caisse_id = request.query_params.get('poste_caisse_id')

        start_date = None
        end_date = None

        if date_debut:
            start_date = _parse_iso_datetime(date_debut)
            if start_date is None:
                logger.error(f"Error parsing date_debut {date_debut}")

        if date_fin:
            end_date = _parse_iso_datetime(date_fin)
            if end_date is None:
                logger.error(f"Error parsing date_fin {date_fin}")

        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None

        transactions = Caisse.objects.filter(statut='completee')
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
        if user_id:
            transactions = transactions.filter(user_id=user_id)
        if poste_caisse_id:
            # Assume Caisse belongs to a Facture which belongs to a PosteCaisse
            transactions = transactions.filter(facture__poste_caisse_id=poste_caisse_id)

        # Filtre pour exclure le recouvrement et le dépôt (déjà compté en ENTREE)
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(reference__icontains='[RECOUV]')
        paiements_sales = transactions.exclude(recouvrement_q).exclude(mode_paiement__in=['en_compte', 'depot'])
        paiements_recouv = transactions.filter(recouvrement_q)

        # OPTIMISATION: Regroupe les aggregates en une seule requête par type
        # 1. Totaux des ventes (tous modes + espèces + coupons) en UNE requête
        ventes_aggregated = paiements_sales.aggregate(
            total=Coalesce(Sum('montant'), Value(0, output_field=DecimalField())),
            especes=Coalesce(Sum('montant', filter=Q(mode_paiement='especes')), Value(0, output_field=DecimalField())),
            coupons=-Coalesce(Sum('montant', filter=Q(mode_paiement='coupon')), Value(0, output_field=DecimalField()))
        )
        total_ventes = ventes_aggregated['total']
        ventes_aggregated['especes']
        total_coupons = ventes_aggregated['coupons']

        # 2. Totaux des recouvrements en UNE requête
        recouv_aggregated = paiements_recouv.aggregate(
            total=Coalesce(Sum('montant'), Value(0, output_field=DecimalField())),
            especes=Coalesce(Sum('montant', filter=Q(mode_paiement='especes')), Value(0, output_field=DecimalField()))
        )
        total_recouvrement = recouv_aggregated['total']
        total_recouv_especes = recouv_aggregated['especes']

        # Breakdown séparé pour info (utile pour le frontend)
        modes_ventes = paiements_sales.values('mode_paiement').annotate(total=Sum('montant'))
        details_ventes = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_ventes}

        modes_recouv = paiements_recouv.values('mode_paiement').annotate(total=Sum('montant'))
        details_recouv = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_recouv}

        # OPTIMISATION : details global dérivé en Python depuis details_ventes + details_recouv
        # (évite une 3e requête GROUP BY sur transactions)
        details = dict(details_ventes)
        for key, val in details_recouv.items():
            details[key] = details.get(key, 0) + val

        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        if user_id:
            mouvements = mouvements.filter(user_id=user_id)

        # OPTIMISATION: Déjà optimisé avec un seul aggregate
        moves_aggregated = mouvements.aggregate(
            entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
            sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField()))
        )
        total_entrees = moves_aggregated['entrees']
        total_sorties = moves_aggregated['sorties']

        total_theorique = total_ventes + total_recouvrement + total_entrees - total_sorties

        # Calcul du CA Divers
        from ....models import FactureProduitAllocation
        facture_ids = paiements_sales.values('facture_id')
        allocations_diverses = FactureProduitAllocation.objects.filter(
            facture_produit__facture_id__in=facture_ids,
            stock_lot__is_divers=True
        )
        total_ca_divers = allocations_diverses.aggregate(
            ca_div=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )['ca_div'] or Decimal('0.00')
        total_ca_pharmacie = total_ventes - total_ca_divers

        # Limiter les mouvements audit pour ne pas gonfler la réponse sur de longues périodes
        mouvements_list = []
        mouvements_total = mouvements.count()
        for m in mouvements.select_related('user').order_by('-date')[:100]:
            mouvements_list.append({
                'type': m.type,
                'montant': float(m.montant),
                'motif': m.motif,
                'user_nom': m.user.get_full_name() or m.user.username if m.user else "Inconnu",
                'date': m.date.isoformat()
            })

        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'total_theorique': total_theorique,
            'total_ventes': total_ventes,
            'total_ca_pharmacie': total_ca_pharmacie,
            'total_ca_divers': total_ca_divers,
            'total_recouvrement': total_recouvrement,
            'total_recouv_especes': total_recouv_especes,
            'total_entrees': total_entrees,
            'total_sorties': total_sorties,
            'total_coupons': total_coupons,
            'details': details,
            'details_ventes': details_ventes,
            'details_recouvrements': details_recouv,
            'mouvements_count': mouvements_total,
            'mouvements_audit': mouvements_list
        })

    @action(detail=False, methods=['get'], url_path='page_init')
    def page_init(self, request):
        from django.contrib.auth.models import User as AuthUser
        transactions_response = self.list(request)

        user_id = request.query_params.get('user')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')

        mouvements_qs = MouvementCaisse.objects.select_related('user').all().order_by('-date')
        if user_id:
            mouvements_qs = mouvements_qs.filter(user_id=user_id)
        if date_debut:
            start_dt = _parse_iso_datetime(date_debut)
            if start_dt:
                mouvements_qs = mouvements_qs.filter(date__gte=start_dt)
        if date_fin:
            end_dt = _parse_iso_datetime(date_fin)
            if end_dt:
                mouvements_qs = mouvements_qs.filter(date__lte=end_dt)
        mouvements_data = MouvementCaisseSerializer(mouvements_qs, many=True).data
        totals_response = self.get_totals(request)

        # OPTIMISATION : .values() évite l'instanciation des objets User
        users_data = list(
            AuthUser.objects.filter(is_active=True)
            .order_by('first_name', 'last_name')
            .values('id', 'username', 'first_name', 'last_name')
        )

        return Response({
            'transactions': transactions_response.data,
            'mouvements': mouvements_data,
            'totals': totals_response.data,
            'users': users_data,
        })

    @action(detail=False, methods=['get'])
    def get_user_shift(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=400)

        now = timezone.localtime(timezone.now())
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Le shift journalier part toujours du début de la journée pour inclure
        # toutes les ventes du jour (même celles avant une clôture intermédiaire).
        search_from = today_start

        txs = Caisse.objects.filter(user_id=user_id, date_paiement__gte=search_from).order_by('date_paiement')
        mvs = MouvementCaisse.objects.filter(user_id=user_id, date__gte=search_from).order_by('date')

        # Récupérer le poste de vente actif du caissier (poste + fond)
        from ....models import PosteVente
        active_poste_vente = PosteVente.objects.filter(
            vendeur_id=user_id,
            est_actif=True
        ).select_related('caisse').first()
        poste_caisse_id = active_poste_vente.caisse_id if active_poste_vente else None
        poste_caisse_nom = active_poste_vente.caisse.nom if active_poste_vente and active_poste_vente.caisse else None
        has_active_session = active_poste_vente is not None

        first_dates, last_dates = [], []
        if txs.exists():
            first_tx = txs.first()
            last_tx = txs.last()
            if first_tx is not None:
                first_dates.append(first_tx.date_paiement)  # type: ignore[attr-defined]
            if last_tx is not None:
                last_dates.append(last_tx.date_paiement)  # type: ignore[attr-defined]
        if mvs.exists():
            first_mv = mvs.first()
            last_mv = mvs.last()
            if first_mv is not None:
                first_dates.append(first_mv.date)  # type: ignore[attr-defined]
            if last_mv is not None:
                last_dates.append(last_mv.date)  # type: ignore[attr-defined]

        if not first_dates:
            return Response({'user_id': user_id, 'start_date': None, 'end_date': None, 'has_activity': False, 'poste_caisse_id': poste_caisse_id, 'poste_caisse_nom': poste_caisse_nom, 'has_active_session': has_active_session})

        start_date = min(first_dates)
        end_date = max(last_dates)
        if start_date == end_date:
            end_date = now

        return Response({'user_id': user_id, 'start_date': start_date, 'end_date': end_date, 'has_activity': True, 'poste_caisse_id': poste_caisse_id, 'poste_caisse_nom': poste_caisse_nom, 'has_active_session': has_active_session})
