import io

from django.db import transaction
from django.db.models import CharField, Count, DecimalField, Exists, ExpressionWrapper, F, OuterRef, Q, Sum, Value
from django.db.models.functions import Abs, Cast, Coalesce, Concat
from django.http import HttpResponse
from django_filters import rest_framework as django_filters
from django_filters.rest_framework import DjangoFilterBackend
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...models import AuditLog, MouvementStock, Produit, StockAdjustment, StockLot
from ...pagination import StandardResultsSetPagination
from ...services.realtime import notify_stock_changed
from ...services.stock_obligation_service import StockObligationService
from ...sudo_utils import validate_sudo_mode
from ...search_mixins import MultiTermSearchMixin
from ...serializers import StockAdjustmentSerializer
from ...utils.dates import day_bounds


class StockAdjustmentFilter(django_filters.FilterSet):
    """Le param ``created_at__date`` (jour exact) applique des bornes datetime
    ``[jour 00:00, lendemain 00:00)`` au lieu du cast ``::date`` SQL qui
    neutralise l'index btree sur ``created_at``."""

    created_at__date = django_filters.DateFilter(field_name='created_at', method='filter_created_at_day')

    def filter_created_at_day(self, queryset, name, value):
        lo, hi = day_bounds(value)
        return queryset.filter(created_at__gte=lo, created_at__lt=hi)

    class Meta:
        model = StockAdjustment
        fields = {
            'produit': ['exact'],
            'user': ['exact'],
            'reason_type': ['exact'],
            'created_at': ['gte', 'lte'],
        }


