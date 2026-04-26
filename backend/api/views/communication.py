from django.utils import timezone
from django.db import models
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import SmsLog, SmsTemplate, Promis, Client, WhatsAppLog, InternalMessage, MessageTemplate
from ..serializers import SmsLogSerializer, SmsTemplateSerializer, WhatsAppLogSerializer, InternalMessageSerializer, MessageTemplateSerializer
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

class InternalMessageViewSet(viewsets.ModelViewSet):
    """
    Messagerie interne entre utilisateurs.
    """
    serializer_class = InternalMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        show_all = self.request.query_params.get('all', '').lower() == 'true'
        
        # Les administrateurs peuvent consulter toutes les conversations
        if user.is_staff and show_all:
            return InternalMessage.objects.all().select_related('sender', 'recipient').prefetch_related(
                'read_by', 'archived_by', 'parent', 'parent__sender'
            ).order_by('-created_at')
        
        # Utilisateurs normaux : voir ses messages reçus (individuels ou collectifs) ou envoyés
        return InternalMessage.objects.filter(
            models.Q(recipient=user) | 
            models.Q(recipient__isnull=True) |
            models.Q(sender=user)
        ).distinct().select_related('sender', 'recipient').prefetch_related(
            'read_by', 'archived_by', 'parent', 'parent__sender'
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        message = self.get_object()
        message.archived_by.add(request.user)
        return Response({'status': 'message archived'})

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        message = self.get_object()
        message.read_by.add(request.user)
        return Response({'status': 'message marked as read'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        from django.db.models import Q
        count = InternalMessage.objects.filter(
            Q(recipient=request.user) | Q(recipient__isnull=True)
        ).exclude(sender=request.user).exclude(read_by=request.user).exclude(archived_by=request.user).distinct().count()
        return Response({'count': count})


class MessageTemplateViewSet(viewsets.ModelViewSet):
    """
    Modèles de messages prédéfinis.
    """
    queryset = MessageTemplate.objects.all().order_by('title')
    serializer_class = MessageTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
