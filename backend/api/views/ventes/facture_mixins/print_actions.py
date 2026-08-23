import logging

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.models import (
    AuditLog,
    Facture,
    InvoiceSettings,
)
from api.security_utils import build_safe_content_disposition
from api.serializers import FacturePrintSerializer
from api.services.invoice_pdf import generate_invoice_pdf
from api.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


class FacturePrintMixin:
    """Actions d'impression et communication : imprimer_facture, send_whatsapp, print_data, generer_avoir."""

    @action(detail=True, methods=['get'])
    def imprimer_facture(self, request, pk=None):
        """
        Génère un PDF pour la facture.
        """
        facture = self.get_object()
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        is_proforma = request.query_params.get('type') == 'proforma' or facture.status == Facture.Status.PROFORMA

        buffer = generate_invoice_pdf(facture, settings, is_proforma)

        from django.http import HttpResponse
        response = HttpResponse(content_type='application/pdf')
        filename = f"facture_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = build_safe_content_disposition(filename, disposition='inline')
        response.write(buffer.getvalue())
        return response

    @action(detail=True, methods=['post'])
    def send_whatsapp(self, request, pk=None):
        """
        Envoie la facture par WhatsApp.
        """
        facture = self.get_object()
        client = facture.client

        recipient_number = request.data.get('phone') or (client.phone if client else None)

        if not recipient_number:
            return Response({'detail': 'Aucun numéro de téléphone destinataire fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)

        # Check if enabled
        from ....models import PharmacySettings
        pharmacy_settings = PharmacySettings.objects.first()
        if not pharmacy_settings or not pharmacy_settings.whatsapp_enabled:
            return Response({'detail': 'L\'intégration WhatsApp n\'est pas activée dans les paramètres.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            buffer = generate_invoice_pdf(facture, settings)
            success, message = WhatsAppService.send_invoice_pdf(
                facture, recipient_number, buffer, client.name if client else "Client"
            )

            log_audit(
                request.user,
                AuditLog.Action.AUTRE,
                'Facture',
                facture.id,
                f"Envoi facture {facture.numero_facture} via WhatsApp à {recipient_number}",
                request=request
            )

            if success:
                return Response({'detail': message})
            return Response({'detail': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            logger.error(f"Erreur envoi WhatsApp: {e!s}")
            return Response({'detail': f"Erreur lors de l'envoi : {e!s}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def print_data(self, request, pk=None):
        """
        Retourne les données complètes pour l'impression frontend.
        """
        facture = self.get_object()
        serializer = FacturePrintSerializer(facture)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def generer_avoir(self, request, pk=None):
        """
        Retourne le contenu de la facture validée/payée, mais avec des quantités négatives
        pour faciliter la création d'un avoir (retour client) via le frontend.
        """
        facture = self.get_object()

        if facture.status not in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
            return Response(
                {'detail': "Seules les factures validées ou payées peuvent faire l'objet d'un avoir."},
                status=status.HTTP_400_BAD_REQUEST
            )

        client_data = None
        if facture.client:
            from ....serializers import ClientSerializer
            client_data = ClientSerializer(facture.client).data

        produits_data = []
        for item in facture.produits.select_related('produit').all():
            produit_info = {
                'id': item.produit.id,
                'name': item.produit.name,
                'tva': float(item.produit.tva),
                'cip1': item.produit.cip1,
                'use_lot_management': item.produit.use_lot_management,
                'stock': item.produit.stock,
            }
            produits_data.append({
                'id': item.id,
                'produit': item.produit_id,
                'produit_details': produit_info,
                'quantity': -abs(item.quantity), # Quantity in negative
                'selling_price': float(item.selling_price),
                'discount': float(item.discount),
                'tva': float(item.tva),
                'stock_lot': item.stock_lot_id,
                'lot': item.lot,
            })

        return Response({
            'original_facture_id': facture.id,
            'original_numero_facture': facture.numero_facture,
            'date': facture.date,
            'client': client_data,
            'client_name_override': facture.client_name_override,
            'ayant_droit': facture.ayant_droit_id,
            'remise': float(facture.remise),
            'produits': produits_data,
        })
