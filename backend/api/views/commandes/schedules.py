from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from ...models import OrderSchedule
from ...serializers import OrderScheduleSerializer
from ...services.auto_order import run_suggestions_for_schedule, create_order_from_suggestions
import logging

logger = logging.getLogger(__name__)


class OrderScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for managing automated order schedules."""
    queryset = OrderSchedule.objects.all().order_by('-created_at')
    serializer_class = OrderScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        fournisseur_id = self.request.query_params.get('fournisseur')
        if fournisseur_id:
            queryset = queryset.filter(fournisseur_id=fournisseur_id)
        return queryset

    @action(detail=True, methods=['post'], url_path='trigger-now')
    def trigger_now(self, request, pk=None):
        """Force l'exécution immédiate d'un planning, sans attendre l'heure prévue."""
        schedule = self.get_object()

        try:
            suggestions, total_ht = run_suggestions_for_schedule(schedule)
        except Exception as e:
            logger.error(f"trigger_now: suggestion error for schedule {pk}: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not suggestions:
            return Response(
                {'detail': 'Aucune suggestion générée pour ce fournisseur.'},
                status=status.HTTP_200_OK
            )

        commande, nb_created = create_order_from_suggestions(schedule, suggestions, total_ht)

        if commande is None:
            return Response(
                {'detail': 'Conditions minimales non remplies (montant ou articles insuffisants).'},
                status=status.HTTP_200_OK
            )

        schedule.last_run = timezone.now()
        schedule.save(update_fields=['last_run'])

        logger.info(f"trigger_now: commande #{commande.id} créée pour {schedule.fournisseur.name} par {request.user}")

        return Response({
            'commande_id': commande.id,
            'numero_facture': commande.numero_facture,
            'fournisseur': schedule.fournisseur.name,
            'nb_produits': nb_created,
            'total_ht': float(total_ht),
        }, status=status.HTTP_201_CREATED)