class StockAdjustmentViewSet(MultiTermSearchMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour consulter l'historique des ajustements de stock.
    Lecture seule - les ajustements sont créés via l'action 'adjust_stock' de ProduitViewSet.
    """
    queryset = StockAdjustment.objects.select_related('produit', 'user', 'stock_lot').annotate(
        restored=Exists(
            StockAdjustment.objects.filter(
                reason_detail=Concat(Value('Annulation sortie périmée #'), Cast(OuterRef('pk'), CharField()))
            )
        )
    ).order_by('-created_at')
    serializer_class = StockAdjustmentSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = StockAdjustmentFilter
    search_fields = ['produit__name', 'reason_detail', 'produit__cip1', 'produit__cip4']
    ordering_fields = ['created_at', 'quantity_change']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Calculates statistics based on current filters.
        Retourne total_count, positive_sum et negative_sum pour les cartes du frontend.
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        stats = queryset.aggregate(
            total_count=Count('id'),
            positive_sum=Sum('quantity_change', filter=Q(quantity_change__gt=0)),
            negative_sum=Sum('quantity_change', filter=Q(quantity_change__lt=0))
        )
        
        return Response({
            'total_count': stats['total_count'] or 0,
            'positive_sum': stats['positive_sum'] or 0,
            'negative_sum': stats['negative_sum'] or 0
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def restaurer_sortie_perimee(self, request, pk=None):
        try:
            adjustment = StockAdjustment.objects.select_for_update().get(pk=pk)
        except StockAdjustment.DoesNotExist:
            return Response({'detail': 'Ajustement introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if adjustment.reason_type != StockAdjustment.ReasonType.PERIME or adjustment.quantity_change >= 0:
            return Response({'detail': "Seule une sortie de périmé peut être ramenée en stock."}, status=status.HTTP_400_BAD_REQUEST)
        if not adjustment.stock_lot_id or not adjustment.produit_id:
            return Response({'detail': 'Le lot ou le produit associé est introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        reversal_detail = f'Annulation sortie périmée #{adjustment.id}'
        if StockAdjustment.objects.filter(reason_detail=reversal_detail).exists():
            return Response({'detail': 'Cette sortie a déjà été ramenée en stock.'}, status=status.HTTP_409_CONFLICT)

        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_manage_perimes')
        if error_response:
            return error_response

        lot = StockLot.objects.select_for_update().get(pk=adjustment.stock_lot_id)
        produit = Produit.objects.select_for_update().get(pk=adjustment.produit_id)
        quantity = -adjustment.quantity_change
        quantity_before = lot.quantity_remaining

        lot.quantity_remaining = F('quantity_remaining') + quantity
        lot.save(update_fields=['quantity_remaining'])
        lot.refresh_from_db()
        if produit.use_lot_management:
            produit.calculate_stock_from_lots()
        else:
            produit.stock = F('stock') + quantity
            produit.save(update_fields=['stock'])
        StockObligationService.reapply_pending_obligations([produit.id])
        produit.refresh_from_db()

        reversal = StockAdjustment.objects.create(
            produit=produit,
            stock_lot=lot,
            user=validation_user,
            quantity_before=quantity_before,
            quantity_after=lot.quantity_remaining,
            quantity_change=quantity,
            reason_type=StockAdjustment.ReasonType.PERIME,
            reason_detail=reversal_detail,
        )
        MouvementStock.objects.create(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.RETOUR,
            quantite=quantity,
            stock_apres=produit.total_stock,
            user=validation_user,
            description=f'Annulation sortie périmés - Lot {lot.lot} - ajustement #{adjustment.id}',
        )
        log_audit(
            user=validation_user,
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='StockAdjustment',
            object_id=adjustment.id,
            description=f'Annulation sortie périmée: {quantity} unités ramenées dans le lot {lot.lot}',
            details={'adjustment_id': adjustment.id, 'reversal_id': reversal.id, 'lot_id': lot.id, 'produit_id': produit.id, 'quantity': quantity},
            request=request,
        )
        notify_stock_changed([produit.id])
        return Response({'detail': 'La sortie périmée a été ramenée en stock.', 'quantity': quantity, 'reversal_id': reversal.id})

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Même annotation pour l'export
        queryset = queryset.annotate(
            valorisation_calcul=ExpressionWrapper(
                Abs(F('quantity_change')) * Coalesce(F('stock_lot__price_cost'), Value(0, output_field=DecimalField())),
                output_field=DecimalField()
            )
        )

        from django.utils import timezone as tz

        from ...models import PharmacySettings

        wb = Workbook()
        sheet = wb.active
        if sheet is None:
            sheet = wb.worksheets[0] if wb.worksheets else wb.create_sheet()
        sheet.title = "Ajustements Stock"

        # En-tête pharmacie
        try:
            pharmacy = PharmacySettings.objects.get(pk=1)
            from ...utils.currency import get_pharmacy_name
            pharma_name = get_pharmacy_name()
            pharma_address = f"{pharmacy.address} - {pharmacy.city}".strip(" -") if pharmacy.address or pharmacy.city else ""
            pharma_phone = f"Tél : {pharmacy.phone}" if pharmacy.phone else ""
        except PharmacySettings.DoesNotExist:
            from ...utils.currency import get_pharmacy_name
            pharma_name = get_pharmacy_name()
            pharma_address, pharma_phone = "", ""

        now_str = tz.localtime(tz.now()).strftime("%d/%m/%Y à %H:%M")
        for line in [pharma_name, pharma_address, pharma_phone, f"Édité le : {now_str}", "", "Journal des Ajustements de Stock"]:
            sheet.append([line])
        sheet.append([])  # ligne vide avant le tableau

        # Ligne d'en-tête du tableau
        columns = [
            "Date", "Produit", "CIP", "Type", "Lot", "Qté Change", "Valorisation", "Utilisateur"
        ]
        sheet.append(columns)
        header_row = sheet.max_row

        # Style en-tête
        for cell in sheet[header_row]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')

        # Données
        for adj in queryset:
            row = [
                adj.created_at.strftime("%d/%m/%Y %H:%M") if adj.created_at else "",
                adj.produit_name if hasattr(adj, 'produit_name') else (adj.produit.name if adj.produit else "-"),
                adj.produit_cip if hasattr(adj, 'produit_cip') else (adj.produit.cip1 if adj.produit else "-"),
                adj.get_reason_type_display(),
                adj.lot_number if hasattr(adj, 'lot_number') else (adj.stock_lot.lot if adj.stock_lot else "-"),
                adj.quantity_change,
                adj.valorisation_calcul,
                adj.username if hasattr(adj, 'username') else (adj.user.username if adj.user else "Système")
            ]
            sheet.append(row)

        # Ajuster largeur colonnes (skip header block rows before the table)
        dims = {}
        for row in sheet.rows:
            for cell in row:
                if cell.row <= header_row:
                    continue
                if cell.value and cell.column is not None:
                    col_letter = get_column_letter(cell.column)
                    dims[col_letter] = max((dims.get(col_letter, 0), len(str(cell.value))))
        for col, value in dims.items():
            sheet.column_dimensions[col].width = min(30, max(10, value + 2))

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        log_audit(
            user=request.user,
            action=AuditLog.Action.EXPORT,
            model_name='StockAdjustment',
            object_id=0,
            description="Export Excel du journal des ajustements de stock",
            details={'params': request.query_params.dict()},
            request=request,
        )

        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=journal_sorties_perimes.xlsx'
        return response
