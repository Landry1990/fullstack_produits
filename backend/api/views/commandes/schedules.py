from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from decimal import Decimal
from ...models import OrderSchedule, Commande, CommandeProduit, Produit
from ...serializers import OrderScheduleSerializer
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
            from api.views.commandes.suggestions import (
                calculer_optimisation_intelligente,
                calculer_reapprovisionnement_simple,
                calculer_reapprovisionnement_cumulatif,
            )

            if schedule.execution_mode == 'OPTIMISE':
                suggestions, total_ht = calculer_optimisation_intelligente(
                    periode=schedule.analysis_period_days,
                    fournisseur_id=schedule.fournisseur.id,
                    budget_max=None
                )
            elif schedule.execution_mode == 'CUMULATIF':
                suggestions, total_ht = calculer_reapprovisionnement_cumulatif(
                    fournisseur_id=schedule.fournisseur.id,
                    periode_fallback=schedule.analysis_period_days,
                    budget_max=None
                )
            else:
                suggestions, total_ht = calculer_reapprovisionnement_simple(
                    periode=schedule.analysis_period_days,
                    fournisseur_id=schedule.fournisseur.id,
                    budget_max=None
                )
        except Exception as e:
            logger.error(f"trigger_now: suggestion error for schedule {pk}: {e}", exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not suggestions:
            return Response(
                {'detail': 'Aucune suggestion générée pour ce fournisseur.'},
                status=status.HTTP_200_OK
            )

        commande = Commande.objects.create(
            type=Commande.Type.LOCALE,
            fournisseur=schedule.fournisseur,
            fournisseur_nom=schedule.fournisseur.name,
            status=Commande.Status.EN_PREPARATION,
            date=timezone.now(),
            source=Commande.Source.AUTO_SCHEDULE
        )

        for item in suggestions:
            try:
                produit = Produit.objects.get(id=item['produit_id'])
                CommandeProduit.objects.create(
                    commande=commande,
                    produit=produit,
                    produit_nom=produit.name,
                    quantity=item['quantite_suggeree'],
                    price=Decimal(str(item['prix_achat'])),
                    price_cost=Decimal(str(item['prix_achat'])),
                    tva=Decimal(str(item.get('tva', 0))),
                    selling_price=Decimal(str(item.get('prix_vente', 0)))
                )
            except Produit.DoesNotExist:
                logger.warning(f"trigger_now: produit {item['produit_id']} introuvable, ignoré")

        schedule.last_run = timezone.now()
        schedule.save(update_fields=['last_run'])

        logger.info(f"trigger_now: commande #{commande.id} créée pour {schedule.fournisseur.name} par {request.user}")

        return Response({
            'commande_id': commande.id,
            'fournisseur': schedule.fournisseur.name,
            'nb_produits': len(suggestions),
            'total_ht': float(total_ht),
        }, status=status.HTTP_201_CREATED)
