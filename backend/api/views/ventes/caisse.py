from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Q, Value, DecimalField, Count, F
from django.db.models.functions import Coalesce, Abs
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import datetime
from decimal import Decimal, InvalidOperation
import logging

from django.contrib.auth.models import User

from ...models import (
    Facture, Caisse, ClotureCaisse, MouvementCaisse, AuditLog
)
from ...serializers import CaisseSerializer, ClotureCaisseSerializer, MouvementCaisseSerializer
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode
from ...centralized_configs import (
    BaseViewSetConfig,
    CommonFilterFields,
    StandardResultsSetPagination
)

logger = logging.getLogger(__name__)


class CaisseViewSet(BaseViewSetConfig, viewsets.ModelViewSet):
    """API endpoint for caisse (paiements)."""
    queryset = Caisse.objects.select_related(
        'facture', 'facture__client', 'user', 
        'facture__created_by', 'facture__validated_by'
    ).order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut', 'user']

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Exclure les modes non-physiques du journal de caisse (list et page_init)
        # car ils ne correspondent pas à des flux de trésorerie réels suivis ici.
        if self.action in ['list', 'page_init']:
            queryset = queryset.exclude(mode_paiement__in=['en_compte', 'depot'])

        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        if date_debut:
            try:
                clean = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M')
                if timezone.is_naive(dt): dt = timezone.make_aware(dt)
                queryset = queryset.filter(date_paiement__gte=dt)
            except ValueError: pass
            
        if date_fin:
            try:
                clean = date_fin.replace('T', ' ').replace('Z', '')
                try:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    dt = datetime.strptime(clean, '%Y-%m-%d %H:%M')
                if timezone.is_naive(dt): dt = timezone.make_aware(dt)
                queryset = queryset.filter(date_paiement__lte=dt)
            except ValueError: pass
            
        return queryset

    
    def create(self, request, *args, **kwargs):
        try:
            montant = Decimal(str(request.data.get('montant', 0)))
        except (InvalidOperation, TypeError, ValueError):
            montant = Decimal('0')
        if montant < Decimal('0'):
            return Response({'detail': "Le montant d'un paiement ne peut pas être négatif."}, status=status.HTTP_400_BAD_REQUEST)

        # Cap montant at remaining balance before serializer validation
        facture_id = request.data.get('facture')
        mode = request.data.get('mode_paiement', '')
        if facture_id and mode not in ('en_compte', 'recouvrement'):
            from ...models import Facture as FactureModel
            try:
                facture_obj = FactureModel.objects.get(pk=facture_id)
                deja_paye = Caisse.objects.filter(
                    facture=facture_obj, statut__in=['completee', 'en_attente']
                ).exclude(
                    mode_paiement__in=['en_compte', 'recouvrement']
                ).aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
                part = facture_obj.part_client
                montant_du = part if (part is not None and part >= Decimal('0')) else facture_obj.total_ttc
                reste = max(Decimal('0'), montant_du - deja_paye)
                if montant > reste:
                    # Make request.data mutable and cap the amount
                    data = request.data.copy()
                    data['montant'] = str(reste)
                    request._full_data = data
            except FactureModel.DoesNotExist:
                pass

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Validate Sudo mode if credentials provided
        validation_user, error_res = validate_sudo_mode(self.request)
        if error_res:
            pass

        # Note: We always use self.request.user as the 'owner' of the payment (the person at the station),
        # even if a supervisor (validation_user) authorized the action.
        serializer.save(user=self.request.user)
        
        instance = serializer.instance
        if instance.facture:
            from ...services.payment_service import PaymentService
            PaymentService.process_payment(instance, is_created=True)

    @action(detail=False, methods=['get'])
    def ventes_diverses(self, request):
        """
        Liste paginée des produits divers vendus par période, avec total CA global.
        """
        from datetime import datetime, timedelta
        from ...models import FactureProduitAllocation
        
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
        from ...centralized_configs import PaginationHelper, PaginationDefaults, StandardResultsSetPagination
        paginator = StandardResultsSetPagination()
        paginator.page_size = PaginationHelper.get_page_size(request, PaginationDefaults.DEFAULT_LIST_PAGE_SIZE)
        
        page_qs = paginator.paginate_queryset(queryset, request, view=self)
        
        # Si pas de pagination demandée ou erreur, prendre tout le queryset
        if page_qs is None:
            page_qs = queryset[:paginator.page_size]
        
        data = []
        for alloc in page_qs:
            data.append({
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
            })
        
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
            try:
                clean_date = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except ValueError as e:
                logger.error(f"Error parsing date_debut {date_debut}: {e}")
                
        if date_fin:
            try:
                clean_date = date_fin.replace('T', ' ').replace('Z', '')
                try:
                    end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                    except ValueError:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d')
                        end_date = end_date.replace(hour=23, minute=59, second=59)
                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except ValueError as e:
                logger.error(f"Error parsing date_fin {date_fin}: {e}")

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
        total_ventes_especes = ventes_aggregated['especes']
        total_coupons = ventes_aggregated['coupons']

        # 2. Totaux des recouvrements en UNE requête
        recouv_aggregated = paiements_recouv.aggregate(
            total=Coalesce(Sum('montant'), Value(0, output_field=DecimalField())),
            especes=Coalesce(Sum('montant', filter=Q(mode_paiement='especes')), Value(0, output_field=DecimalField()))
        )
        total_recouvrement = recouv_aggregated['total']
        total_recouv_especes = recouv_aggregated['especes']

        # Global breakdown par mode (Ventes + Recouvrements)
        # On exclut ce qui n'est pas un flux financier réel (en_compte, depot)
        modes_globaux = transactions.exclude(mode_paiement__in=['en_compte', 'depot']).values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_globaux}
        
        # Breakdown séparé pour info (optionnel mais utile pour le frontend)
        modes_ventes = paiements_sales.values('mode_paiement').annotate(total=Sum('montant'))
        details_ventes = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_ventes}
        
        modes_recouv = paiements_recouv.values('mode_paiement').annotate(total=Sum('montant'))
        details_recouv = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_recouv}

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
        from ...models import FactureProduitAllocation
        facture_ids = paiements_sales.values('facture_id')
        allocations_diverses = FactureProduitAllocation.objects.filter(
            facture_produit__facture_id__in=facture_ids,
            stock_lot__is_divers=True
        )
        total_ca_divers = allocations_diverses.aggregate(
            ca_div=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )['ca_div'] or Decimal('0.00')
        total_ca_pharmacie = total_ventes - total_ca_divers
        
        mouvements_list = []
        for m in mouvements.select_related('user'):
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
            try:
                clean = date_debut.replace('T', ' ').replace('Z', '')
                start_dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                mouvements_qs = mouvements_qs.filter(date__gte=start_dt)
            except ValueError:
                pass
        if date_fin:
            try:
                clean = date_fin.replace('T', ' ').replace('Z', '')
                end_dt = datetime.strptime(clean, '%Y-%m-%d %H:%M:%S')
                mouvements_qs = mouvements_qs.filter(date__lte=end_dt)
            except ValueError:
                pass
        mouvements_data = MouvementCaisseSerializer(mouvements_qs, many=True).data
        totals_response = self.get_totals(request)

        users_qs = AuthUser.objects.filter(is_active=True).order_by('first_name', 'last_name')
        from typing import Any
        users_data: list[dict[str, Any]] = []
        for u in users_qs:
            users_data.append({
                'id': u.pk,  # type: ignore[attr-defined]
                'username': u.username,  # type: ignore[attr-defined]
                'first_name': u.first_name,  # type: ignore[attr-defined]
                'last_name': u.last_name  # type: ignore[attr-defined]
            })

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
            
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        last_cloture = ClotureCaisse.objects.filter(user_id=user_id).order_by('-date').first()
        search_from = last_cloture.date if last_cloture else today_start
        if search_from < today_start:
            search_from = today_start

        txs = Caisse.objects.filter(user_id=user_id, date_paiement__gte=search_from).order_by('date_paiement')
        mvs = MouvementCaisse.objects.filter(user_id=user_id, date__gte=search_from).order_by('date')
        
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
            return Response({'user_id': user_id, 'start_date': None, 'end_date': None, 'has_activity': False})
            
        start_date = min(first_dates)
        end_date = max(last_dates)
        if start_date == end_date:
            end_date = now

        return Response({'user_id': user_id, 'start_date': start_date, 'end_date': end_date, 'has_activity': True})

    @action(detail=False, methods=['post'], url_path='cloturer')
    @transaction.atomic
    def cloturer(self, request):
        montant_reel = request.data.get('montant_reel')
        if montant_reel is None:
            return Response({'detail': 'Le montant réel est requis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            montant_reel = Decimal(str(montant_reel))
        except (ValueError, TypeError, InvalidOperation):
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        user_id = request.data.get('user_id')
        poste_caisse_id = request.data.get('poste_caisse_id')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                clean_date = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except ValueError as e:
                logger.error(f"Error parsing date_debut {date_debut}: {e}")
                
        if date_fin:
            try:
                clean_date = date_fin.replace('T', ' ').replace('Z', '')
                try:
                    end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                    except ValueError:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d')
                        end_date = end_date.replace(hour=23, minute=59, second=59)
                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except ValueError as e:
                logger.error(f"Error parsing date_fin {date_fin}: {e}")

        if not start_date:
            # FIX: Filtrer la dernière clôture par user_id pour éviter de mélanger les caissiers
            if user_id:
                last_cloture = ClotureCaisse.objects.filter(user_id=user_id).order_by('-date').first()
            else:
                last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement__in=['en_compte', 'depot'])
        if not user_id:
            return Response({'detail': 'Veuillez sélectionner un caissier spécifique pour clôturer.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Caissier introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        transactions = transactions.filter(user_id=user_id)
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
        if poste_caisse_id:
            transactions = transactions.filter(facture__poste_caisse_id=poste_caisse_id)
            
        # Filtre pour exclure les montants de recouvrement du calcul de clôture journalière
        # NOTE : On n'exclut PLUS le type PROFESSIONNEL ici, car s'ils paient en espèces, 
        # l'argent est bien dans la caisse physique du vendeur.
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(reference__icontains='[RECOUV]')
        paiements_sales = transactions.exclude(recouvrement_q)
        paiements_recouv = transactions.filter(recouvrement_q)

        total_ventes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        # Global breakdown par mode (Ventes + Recouvrements)
        modes_globaux = transactions.exclude(mode_paiement__in=['en_compte', 'depot']).values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_globaux}
        
        # FIX: Filtrer les mouvements par user_id pour éviter de mélanger les caissiers
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        if user_id:
            mouvements = mouvements.filter(user_id=user_id)
        
        total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes_especes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Calcul du CA Divers
        from ...models import FactureProduitAllocation
        facture_ids = paiements_sales.values('facture_id')
        allocations_diverses = FactureProduitAllocation.objects.filter(
            facture_produit__facture_id__in=facture_ids,
            stock_lot__is_divers=True
        )
        total_ca_divers = allocations_diverses.aggregate(
            ca_div=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )['ca_div'] or Decimal('0.00')
        total_ca_pharmacie = total_ventes - total_ca_divers

        # Récupérer le fond de caisse de la dernière session du caissier
        # (fermée ou active, car la caissière peut avoir déjà fermé sa session
        # avant que l'admin ne fasse la clôture comptable dans le journal)
        from ...models import SessionCaisse
        session_qs = SessionCaisse.objects.filter(ouvert_par=target_user)
        if poste_caisse_id:
            session_qs = session_qs.filter(poste_id=poste_caisse_id)
        last_session = session_qs.order_by('-date_ouverture').first()
        fond_de_caisse = Decimal(str(last_session.fond_de_caisse)) if last_session and last_session.fond_de_caisse else Decimal('0.00')

        # Créer les mouvements manuels envoyés par le frontend
        mouvements_manuels_data = request.data.get('mouvements_manuels', [])
        mouvements_crees = []
        for mv in mouvements_manuels_data:
            if mv.get('montant', 0) > 0 and mv.get('motif'):
                mouvement = MouvementCaisse.objects.create(
                    type=mv.get('type', 'SORTIE'),
                    montant=Decimal(str(mv['montant'])),
                    motif=mv['motif'],
                    user=target_user,
                    poste_caisse_id=poste_caisse_id,
                    date=end_date or timezone.now()
                )
                mouvements_crees.append(mouvement)

        # Recalculer les totaux avec les mouvements manuels créés
        if mouvements_crees:
            mouvements = MouvementCaisse.objects.all()
            if start_date:
                mouvements = mouvements.filter(date__gte=start_date)
            if end_date:
                mouvements = mouvements.filter(date__lte=end_date)
            if user_id:
                mouvements = mouvements.filter(user_id=user_id)
            total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
            total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Vérifier s'il y a au moins un mouvement (ventes, mouvements existants ou manuels)
        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0 and not mouvements_crees:
             return Response({'detail': 'Impossible de clôturer : aucun mouvement détecté depuis la dernière clôture.'}, status=status.HTTP_400_BAD_REQUEST)

        recouv_total = paiements_recouv.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_theorique = total_ventes_especes + recouv_total + total_entrees - total_sorties + fond_de_caisse
        ecart = montant_reel - total_theorique
        
        # type: ignore[index] - details is a mixed dict[str, Any] for API response
        details['__meta__'] = {  # type: ignore[index]
            'total_ventes': float(total_ventes), 
            'total_ventes_especes': float(total_ventes_especes),
            'total_recouvrement_especes': float(recouv_total),
            'total_entrees': float(total_entrees), 
            'total_sorties': float(total_sorties),
            'total_ca_divers': float(total_ca_divers),
            'total_ca_pharmacie': float(total_ca_pharmacie),
            'fond_de_caisse': float(fond_de_caisse)
        }
        
        mouvements_list = []
        for m in mouvements.select_related('user'):
            mouvements_list.append({'type': m.type, 'montant': float(m.montant), 'motif': m.motif, 'user_nom': m.user.get_full_name() or m.user.username if m.user else "Inconnu", 'date': m.date.isoformat()})
        # type: ignore[index] - details is a mixed dict[str, Any] for API response
        details['mouvements_audit'] = mouvements_list  # type: ignore[index]
        
        cloture = ClotureCaisse.objects.create(
            montant_reel=montant_reel, montant_theorique=total_theorique, ecart_caisse=ecart,
            total_ventes=total_ventes, total_entrees=total_entrees, total_sorties=total_sorties,
            details_paiement=details, date_debut=start_date, date_fin=end_date,
            user=target_user, cloture_par=request.user if request.user.is_authenticated else None,
            poste_caisse_id=poste_caisse_id
        )
        
        # Fermer la session si elle est encore active
        if last_session and not last_session.date_fermeture:
            last_session.date_fermeture = timezone.now()
            last_session.save(update_fields=['date_fermeture'])
        
        log_audit(user=request.user, action=AuditLog.Action.CLOTURE_CAISSE, model_name='ClotureCaisse', object_id=cloture.pk,  # type: ignore[attr-defined]
            description=f"Clôture de caisse: Théorique={total_theorique:.0f}F, Réel={montant_reel:.0f}F, Écart={ecart:+.0f}F (tous modes)",
            details={'theorique': float(total_theorique), 'reel': float(montant_reel), 'ecart': float(ecart), 'ventes': float(total_ventes), 'entrees': float(total_entrees), 'sorties': float(total_sorties), 'fond_de_caisse': float(fond_de_caisse)},
            request=request
        )
        
        # Réponse structurée pour matcher l'attente du frontend
        cloture_data = {
            'id': cloture.pk,
            'date': cloture.date.isoformat(),
            'montant_reel': float(montant_reel),
            'montant_theorique': float(total_theorique),
            'ecart_caisse': float(ecart),
            'total_ventes': float(total_ventes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties),
            'total_ca_divers': float(total_ca_divers),
            'total_ca_pharmacie': float(total_ca_pharmacie),
            'fond_de_caisse': float(fond_de_caisse),
            'date_debut': start_date.isoformat() if start_date else None,
            'date_fin': end_date.isoformat() if end_date else None,
            'details': details,
            'user': target_user.get_full_name() or target_user.username,
            'mouvements_manuels': [
                {'type': m.type, 'montant': float(m.montant), 'motif': m.motif}
                for m in mouvements_crees
            ]
        }
        
        return Response({'status': 'success', 'cloture': cloture_data})  # type: ignore[attr-defined]


class ClotureCaisseViewSet(BaseViewSetConfig, viewsets.ReadOnlyModelViewSet):
    serializer_class = ClotureCaisseSerializer
    
    def get_queryset(self):
        queryset = ClotureCaisse.objects.select_related('user').order_by('-date')
        # DRF Request type - ignore Pyright not recognizing DRF's Request
        drf_request = self.request  # type: ignore[attr-defined]
        date_debut = drf_request.query_params.get('date_debut')  # type: ignore[attr-defined]
        date_fin = drf_request.query_params.get('date_fin')  # type: ignore[attr-defined]
        user_id = drf_request.query_params.get('user') or drf_request.query_params.get('user_id')  # type: ignore[attr-defined]
        poste_caisse_id = drf_request.query_params.get('poste_caisse')  # type: ignore[attr-defined]
        
        if date_debut:
            queryset = queryset.filter(date__date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__date__lte=date_fin)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if poste_caisse_id:
            queryset = queryset.filter(poste_caisse_id=poste_caisse_id)
            
        return queryset

    def list(self, request, *args, **kwargs):
        from ...centralized_configs import PaginationHelper, PaginationDefaults
        queryset = self.get_queryset()
        page = PaginationHelper.get_page_number(request)
        page_size = PaginationHelper.get_page_size(request, PaginationDefaults.DEFAULT_REPORT_PAGE_SIZE)
        total_count = queryset.count()
        
        totals_agg = queryset.aggregate(total_theorique=Sum('montant_theorique'), total_reel=Sum('montant_reel'), total_ecart=Sum('ecart_caisse'))
        global_totals = {'montant_theorique': float(totals_agg['total_theorique'] or 0), 'montant_reel': float(totals_agg['total_reel'] or 0), 'ecart_caisse': float(totals_agg['total_ecart'] or 0)}
        
        start = (page - 1) * page_size
        paginated_queryset = queryset[start:start + page_size]
        serializer = self.get_serializer(paginated_queryset, many=True)
        
        return Response({'count': total_count, 'results': serializer.data, 'totals': global_totals})

    @action(detail=False, methods=['get'])
    def performances_caissiers(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        now = timezone.now()
        if not month: month = now.month
        if not year: year = now.year
        try:
            month = int(month)
            year = int(year)
        except (ValueError, TypeError):
            return Response({'detail': 'Paramètres mois ou année invalides.'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.query_params.get('user_id')

        qs = ClotureCaisse.objects.filter(date__month=month, date__year=year)
        if user_id:
            qs = qs.filter(user_id=user_id)

        performances = qs.values(
            'user__id', 'user__username', 'user__first_name', 'user__last_name'
        ).annotate(
            total_ecart_absolu=Sum(Abs('ecart_caisse')), total_ecart_algebrique=Sum('ecart_caisse'),
            nombre_clotures=Count('id'), total_theorique=Sum('montant_theorique'),
            total_reel=Sum('montant_reel'), total_ventes=Sum('total_ventes')
        ).filter(user__isnull=False)
        
        # Calcul du nombre max de clôtures pour la pondération
        max_clotures = max((p['nombre_clotures'] for p in performances), default=1)

        results = []
        for p in performances:
            full_name = f"{p['user__first_name'] or ''} {p['user__last_name'] or ''}".strip() or p['user__username']
            total_abs = float(p['total_ecart_absolu'] or 0)
            total_alg = float(p['total_ecart_algebrique'] or 0)
            nombre = p['nombre_clotures']
            moyenne_abs = round(total_abs / nombre if nombre > 0 else 0, 2)
            moyenne_alg = round(total_alg / nombre if nombre > 0 else 0, 2)

            # Score pondéré : pénalité pour les caissiers avec peu de clôtures
            # Un caissier avec 1 clôture et 0 d'écart ne doit pas écraser quelqu'un
            # qui a fait 25 clôtures avec un petit écart moyen.
            # Formule : score = moyenne_abs * (1 + (max_clotures - nombre) / max_clotures * 0.5)
            # → plus on a de clôtures, moins la pénalité est grande
            penalite = (max_clotures - nombre) / max_clotures * 0.5 if max_clotures > 1 else 0
            score = moyenne_abs * (1 + penalite)

            results.append({
                'user_id': p['user__id'], 'username': p['user__username'], 'full_name': full_name,
                'moyenne_ecart_absolu': moyenne_abs,
                'moyenne_ecart_algebrique': moyenne_alg,
                'total_ecart_absolu': total_abs, 'total_ecart_algebrique': total_alg,
                'nombre_clotures': nombre, 'total_theorique': float(p['total_theorique'] or 0),
                'total_reel': float(p['total_reel'] or 0), 'total_ventes': float(p['total_ventes'] or 0),
                'score': round(score, 2),
            })
        # Tri par score pondéré (plus petit = meilleur)
        results.sort(key=lambda x: x['score'])
        return Response(results)
