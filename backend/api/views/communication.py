import mimetypes
from pathlib import Path

from django.db import models
from django.http import FileResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..models import (
    Client,
    InternalMessage,
    MessageTemplate,
    Promis,
    SmsLog,
    SmsTemplate,
    TelegramLog,
    WhatsAppLog,
)
from ..pagination import StandardResultsSetPagination
from ..serializers import (
    InternalMessageSerializer,
    MessageTemplateSerializer,
    SmsLogSerializer,
    SmsTemplateSerializer,
    TelegramLogSerializer,
    WhatsAppLogSerializer,
)
from ..services.sms import SmsService


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


class TelegramLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Historique des messages Telegram.
    """
    queryset = TelegramLog.objects.all().order_by('-created_at')
    serializer_class = TelegramLogSerializer
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
        params = self.request.query_params
        base_qs = InternalMessage.objects.select_related('sender', 'recipient').prefetch_related(
            'read_by', 'archived_by', 'parent', 'parent__sender'
        ).order_by('-created_at')

        box = params.get('box')
        if box is not None:
            if box == 'all':
                if not user.is_staff:
                    raise PermissionDenied('La supervision de tous les messages est réservée au personnel.')
                qs = base_qs
            elif box == 'sent':
                qs = base_qs.filter(sender=user)
            elif box == 'archived':
                qs = base_qs.filter(
                    models.Q(recipient=user) |
                    models.Q(recipient__isnull=True) |
                    models.Q(sender=user)
                ).filter(archived_by=user).distinct()
            elif box == 'received':
                qs = base_qs.filter(
                    models.Q(recipient=user) | models.Q(recipient__isnull=True)
                ).exclude(sender=user).exclude(archived_by=user).distinct()
            else:
                qs = base_qs.none()

            search = params.get('search')
            if search:
                qs = qs.filter(
                    models.Q(content__icontains=search) |
                    models.Q(sender__username__icontains=search) |
                    models.Q(recipient__username__icontains=search)
                )

            has_attachment = params.get('has_attachment')
            if has_attachment is not None and has_attachment.lower() in {'true', 'false'}:
                if has_attachment.lower() == 'true':
                    qs = qs.filter(attachment__isnull=False).exclude(attachment='')
                else:
                    qs = qs.filter(models.Q(attachment__isnull=True) | models.Q(attachment=''))

            unread = params.get('unread')
            if box == 'received' and unread is not None and unread.lower() in {'true', 'false'}:
                if unread.lower() == 'true':
                    qs = qs.exclude(read_by=user)
                else:
                    qs = qs.filter(read_by=user)

            return qs

        show_all = params.get('all', '').lower() == 'true'
        staff_detail_action = self.action in {'retrieve', 'update', 'partial_update', 'destroy', 'attachment'}

        # Les administrateurs peuvent consulter toutes les conversations
        if user.is_staff and (show_all or staff_detail_action):
            return base_qs

        # Utilisateurs normaux : voir ses messages reçus (individuels ou collectifs) ou envoyés
        return base_qs.filter(
            models.Q(recipient=user) |
            models.Q(recipient__isnull=True) |
            models.Q(sender=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response(
                {'detail': 'Seul un administrateur peut modifier un message existant.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response(
                {'detail': 'Seul un administrateur peut supprimer définitivement un message.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def attachment(self, request, pk=None):
        message = self.get_object()
        if not message.attachment:
            return Response({'detail': 'Ce message ne contient aucune pièce jointe.'}, status=status.HTTP_404_NOT_FOUND)
        content_type = mimetypes.guess_type(message.attachment.name)[0] or 'application/octet-stream'
        return FileResponse(
            message.attachment.open('rb'),
            content_type=content_type,
            filename=Path(message.attachment.name).name,
        )

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        message = self.get_object()
        message.archived_by.add(request.user)
        return Response({'status': 'message archived'})

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        message = self.get_object()
        if message.sender_id == request.user.id:
            return Response(
                {'detail': 'Un expéditeur ne peut pas marquer son propre message comme lu.'},
                status=status.HTTP_403_FORBIDDEN,
            )
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

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy'}:
            return [permissions.IsAdminUser()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
