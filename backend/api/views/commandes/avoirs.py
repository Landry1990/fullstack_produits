import logging

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...models import Avoir, LigneAvoir, MouvementStock, Produit, StockLot
from ...pagination import StandardResultsSetPagination
from ...serializers import AvoirSerializer, LigneAvoirSerializer
from ...sudo_utils import validate_sudo_mode

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
        from django.utils import timezone
        if instance.status == 'VALIDEE':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Impossible de supprimer un avoir validé.")
        instance.is_active = False
        instance.deleted_by = self.request.user
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_active', 'deleted_by', 'deleted_at'])
    
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
        from django.db.models import F
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
                # Lock avoir and related lines
                avoir = Avoir.objects.select_for_update().get(pk=self.kwargs['pk'])
                lignes = list(avoir.produits.select_related('produit', 'stock_lot').all())

                # Lock products and lots in deterministic order to avoid deadlocks
                product_ids = sorted({ligne.produit_id for ligne in lignes if ligne.produit_id})
                lot_ids = sorted({ligne.stock_lot_id for ligne in lignes if ligne.stock_lot_id})
                locked_products = {p.id: p for p in Produit.objects.filter(id__in=product_ids).select_for_update().order_by('id')} if product_ids else {}
                locked_lots = {l.id: l for l in StockLot.objects.filter(id__in=lot_ids).select_for_update().order_by('id')} if lot_ids else {}

                for ligne in lignes:
                    produit = locked_products.get(ligne.produit_id) if ligne.produit_id else None
                    if not produit:
                        continue

                    used_lots = []
                    # Déstockage du lot si applicable
                    if ligne.stock_lot_id:
                        lot = locked_lots.get(ligne.stock_lot_id)
                        if not lot:
                            continue
                        if lot.quantity_remaining < ligne.quantity:
                            raise ValueError(
                                f'Lot {lot.lot} : stock restant ({lot.quantity_remaining}) '
                                f'insuffisant pour décharger {ligne.quantity} unité(s).'
                            )
                        lot.quantity_remaining -= ligne.quantity
                        if lot.quantity_free_remaining > 0:
                            lot.quantity_free_remaining -= min(ligne.quantity, lot.quantity_free_remaining)
                        lot.save()
                        used_lots.append(lot)
                    elif produit.use_lot_management:
                        # Auto-allocation FEFO si aucun lot spécifié
                        quantity_to_allocate = ligne.quantity
                        available_lots = StockLot.objects.filter(
                            produit=produit, quantity_remaining__gt=0
                        ).order_by('date_expiration', 'date_reception')
                        for lot in available_lots:
                            if quantity_to_allocate <= 0:
                                break
                            qty_from_lot = min(lot.quantity_remaining, quantity_to_allocate)
                            lot.quantity_remaining -= qty_from_lot
                            if lot.quantity_free_remaining > 0:
                                lot.quantity_free_remaining -= min(qty_from_lot, lot.quantity_free_remaining)
                            lot.save()
                            used_lots.append(lot)
                            quantity_to_allocate -= qty_from_lot
                        if quantity_to_allocate > 0:
                            raise ValueError(
                                f'{produit.name} : stock insuffisant pour décharger {ligne.quantity} unité(s).'
                            )

                    # Mise à jour du stock produit
                    if produit.use_lot_management:
                        produit.calculate_stock_from_lots()
                    else:
                        produit.stock = F('stock') - ligne.quantity
                        produit.save(update_fields=['stock'])
                        produit.refresh_from_db()

                    # Mouvement de stock (AVOIR = sortie négative)
                    motif_info = f" - {ligne.motif}" if ligne.motif else ""
                    lot_info = f" - Lot: {', '.join(l.lot for l in used_lots if l.lot)}" if used_lots else ""
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

    @action(detail=True, methods=['post'])
    def annuler_dechargement(self, request, pk=None):
        """
        Annule le déchargement du stock d'un avoir (re-mise en stock).
        Inverse l'opération de decharger_stock : remet les quantités en stock
        (produit + lot), crée un mouvement de stock RETOUR positif, et log l'audit.
        Nécessite le mode sudo avec la permission can_manage_avoirs.
        """
        from django.db.models import F
        from django.utils import timezone
        avoir = self.get_object()

        if not avoir.stock_decharge:
            return Response(
                {'error': 'Le stock de cet avoir n\'a pas été déchargé.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Action sensible : sudo requis
        cancel_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_avoirs')
        if error_res:
            return error_res

        try:
            with transaction.atomic():
                avoir = Avoir.objects.select_for_update().get(pk=self.kwargs['pk'])
                lignes = list(avoir.produits.select_related('produit', 'stock_lot').all())

                product_ids = sorted({ligne.produit_id for ligne in lignes if ligne.produit_id})
                lot_ids = sorted({ligne.stock_lot_id for ligne in lignes if ligne.stock_lot_id})
                locked_products = {p.id: p for p in Produit.objects.filter(id__in=product_ids).select_for_update().order_by('id')} if product_ids else {}
                locked_lots = {l.id: l for l in StockLot.objects.filter(id__in=lot_ids).select_for_update().order_by('id')} if lot_ids else {}

                for ligne in lignes:
                    produit = locked_products.get(ligne.produit_id) if ligne.produit_id else None
                    if not produit:
                        continue

                    used_lots = []
                    # Re-mise en stock du lot si applicable
                    if ligne.stock_lot_id:
                        lot = locked_lots.get(ligne.stock_lot_id)
                        if not lot:
                            continue
                        lot.quantity_remaining += ligne.quantity
                        lot.quantity_free_remaining = min(
                            lot.quantity_free_remaining + ligne.quantity,
                            lot.quantity_remaining
                        )
                        lot.save()
                        used_lots.append(lot)
                    elif produit.use_lot_management:
                        # Si le produit gère les lots mais qu'aucun lot n'était spécifié,
                        # on ne peut pas savoir exactement quels lots étaient impliqués.
                        # On remet simplement la quantité dans le stock global du produit
                        # sans toucher aux lots individuels.
                        pass

                    # Mise à jour du stock produit
                    if produit.use_lot_management and ligne.stock_lot_id:
                        produit.calculate_stock_from_lots()
                    else:
                        produit.stock = F('stock') + ligne.quantity
                        produit.save(update_fields=['stock'])
                        produit.refresh_from_db()

                    # Mouvement de stock (RETOUR = annulation du déchargement)
                    motif_info = f" - {ligne.motif}" if ligne.motif else ""
                    lot_info = f" - Lot: {', '.join(l.lot for l in used_lots if l.lot)}" if used_lots else ""
                    MouvementStock.objects.create(
                        produit=produit,
                        type_mouvement=MouvementStock.TypeMouvement.RETOUR,
                        quantite=ligne.quantity,
                        stock_apres=produit.stock,
                        user=cancel_user,
                        description=f"Annulation décharge Avoir {avoir.numero} - {avoir.fournisseur.name if avoir.fournisseur else 'Fournisseur'}{lot_info}{motif_info}"
                    )

                    log_audit(
                        user=request.user,
                        action='STOCK_ADJ',
                        model_name='Avoir',
                        object_id=avoir.numero,
                        description=f"Annulation décharge Avoir {avoir.numero} (autorisé par: {cancel_user.username})",
                        details={
                            'produit_id': produit.id,
                            'produit_nom': produit.name,
                            'quantity': ligne.quantity,
                            'motif': ligne.motif,
                            'lot': ligne.lot,
                            'cancelled_by': cancel_user.username,
                        },
                        request=request
                    )

                # Marquer l'avoir comme non déchargé
                avoir.stock_decharge = False
                avoir.stock_decharge_at = None
                avoir.stock_decharge_by = None
                avoir.save(update_fields=['stock_decharge', 'stock_decharge_at', 'stock_decharge_by'])

                return Response({
                    'status': 'Déchargement annulé avec succès. Stock réintégré.',
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

    def perform_update(self, serializer):
        ligne = serializer.save()
        avoir = ligne.avoir
        if avoir.status == 'BROUILLON' and avoir.produits.exists():
            all_closed = not avoir.produits.filter(est_cloture=False).exists()
            if all_closed:
                avoir.status = 'VALIDEE'
                avoir.validated_by = self.request.user
                avoir.save(update_fields=['status', 'validated_by'])
                log_audit(
                    user=self.request.user,
                    action='AUTO_VALIDATE',
                    model_name='Avoir',
                    object_id=avoir.numero,
                    description=f"Validation automatique Avoir {avoir.numero} (toutes lignes clôturées)",
                    request=self.request
                )
