import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import Abs
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...centralized_configs import BaseViewSetConfig
from ...idempotency import idempotent_action
from ...models import AuditLog, Caisse, ClotureCaisse
from ...serializers import (
    CaisseSerializer,
    ClotureCaisseSerializer,
)
from ...sudo_utils import validate_sudo_mode
from ...utils.dates import day_start
from ...utils.validation import parse_date_param, parse_id
from ..rapports.tz_utils import parse_api_datetime as _parse_iso_datetime
from .caisse_mixins.cloture_mixin import CaisseClotureMixin
from .caisse_mixins.reporting_mixin import CaisseReportingMixin

logger = logging.getLogger(__name__)


class CaisseViewSet(CaisseReportingMixin, CaisseClotureMixin, BaseViewSetConfig, viewsets.ModelViewSet):
    """API endpoint for caisse (paiements).

    Hérite de :
    - CaisseReportingMixin : ventes_diverses, get_totals, page_init, get_user_shift
    - CaisseClotureMixin   : cloturer
    """
    queryset = Caisse.objects.select_related(
        'facture', 'facture__client', 'user',
        'facture__created_by', 'facture__validated_by'
    ).order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut', 'user']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Exclure les modes non-physiques du journal de caisse (list et page_init)
        # car ils ne correspondent pas à des flux de trésorerie réels suivis ici.
        if self.action in ['list', 'page_init']:
            queryset = queryset.exclude(mode_paiement__in=['en_compte', 'depot'])

        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        user_id = self.request.query_params.get('user') or self.request.query_params.get('user_id')

        # parse_id lève ValidationError (400) : 'abc' dans le filtre ORM
        # lèverait ValueError → 500.
        if user_id:
            queryset = queryset.filter(user_id=parse_id(user_id, field='user_id'))

        # Date invalide → 400 (ignorer le filtre renverrait des résultats
        # non filtrés, trompeurs pour l'utilisateur).
        if date_debut:
            dt = _parse_iso_datetime(date_debut)
            if dt is None:
                raise ValidationError({'detail': f"Le paramètre 'date_debut' est invalide : '{date_debut}'. Format attendu : AAAA-MM-JJ."})
            queryset = queryset.filter(date_paiement__gte=dt)

        if date_fin:
            # end_of_day=True : une date seule (YYYY-MM-DD) borne à 23:59:59,
            # sinon le jour de fin serait exclu par __lte (borne à 00:00).
            dt = _parse_iso_datetime(date_fin, end_of_day=True)
            if dt is None:
                raise ValidationError({'detail': f"Le paramètre 'date_fin' est invalide : '{date_fin}'. Format attendu : AAAA-MM-JJ."})
            queryset = queryset.filter(date_paiement__lte=dt)

        return queryset


    @idempotent_action
    @transaction.atomic
    def _check_poste_vente(self, request):
        """Bloquer l'encaissement si l'utilisateur n'a pas de point de vente actif."""
        from ...models import PosteVente
        if not PosteVente.objects.filter(vendeur=request.user, est_actif=True).exists():
            return Response(
                {'detail': "Vous n'avez aucun point de vente actif. Veuillez ouvrir un point de vente avant d'encaisser."},
                status=status.HTTP_403_FORBIDDEN
            )
        return None

    def _check_facture_encaissable(self, data):
        """Refuse l'encaissement d'une facture annulée ou supprimée.

        Filet de sécurité contre la course entre un rappel/annulation de vente
        et la file d'attente caisse (rafraîchie par polling/WebSocket) : sans
        cette vérif, un paiement 'completee' pouvait être créé sur une facture
        ANNULEE → écart de caisse et traçabilité corrompue.
        NB: les factures PAYEE restent acceptées (paiements 'recouvrement').
        """
        facture_id = data.get('facture') or data.get('facture_id')
        if not facture_id:
            return None
        from ...models import Facture as FactureModel
        try:
            facture_obj = FactureModel.objects.get(pk=facture_id)
        except (FactureModel.DoesNotExist, ValueError, TypeError):
            return Response(
                {'detail': "La facture associée à ce paiement est introuvable."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not facture_obj.is_active or facture_obj.status == FactureModel.Status.ANNULEE:
            return Response(
                {'detail': (
                    f"La facture {facture_obj.numero_facture or facture_id} a été annulée "
                    "et ne peut plus être encaissée. Actualisez la liste des ventes en attente."
                )},
                status=status.HTTP_400_BAD_REQUEST
            )
        return None

    def _check_depot_solde(self, data):
        """Refuse un paiement 'depot' si le client ne peut pas le couvrir."""
        if data.get('mode_paiement') != 'depot':
            return None
        facture_id = data.get('facture') or data.get('facture_id')
        if not facture_id:
            return Response(
                {'detail': "Un paiement par dépôt doit être lié à une facture."},
                status=status.HTTP_400_BAD_REQUEST
            )
        from ...models import Facture as FactureModel
        try:
            facture_obj = FactureModel.objects.select_related('client').get(pk=facture_id)
        except FactureModel.DoesNotExist:
            return None
        client = facture_obj.client
        try:
            montant = Decimal(str(data.get('montant', 0)))
        except (InvalidOperation, TypeError, ValueError):
            montant = Decimal(0)
        if not client or not client.is_deposit_enabled:
            return Response(
                {'detail': "Ce client n'a pas le dépôt/acompte activé."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if client.solde_depot < montant:
            return Response(
                {'detail': (
                    f"Solde dépôt insuffisant : {client.solde_depot} F "
                    f"disponibles, {montant} F demandés."
                )},
                status=status.HTTP_400_BAD_REQUEST
            )
        return None

    def _cap_montant(self, data):
        """Cap le montant au reste à payer de la facture (copie et retourne les données)."""
        try:
            montant = Decimal(str(data.get('montant', 0)))
        except (InvalidOperation, TypeError, ValueError):
            montant = Decimal(0)

        facture_id = data.get('facture') or data.get('facture_id')
        mode = data.get('mode_paiement', '')
        if facture_id and mode not in ('en_compte', 'recouvrement'):
            from ...models import Facture as FactureModel
            try:
                facture_obj = FactureModel.objects.get(pk=facture_id)
                deja_paye = Caisse.objects.filter(
                    facture=facture_obj, statut__in=['completee', 'en_attente']
                ).exclude(
                    mode_paiement__in=['en_compte', 'recouvrement']
                ).aggregate(Sum('montant'))['montant__sum'] or Decimal(0)
                part = facture_obj.part_client
                montant_du = part if (part is not None and part >= Decimal(0)) else facture_obj.total_ttc
                reste = max(Decimal(0), montant_du - deja_paye)
                if montant > reste:
                    data = data.copy()
                    data['montant'] = str(reste)
            except FactureModel.DoesNotExist:
                pass
        return data

    def create(self, request, *args, **kwargs):
        try:
            montant = Decimal(str(request.data.get('montant', 0)))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': "Le montant du paiement est invalide."}, status=status.HTTP_400_BAD_REQUEST)
        if not montant.is_finite() or montant <= Decimal(0):
            return Response({'detail': "Le montant d'un paiement doit être supérieur à zéro."}, status=status.HTTP_400_BAD_REQUEST)

        error_res = self._check_poste_vente(request)
        if error_res:
            return error_res

        error_res = self._check_facture_encaissable(request.data)
        if error_res:
            return error_res

        error_res = self._check_depot_solde(request.data)
        if error_res:
            return error_res

        capped = self._cap_montant(request.data)
        if capped is not request.data:
            request._full_data = capped

        _validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cash_out')
        if error_res:
            return error_res

        # Alias : le frontend envoie historiquement facture_id
        if 'facture' not in request.data and request.data.get('facture_id') is not None:
            data = request.data.copy()
            data['facture'] = data['facture_id']
            request._full_data = data

        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_create(self, request):
        """Enregistre plusieurs paiements en une seule requête (mêmes règles que create)."""
        items = request.data if isinstance(request.data, list) else request.data.get('items')
        if not isinstance(items, list) or not items:
            return Response({'detail': "Une liste d'items est requise."}, status=status.HTTP_400_BAD_REQUEST)
        if len(items) > 50:
            return Response({'detail': 'Trop de paiements (max 50).'}, status=status.HTTP_400_BAD_REQUEST)

        error_res = self._check_poste_vente(request)
        if error_res:
            return error_res

        for item in items:
            try:
                montant = Decimal(str(item.get('montant', 0)))
            except (InvalidOperation, TypeError, ValueError):
                return Response({'detail': "Le montant du paiement est invalide."}, status=status.HTTP_400_BAD_REQUEST)
            if not montant.is_finite() or montant <= Decimal(0):
                return Response({'detail': "Le montant d'un paiement doit être supérieur à zéro."}, status=status.HTTP_400_BAD_REQUEST)

        _validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cash_out')
        if error_res:
            return error_res

        created = []
        for item in items:
            error_res = self._check_facture_encaissable(item)
            if error_res:
                return error_res
            error_res = self._check_depot_solde(item)
            if error_res:
                return error_res
            data = item.copy()
            # Alias : le frontend envoie historiquement facture_id
            if 'facture' not in data and data.get('facture_id') is not None:
                data['facture'] = data['facture_id']
            data = self._cap_montant(data)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            created.append(serializer.data)
        return Response(created, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # Note: We always use self.request.user as the 'owner' of the payment (the person at the station),
        # even if a supervisor (validation_user) authorized the action.
        serializer.save(user=self.request.user)

        instance = serializer.instance
        if instance.facture:
            from ...services.payment_service import PaymentService
            PaymentService.process_payment(instance, is_created=True)

        # Log métier de l'encaissement (requiert sudo)
        try:
            validation_user = getattr(self.request, '_validation_user', None) or self.request.user
            log_audit(
                user=validation_user,
                action=AuditLog.Action.OTHER,
                model_name='Caisse',
                object_id=instance.id,
                description=f"Encaissement créé - {instance.montant} F ({instance.mode_paiement})",
                details={
                    'caisse_id': instance.id,
                    'montant': float(instance.montant),
                    'mode_paiement': instance.mode_paiement,
                    'facture_id': instance.facture_id,
                    'poste_caisse_id': instance.facture.poste_caisse_id if instance.facture else None,
                    'operator': self.request.user.username,
                },
                request=self.request
            )
        except Exception:
            logger.exception("[CAISSE] Erreur lors du log d'audit de l'encaissement")


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

        # Dates/ids invalides → 400 (chaîne brute dans le filtre ORM → 500,
        # ou filtre silencieusement ignoré → résultats trompeurs).
        if date_debut:
            queryset = queryset.filter(date__gte=day_start(parse_date_param(date_debut, field='date_debut')))
        if date_fin:
            queryset = queryset.filter(date__lt=day_start(parse_date_param(date_fin, field='date_fin') + timedelta(days=1)))
        if user_id:
            queryset = queryset.filter(user_id=parse_id(user_id, field='user_id'))
        if poste_caisse_id:
            queryset = queryset.filter(poste_caisse_id=parse_id(poste_caisse_id, field='poste_caisse'))

        return queryset

    def list(self, request, *args, **kwargs):
        from ...centralized_configs import PaginationDefaults, PaginationHelper
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
            qs = qs.filter(user_id=parse_id(user_id, field='user_id'))

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
