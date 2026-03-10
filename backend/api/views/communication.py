from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import SmsLog, SmsTemplate, Promis, Client, WhatsAppLog
from ..serializers import SmsLogSerializer, SmsTemplateSerializer, WhatsAppLogSerializer
from ..services.sms import SmsService
from ..pagination import StandardResultsSetPagination

class SmsViewSet(viewsets.ModelViewSet):
    """
    Gestion des SMS: Historique et Envoi.
    """
    queryset = SmsLog.objects.all().order_by('-created_at')
    serializer_class = SmsLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        # Filtres optionnels
        qs = super().get_queryset()
        type_filter = self.request.query_params.get('type')
        if type_filter:
            qs = qs.filter(type=type_filter)
        return qs

    @action(detail=False, methods=['post'])
    def send(self, request):
        """
        Envoie un SMS manuel ou lié à un contexte.
        Payload attendu:
        {
            "recipient": "6XXXXXXXX",
            "message": "Hello...",
            "context_type": "PROMIS|CLIENT|MANUEL",
            "context_id": 123
        }
        """
        data = request.data
        recipient = data.get('recipient')
        message = data.get('message')
        context_type = data.get('context_type', 'MANUEL')
        context_id = data.get('context_id')
        
        if not recipient or not message:
            return Response(
                {"error": "Destinataire et message requis"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Construction du contexte
        context = {}
        if context_type == 'PROMIS' and context_id:
            try:
                promis = Promis.objects.get(id=context_id)
                context['promis'] = promis
            except Promis.DoesNotExist:
                pass
                
        elif context_type == 'CLIENT' and context_id:
            try:
                client = Client.objects.get(id=context_id)
                context['client'] = client
            except Client.DoesNotExist:
                pass

        service = SmsService()
        success, result = service.send_sms(
            recipient=recipient,
            message=message,
            sms_type=context_type,
            user=request.user,
            context=context
        )
        
        if success:
            return Response({"message": result, "status": "success"})
        else:
            return Response({"error": result}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SmsTemplateViewSet(viewsets.ModelViewSet):
    queryset = SmsTemplate.objects.filter(is_active=True)
    serializer_class = SmsTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

class WhatsAppLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Historique des messages WhatsApp.
    """
    queryset = WhatsAppLog.objects.all().order_by('-created_at')
    serializer_class = WhatsAppLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        type_filter = self.request.query_params.get('type')
        status_filter = self.request.query_params.get('status')
        client_id = self.request.query_params.get('client')
        
        if type_filter:
            qs = qs.filter(type=type_filter)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if client_id:
            qs = qs.filter(client_id=client_id)
            
        return qs
