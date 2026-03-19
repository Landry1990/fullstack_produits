from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend

from ...models import (
    Avoir, LigneAvoir, Produit, MouvementStock, AuditLog
)
from ...serializers import AvoirSerializer, LigneAvoirSerializer
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode
from ...pagination import StandardResultsSetPagination
import logging

logger = logging.getLogger(__name__)


class AvoirViewSet(viewsets.ModelViewSet):
    queryset = Avoir.objects.all().select_related('fournisseur', 'created_by').prefetch_related('produits__produit')
    serializer_class = AvoirSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['numero', 'fournisseur__name', 'observations']
    ordering_fields = ['date', 'created_at', 'numero']
    ordering = ['-date', '-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def perform_destroy(self, instance):
        if instance.status == 'VALIDEE':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Impossible de supprimer un avoir validé.")
        super().perform_destroy(instance)
    
    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        '''Valider l avoir et retirer du stock (avec support Sudo Mode)'''
        avoir = self.get_object()
        
        if avoir.status == 'VALIDEE':
            return Response({'error': 'Avoir déjà validé'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Sudo Mode: Check for specific user validation
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_avoirs')
        if error_res:
             return error_res

        try:
            with transaction.atomic():
                # Retirer du stock pour chaque ligne
                for ligne in avoir.produits.all():
                    produit = ligne.produit
                    
                    # If specific lot is selected, destock from that lot
                    if ligne.stock_lot:
                        lot = ligne.stock_lot
                        
                        # Validate lot has sufficient quantity
                        if lot.quantity_remaining < ligne.quantity:
                            return Response({
                                'error': f'Lot {lot.lot} ne contient que {lot.quantity_remaining} unités, impossible de retourner {ligne.quantity} unités'
                            }, status=status.HTTP_400_BAD_REQUEST)
                        
                        # Destock from specific lot
                        lot.quantity_remaining -= ligne.quantity
                        lot.save()
                        
                        # Also update text fields for reference
                        if not ligne.lot:
                            ligne.lot = lot.lot
                        if not ligne.date_expiration:
                            ligne.date_expiration = lot.date_expiration
                        ligne.save()
                    
                    # Update general product stock
                    if produit.use_lot_management and ligne.stock_lot:
                        # For lot-managed products, recalculate stock from lots
                        produit.calculate_stock_from_lots()
                    else:
                        # For non-lot products, decrement manually
                        produit.stock -= ligne.quantity
                        produit.save()
                    
                    # Créer le mouvement de stock pour l'historique
                    lot_info = f" - Lot: {ligne.stock_lot.lot}" if ligne.stock_lot else ""
                    MouvementStock.objects.create(
                        produit=produit,
                        type_mouvement=MouvementStock.TypeMouvement.AVOIR,
                        quantite=-ligne.quantity,  # Négatif car sortie de stock
                        stock_apres=produit.stock,
                        user=validation_user, # Use the Sudo Validator
                        description=f"Avoir {avoir.numero} - {avoir.fournisseur.name if avoir.fournisseur else 'Fournisseur'}{lot_info}"
                    )
                    
                    # Log audit (backup)
                    log_audit(
                        user=request.user, # The actual logged in user triggered the action
                        action='STOCK_ADJ',
                        model_name='Avoir',
                        object_id=avoir.numero,
                        description=f"Validation Avoir {avoir.numero} (Validé par: {validation_user.username})",
                        details={
                            'produit_id': produit.id,
                            'produit_nom': ligne.produit_nom,
                            'quantity': -ligne.quantity,
                            'lot': ligne.lot,
                            'type_avoir': avoir.get_type_avoir_display(),
                            'validated_by': validation_user.username
                        },
                        request=request
                    )
                
                # Marquer comme validé
                avoir.status = 'VALIDEE'
                avoir.validated_by = validation_user
                avoir.save()
                
                return Response({
                    'status': 'Avoir validé avec succès',
                    'avoir': AvoirSerializer(avoir).data
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class LigneAvoirViewSet(viewsets.ModelViewSet):
    queryset = LigneAvoir.objects.all().select_related('avoir', 'produit')
    serializer_class = LigneAvoirSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['avoir']
    pagination_class = StandardResultsSetPagination
