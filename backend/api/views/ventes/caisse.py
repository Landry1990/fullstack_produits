from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum, Q, Value, DecimalField, Count
from django.db.models.functions import Coalesce, Abs
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
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
from ...pagination import StandardResultsSetPagination

logger = logging.getLogger(__name__)


class CaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for caisse (paiements)."""
    queryset = Caisse.objects.select_related(
        'facture', 'facture__client', 'user', 
        'facture__created_by', 'facture__validated_by'
    ).order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut', 'user']
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

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

    
    def perform_create(self, serializer):
        # Validate Sudo mode if credentials provided
        validation_user, error_res = validate_sudo_mode(self.request)
        if error_res:
            # We don't return here as validate_sudo_mode might return error_res 
            # only if sudo was REQUIRED but failed. 
            # In CaisseViewSet, sudo is usually optional unless specific 
            # conditions are met (handled in validate_sudo_mode).
            pass

        facture = serializer.validated_data.get('facture')
        mode = serializer.validated_data.get('mode_paiement')
        
        if facture and mode != 'en_compte' and mode != 'recouvrement':
            montant_saisi = serializer.validated_data.get('montant')
            deja_paye = Caisse.objects.filter(
                facture=facture, statut='completee'
            ).exclude(
                mode_paiement__in=['en_compte', 'recouvrement']
            ).aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            
            montant_du = facture.part_client if (facture.part_client is not None and facture.part_client >= 0) else facture.total_ttc
            
            if montant_du >= 0:
                reste = max(Decimal('0'), montant_du - deja_paye)
                if montant_saisi > reste:
                    serializer.validated_data['montant'] = reste
            else:
                reste = min(Decimal('0'), montant_du - deja_paye)
                if montant_saisi < reste:
                    serializer.validated_data['montant'] = reste

        # Note: We always use self.request.user as the 'owner' of the payment (the person at the station),
        # even if a supervisor (validation_user) authorized the action.
        serializer.save(user=self.request.user)
        
        instance = serializer.instance
        if instance.facture:
            from ...services.payment_service import PaymentService
            PaymentService.process_payment(instance, is_created=True)

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

        total_ventes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes_especes = paiements_sales.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        paiements_recouv = transactions.filter(recouvrement_q)
        total_recouvrement = paiements_recouv.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_recouv_especes = paiements_recouv.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

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
            
        moves_aggregated = mouvements.aggregate(
            entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
            sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField()))
        )
        total_entrees = moves_aggregated['entrees']
        total_sorties = moves_aggregated['sorties']
        
        total_coupons = -(transactions.filter(mode_paiement='coupon').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00'))
        
        # FIX: Le total théorique (fond de caisse physique) doit inclure 
        # les ventes espèces ET les recouvrements espèces.
        total_theorique = total_ventes_especes + total_recouv_especes + total_entrees - total_sorties
        
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
        users_data = [{'id': u.id, 'username': u.username, 'first_name': u.first_name, 'last_name': u.last_name} for u in users_qs]

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
            first_dates.append(txs.first().date_paiement)
            last_dates.append(txs.last().date_paiement)
        if mvs.exists():
            first_dates.append(mvs.first().date)
            last_dates.append(mvs.last().date)
            
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
        
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        
        total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes_especes = paiements_sales.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0:
             return Response({'detail': 'Impossible de clôturer : aucun mouvement détecté depuis la dernière clôture.'}, status=status.HTTP_400_BAD_REQUEST)

        # FIX: Inclure les recouvrements espèces dans le théorique de clôture
        recouv_especes = paiements_recouv.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_theorique = total_ventes_especes + recouv_especes + total_entrees - total_sorties
        ecart = montant_reel - total_theorique
        
        details['__meta__'] = {
            'total_ventes': float(total_ventes), 
            'total_ventes_especes': float(total_ventes_especes),
            'total_recouvrement_especes': float(recouv_especes),
            'total_entrees': float(total_entrees), 
            'total_sorties': float(total_sorties)
        }
        
        mouvements_list = []
        for m in mouvements.select_related('user'):
            mouvements_list.append({'type': m.type, 'montant': float(m.montant), 'motif': m.motif, 'user_nom': m.user.get_full_name() or m.user.username if m.user else "Inconnu", 'date': m.date.isoformat()})
        details['mouvements_audit'] = mouvements_list
        
        cloture = ClotureCaisse.objects.create(
            montant_reel=montant_reel, montant_theorique=total_theorique, ecart_caisse=ecart,
            total_ventes=total_ventes, total_entrees=total_entrees, total_sorties=total_sorties,
            details_paiement=details, date_debut=start_date, date_fin=end_date,
            user=target_user, cloture_par=request.user if request.user.is_authenticated else None,
            poste_caisse_id=poste_caisse_id
        )
        
        log_audit(user=request.user, action=AuditLog.Action.CLOTURE_CAISSE, model_name='ClotureCaisse', object_id=cloture.id,
            description=f"Clôture de caisse: Théorique={total_theorique:.0f}F, Réel={montant_reel:.0f}F, Écart={ecart:+.0f}F",
            details={'theorique': float(total_theorique), 'reel': float(montant_reel), 'ecart': float(ecart), 'ventes': float(total_ventes), 'entrees': float(total_entrees), 'sorties': float(total_sorties)},
            request=request
        )
        
        return Response({'status': 'success', 'cloture_id': cloture.id, 'montant_reel': float(montant_reel), 'montant_theorique': float(total_theorique), 'ecart': float(ecart), 'total_ventes': float(total_ventes), 'total_entrees': float(total_entrees), 'total_sorties': float(total_sorties), 'details': details})


class ClotureCaisseViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ClotureCaisseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        queryset = ClotureCaisse.objects.select_related('user').order_by('-date')
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        user_id = self.request.query_params.get('user') or self.request.query_params.get('user_id')
        poste_caisse_id = self.request.query_params.get('poste_caisse')
        
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
        queryset = self.get_queryset()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 31))
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

        performances = ClotureCaisse.objects.filter(date__month=month, date__year=year).values(
            'user__id', 'user__username', 'user__first_name', 'user__last_name'
        ).annotate(
            total_ecart_absolu=Sum(Abs('ecart_caisse')), total_ecart_algebrique=Sum('ecart_caisse'),
            nombre_clotures=Count('id'), total_theorique=Sum('montant_theorique'),
            total_reel=Sum('montant_reel'), total_ventes=Sum('total_ventes')
        ).filter(user__isnull=False)
        
        results = []
        for p in performances:
            full_name = f"{p['user__first_name'] or ''} {p['user__last_name'] or ''}".strip() or p['user__username']
            total_abs = float(p['total_ecart_absolu'] or 0)
            total_alg = float(p['total_ecart_algebrique'] or 0)
            nombre = p['nombre_clotures']
            results.append({
                'user_id': p['user__id'], 'username': p['user__username'], 'full_name': full_name,
                'moyenne_ecart_absolu': round(total_abs / nombre if nombre > 0 else 0, 2),
                'moyenne_ecart_algebrique': round(total_alg / nombre if nombre > 0 else 0, 2),
                'total_ecart_absolu': total_abs, 'total_ecart_algebrique': total_alg,
                'nombre_clotures': nombre, 'total_theorique': float(p['total_theorique'] or 0),
                'total_reel': float(p['total_reel'] or 0), 'total_ventes': float(p['total_ventes'] or 0),
            })
        results.sort(key=lambda x: x['moyenne_ecart_absolu'])
        return Response(results)
