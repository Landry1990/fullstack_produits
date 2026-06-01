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
    queryset = Avoir.objects.filter(is_active=True).select_related('fournisseur', 'created_by').prefetch_related('produits__produit')
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
        instance.is_active = False
        instance.save(update_fields=['is_active'])
    
    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        '''Valider l avoir administrativement (sans sudo, sans effet sur le stock)'''
        avoir = self.get_object()

        if avoir.status == 'VALIDEE':
            return Response({'error': 'Avoir déjà validé'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                avoir.status = 'VALIDEE'
                avoir.validated_by = request.user
                avoir.save(update_fields=['status', 'validated_by'])

                log_audit(
                    user=request.user,
                    action='VALIDATE',
                    model_name='Avoir',
                    object_id=avoir.numero,
                    description=f"Validation administrative Avoir {avoir.numero} par {request.user.username}",
                    details={'validated_by': request.user.username, 'stock_decharge': avoir.stock_decharge},
                    request=request
                )

                return Response({
                    'status': 'Avoir validé avec succès',
                    'avoir': AvoirSerializer(avoir).data
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['get'])
    def print_data(self, request, pk=None):
        """Retourne les données de l'avoir pour l'impression A4."""
        avoir = self.get_object()
        lignes = []
        for p in avoir.produits.select_related('produit').all():
            lignes.append({
                'produit_nom': p.produit.name if p.produit else (p.produit_nom or ''),
                'produit_cip': p.produit.cip1 if p.produit else '',
                'quantity': p.quantity,
                'price': str(p.price),
                'total': str(p.total),
                'lot': p.lot or '',
                'date_expiration': str(p.date_expiration) if p.date_expiration else '',
                'motif': p.motif or '',
                'est_cloture': p.est_cloture,
            })
        return Response({
            'avoir': {
                'id': avoir.id,
                'numero': avoir.numero,
                'date': str(avoir.date),
                'fournisseur_name': avoir.fournisseur.name if avoir.fournisseur else (avoir.fournisseur_nom or ''),
                'type_avoir': avoir.type_avoir,
                'type_avoir_display': avoir.get_type_avoir_display(),
                'status': avoir.status,
                'observations': avoir.observations or '',
                'created_by_name': avoir.created_by.get_full_name() or avoir.created_by.username if avoir.created_by else '',
                'validated_by_name': avoir.validated_by.get_full_name() or avoir.validated_by.username if avoir.validated_by else '',
                'stock_decharge': avoir.stock_decharge,
                'stock_decharge_by_name': avoir.stock_decharge_by.get_full_name() or avoir.stock_decharge_by.username if avoir.stock_decharge_by else '',
                'total_ht': str(avoir.total_ht),
                'lignes': lignes,
            }
        })

    @action(detail=True, methods=['post'])
    def decharger_stock(self, request, pk=None):
        """
        Décharge le stock des produits de l'avoir (retrait physique du stock).
        Indépendant de la validation et de la clôture.
        La clôture = le fournisseur a répondu favorablement.
        Le déchargement = on retire physiquement du stock.
        """
        from django.utils import timezone
        avoir = self.get_object()

        if avoir.stock_decharge:
            return Response(
                {'error': 'Le stock de cet avoir a déjà été déchargé.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Action sensible : sudo requis
        decharge_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_avoirs')
        if error_res:
            return error_res

        try:
            with transaction.atomic():
                for ligne in avoir.produits.all():
                    produit = ligne.produit
                    if not produit:
                        continue

                    # Déstockage du lot si applicable
                    if ligne.stock_lot:
                        lot = ligne.stock_lot
                        if lot.quantity_remaining < ligne.quantity:
                            raise ValueError(
                                f'Lot {lot.lot} : stock restant ({lot.quantity_remaining}) '
                                f'insuffisant pour décharger {ligne.quantity} unité(s).'
                            )
                        lot.quantity_remaining -= ligne.quantity
                        lot.save()

                    # Mise à jour du stock produit
                    if produit.use_lot_management and ligne.stock_lot:
                        produit.calculate_stock_from_lots()
                    else:
                        produit.stock -= ligne.quantity
                        produit.save()

                    # Mouvement de stock (AVOIR = sortie négative)
                    motif_info = f" - {ligne.motif}" if ligne.motif else ""
                    lot_info = f" - Lot: {ligne.stock_lot.lot}" if ligne.stock_lot else ""
                    MouvementStock.objects.create(
                        produit=produit,
                        type_mouvement=MouvementStock.TypeMouvement.AVOIR,
                        quantite=-ligne.quantity,
                        stock_apres=produit.stock,
                        user=decharge_user,
                        description=f"Décharge Avoir {avoir.numero} - {avoir.fournisseur.name if avoir.fournisseur else 'Fournisseur'}{lot_info}{motif_info}"
                    )

                    log_audit(
                        user=request.user,
                        action='STOCK_ADJ',
                        model_name='Avoir',
                        object_id=avoir.numero,
                        description=f"Décharge stock Avoir {avoir.numero} (autorisé par: {decharge_user.username})",
                        details={
                            'produit_id': produit.id,
                            'produit_nom': produit.name,
                            'quantity': -ligne.quantity,
                            'motif': ligne.motif,
                            'lot': ligne.lot,
                            'decharge_by': decharge_user.username,
                        },
                        request=request
                    )

                # Marquer l'avoir comme déchargé
                avoir.stock_decharge = True
                avoir.stock_decharge_at = timezone.now()
                avoir.stock_decharge_by = decharge_user
                avoir.save(update_fields=['stock_decharge', 'stock_decharge_at', 'stock_decharge_by'])

                return Response({
                    'status': 'Stock déchargé avec succès.',
                    'avoir': AvoirSerializer(avoir).data
                })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LigneAvoirViewSet(viewsets.ModelViewSet):
    queryset = LigneAvoir.objects.all().select_related('avoir', 'produit')
    serializer_class = LigneAvoirSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['avoir']
    pagination_class = StandardResultsSetPagination
