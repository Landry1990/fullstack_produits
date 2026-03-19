from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import F, Sum, DecimalField, Count, Value, ExpressionWrapper
from django.db.models.functions import Coalesce, Abs
from django_filters.rest_framework import DjangoFilterBackend
import io
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

from ...models import StockAdjustment
from ...serializers import StockAdjustmentSerializer
from ...search_mixins import MultiTermSearchMixin
from ...pagination import StandardResultsSetPagination


class StockAdjustmentViewSet(MultiTermSearchMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour consulter l'historique des ajustements de stock.
    Lecture seule - les ajustements sont créés via l'action 'adjust_stock' de ProduitViewSet.
    """
    queryset = StockAdjustment.objects.select_related('produit', 'user', 'stock_lot').order_by('-created_at')
    serializer_class = StockAdjustmentSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.AllowAny] # As per original view
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {
        'produit': ['exact'],
        'user': ['exact'],
        'reason_type': ['exact'],
        'created_at': ['gte', 'lte', 'date'],
    }
    search_fields = ['produit__name', 'reason_detail', 'produit__cip1']
    ordering_fields = ['created_at', 'quantity_change']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Calculates statistics based on current filters.
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        # On calcule la valorisation via annotation pour pouvoir faire un Sum
        queryset = queryset.annotate(
            valorisation_calcul=ExpressionWrapper(
                Abs(F('quantity_change')) * Coalesce(F('stock_lot__price_cost'), Value(0, output_field=DecimalField())),
                output_field=DecimalField()
            )
        )

        stats = queryset.aggregate(
            total_count=Count('id'),
            total_valorisation=Sum('valorisation_calcul')
        )
        
        return Response({
            'count': stats['total_count'] or 0,
            'total_valorisation': stats['total_valorisation'] or 0
        })

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

        wb = Workbook()
        sheet = wb.active
        sheet.title = "Ajustements Stock"

        # En-tête
        columns = [
            "Date", "Produit", "CIP", "Type", "Lot", "Qté Change", "Valorisation", "Utilisateur"
        ]
        sheet.append(columns)
        
        # Style en-tête
        for cell in sheet[1]:
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

        # Ajuster largeur colonnes
        dims = {}
        for row in sheet.rows:
            for cell in row:
                if cell.value:
                    dims[cell.column_letter] = max((dims.get(cell.column_letter, 0), len(str(cell.value))))
        for col, value in dims.items():
            sheet.column_dimensions[col].width = value + 2

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=journal_sorties_perimes.xlsx'
        return response
