from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
import logging

from ...models import FactureProduit, AuditLog
from ...serializers import FactureProduitSerializer
from ...whatsapp_service import WhatsAppService
from ...audit_helpers import log_audit

logger = logging.getLogger(__name__)


class FactureProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for facture produits."""
    queryset = FactureProduit.objects.select_related('produit', 'facture', 'stock_lot').order_by('-created_at')
    serializer_class = FactureProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit', 'facture']
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def envoi_rappel_renouvellement(self, request, pk=None):
        """
        Déclenche l'envoi d'un rappel de renouvellement WhatsApp.
        """
        line = self.get_object()
        if not line.produit or not line.produit.is_chronic:
            return Response({'detail': 'Ce produit n\'est pas marqué comme traitement chronique.'}, status=status.HTTP_400_BAD_REQUEST)
        
        success, message = WhatsAppService.send_renewal_reminder(line)
        if success:
            log_audit(
                user=request.user,
                action=AuditLog.Action.OTHER,
                model_name='FactureProduit',
                object_id=line.id,
                description=f"Rappel renouvellement envoyé pour {line.produit.name}",
                details={'facture': line.facture.id, 'client': line.facture.client_id},
                request=request
            )
            return Response({'detail': message})
        return Response({'detail': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
