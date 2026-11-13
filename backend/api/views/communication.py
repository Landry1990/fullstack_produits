import csv
import io
import mimetypes
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import models
from django.http import FileResponse, HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..audit_helpers import log_audit
from ..audit_mixins import AuditedViewSetMixin
from ..models import (
    AuditLog,
    Client,
    InternalMessage,
    MessageTemplate,
    Promis,
    SmsLog,
    SmsTemplate,
    TelegramLog,
    TreatmentReminder,
    WhatsAppLog,
)
from ..pagination import StandardResultsSetPagination
from ..serializers import (
    InternalMessageSerializer,
    MessageTemplateSerializer,
    SmsLogSerializer,
    SmsTemplateSerializer,
    TelegramLogSerializer,
    TreatmentReminderSerializer,
    WhatsAppLogSerializer,
)
from ..services.sms import SmsService
from ..utils.validation import parse_id


class SmsViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
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
        # parse_id lève ValidationError (400) : id='abc' dans .get() lèverait
        # ValueError (non attrapé par DoesNotExist) → 500.
        context = {}
        if context_type == 'PROMIS' and context_id:
            try:
                promis = Promis.objects.get(id=parse_id(context_id, field='context_id'))
                context['promis'] = promis
            except Promis.DoesNotExist:
                pass

        elif context_type == 'CLIENT' and context_id:
            try:
                client = Client.objects.get(id=parse_id(context_id, field='context_id'))
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

        # Envoi réel de SMS (coût externe) : trace succès comme échec
        log_audit(
            user=request.user,
            action=AuditLog.Action.OTHER,
            model_name='SmsLog',
            object_id=0,
            description=f"Envoi SMS {'réussi' if success else 'échoué'} à {recipient} ({context_type})",
            details={
                'recipient': recipient,
                'context_type': context_type,
                'context_id': context_id,
                'success': success,
            },
            request=request,
        )

        if success:
            return Response({"message": result, "status": "success"})
        else:
            return Response({"error": result}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SmsTemplateViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
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
            qs = qs.filter(client_id=parse_id(client_id, field='client'))

        return qs


class TelegramLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Historique des messages Telegram.
    """
    queryset = TelegramLog.objects.select_related('facture', 'client', 'sent_by').order_by('-created_at')
    serializer_class = TelegramLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        type_filter = params.get('type')
        status_filter = params.get('status')
        client_id = params.get('client')
        search = (params.get('search') or '').strip()

        if type_filter:
            qs = qs.filter(type=type_filter)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if client_id:
            qs = qs.filter(client_id=parse_id(client_id, field='client'))
        if search:
            qs = qs.filter(
                models.Q(message__icontains=search) |
                models.Q(recipient_name__icontains=search) |
                models.Q(recipient_chat_id__icontains=search) |
                models.Q(facture__numero_facture__icontains=search)
            )

        return qs

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Exporte les logs Telegram filtrés au format CSV (max 10 000 lignes)."""
        qs = self.get_queryset()[:10000]

        output = io.StringIO()
        writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        writer.writerow(['Date création', 'Date envoi', 'Expéditeur', 'Destinataire', 'Chat ID', 'Type', 'Statut', 'Facture', 'Pièce jointe', 'Message'])

        for log in qs.iterator(chunk_size=1000):
            writer.writerow([
                log.created_at.strftime('%Y-%m-%d %H:%M:%S') if log.created_at else '',
                log.sent_at.strftime('%Y-%m-%d %H:%M:%S') if log.sent_at else '',
                log.sent_by.username if log.sent_by else 'Système',
                log.recipient_name or '',
                log.recipient_chat_id or '',
                log.get_type_display(),
                log.get_status_display(),
                log.facture.numero_facture if log.facture else '',
                log.attachment_path or '',
                (log.message or '').replace('\n', ' ').replace('\r', ' '),
            ])

        log_audit(
            user=request.user,
            action=AuditLog.Action.EXPORT,
            model_name='TelegramLog',
            object_id=0,
            description="Export CSV de l'historique Telegram",
            details={'filtres': request.GET.dict()},
            request=request,
        )

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="telegram_logs.csv"'
        response.write('\ufeff')
        response.write(output.getvalue())
        return response


class InternalMessageViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
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

    def _conversation_messages(self, peer_id):
        user = self.request.user
        return InternalMessage.objects.filter(
            models.Q(sender=user, recipient_id=peer_id) |
            models.Q(sender_id=peer_id, recipient=user)
        ).exclude(archived_by=user)

    @action(detail=False, methods=['get'])
    def conversations(self, request):
        latest = self._conversation_messages(models.OuterRef('pk')).order_by('-id')
        unread = latest.filter(recipient=request.user).exclude(read_by=request.user).order_by().values('sender').annotate(total=models.Count('pk')).values('total')
        peers = get_user_model().objects.exclude(pk=request.user.pk).annotate(
            last_message_id=models.Subquery(latest.values('id')[:1]),
            last_content=models.Subquery(latest.values('content')[:1]),
            last_created_at=models.Subquery(latest.values('created_at')[:1]),
            unread_count=models.Subquery(unread[:1]),
        ).filter(last_message_id__isnull=False).order_by('-last_message_id')
        search = request.query_params.get('search', '').strip()
        if search:
            peers = peers.filter(username__icontains=search)
        page = self.paginate_queryset(peers)
        return self.get_paginated_response([
            {'peer_id': peer.pk, 'peer_name': peer.username, 'last_content': peer.last_content,
             'last_created_at': peer.last_created_at, 'unread_count': peer.unread_count or 0}
            for peer in page
        ])

    @action(detail=False, methods=['get'])
    def conversation(self, request):
        peer_id = parse_id(request.query_params.get('peer'), field='peer')
        qs = self._conversation_messages(peer_id).select_related('sender', 'recipient', 'parent', 'parent__sender').prefetch_related('read_by', 'archived_by').order_by('-id')
        before = request.query_params.get('before')
        if before is not None:
            qs = qs.filter(id__lt=parse_id(before, field='before'))
        messages = list(qs[:31])
        has_more = len(messages) > 30
        messages = messages[:30]
        return Response({'results': self.get_serializer(messages, many=True).data,
                         'next_before': messages[-1].id if has_more else None})

    @action(detail=False, methods=['post'])
    def conversation_read(self, request):
        from rest_framework.exceptions import ValidationError
        peer_id = parse_id(request.data.get('peer'), field='peer')
        ids = request.data.get('ids')
        if not isinstance(ids, list) or len(ids) > 30:
            raise ValidationError({'ids': 'Sélectionnez au maximum 30 messages.'})
        ids = [parse_id(value, field='ids') for value in ids]
        messages = self._conversation_messages(peer_id).filter(id__in=ids, recipient=request.user).exclude(read_by=request.user)
        through = InternalMessage.read_by.through
        through.objects.bulk_create([
            through(internalmessage_id=message_id, user_id=request.user.pk)
            for message_id in messages.values_list('id', flat=True)
        ], ignore_conflicts=True)
        return Response({'status': 'messages marked as read'})

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='InternalMessage',
            object_id=message.pk,
            description=f"Message interne envoyé à {message.recipient or 'tous'} (#{message.pk})",
            request=self.request,
        )

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


class MessageTemplateViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
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
        template = serializer.save(created_by=self.request.user)
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='MessageTemplate',
            object_id=template.pk,
            description=f"Création modèle de message « {template.title} » (#{template.pk})",
            request=self.request,
        )


def _is_reminder_admin(user) -> bool:
    """Admins des rappels : superuser, staff Django, ou rôle PHARMACIEN."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'role', None) == 'PHARMACIEN'


class TreatmentReminderViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    """
    Rappels internes de traitement (médicaments spécifiques clients).
    Créés manuellement par les admins ; la liste `due` alimente les popups.
    """
    queryset = TreatmentReminder.objects.select_related('client', 'produit', 'created_by', 'traite_par').all()
    serializer_class = TreatmentReminderSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.IsAuthenticated]

    def _require_admin(self):
        """Écritures + endpoint `due` réservés aux admins (pharmacien/staff)."""
        if not _is_reminder_admin(self.request.user):
            raise PermissionDenied("Réservé aux administrateurs.")

    def perform_update(self, serializer):
        self._require_admin()
        instance = serializer.save()
        if instance.produit and instance.produit_nom != instance.produit.name:
            instance.produit_nom = instance.produit.name
            instance.save(update_fields=['produit_nom'])

    def perform_destroy(self, instance):
        self._require_admin()
        instance.delete()

    def get_queryset(self):
        qs = super().get_queryset()
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)
        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)
        produit_id = self.request.query_params.get('produit')
        if produit_id:
            qs = qs.filter(produit_id=produit_id)
        return qs

    def perform_create(self, serializer):
        self._require_admin()
        produit = serializer.validated_data.get('produit')
        serializer.save(
            created_by=self.request.user,
            produit_nom=produit.name if produit else serializer.validated_data.get('produit_nom', ''),
        )

    @action(detail=False, methods=['get'])
    def due(self, request):
        """
        Rappels à afficher en popup :
        - EN_ATTENTE dont la fin de traitement tombe dans les
          `rappel_traitement_jours_avant` prochains jours (ou passée) ;
        - TRAITE (médicament arrivé) → le patient reste à informer.
        Désactivable via les réglages.
        """
        self._require_admin()

        from django.db.models import Q
        from django.utils import timezone
        from ..models import PharmacySettings

        settings_obj, _ = PharmacySettings.objects.get_or_create(pk=1)
        if not settings_obj.rappel_traitement_actif:
            return Response({'actif': False, 'rappels': []})

        Statut = self.queryset.model.Statut
        jours = settings_obj.rappel_traitement_jours_avant
        seuil = timezone.now().date() + timezone.timedelta(days=jours)
        qs = self.get_queryset().filter(
            Q(statut=Statut.EN_ATTENTE, date_fin_prevue__lte=seuil)
            | Q(statut=Statut.TRAITE)
        )[:50]

        # Promis dont le produit est arrivé (PRET) et client pas encore informé
        from ..models import Promis
        promis_qs = Promis.objects.filter(
            status=Promis.Status.PRET,
            is_active=True,
            client_informe_le__isnull=True,
        ).select_related('client', 'produit').order_by('date_promis')[:50]

        return Response({
            'actif': True,
            'jours_avant': jours,
            'rappels': self.get_serializer(qs, many=True).data,
            'promis': [{
                'id': p.id,
                'type': 'promis',
                'client': p.client_display,
                'client_phone': p.client_phone_display,
                'produit_nom': p.produit.name if p.produit else p.produit_nom or '',
                'quantite': p.quantite,
            } for p in promis_qs],
        })

    @action(detail=True, methods=['post'])
    def traiter(self, request, pk=None):
        self._require_admin()
        rappel = self.get_object()
        if rappel.statut != self.queryset.model.Statut.EN_ATTENTE:
            return Response({'detail': "Ce rappel n'est plus en attente."}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        rappel.statut = self.queryset.model.Statut.TRAITE
        rappel.traite_par = request.user
        rappel.traite_le = timezone.now()
        rappel.save(update_fields=['statut', 'traite_par', 'traite_le'])
        return Response(self.get_serializer(rappel).data)

    @action(detail=True, methods=['post'])
    def patient_informe(self, request, pk=None):
        """Marque le patient comme informé que son médicament est arrivé."""
        self._require_admin()
        rappel = self.get_object()
        if rappel.statut != self.queryset.model.Statut.TRAITE:
            return Response({'detail': "Ce rappel n'est pas en attente d'information patient."}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        rappel.statut = self.queryset.model.Statut.PATIENT_INFORME
        rappel.informe_par = request.user
        rappel.informe_le = timezone.now()
        rappel.save(update_fields=['statut', 'informe_par', 'informe_le'])
        return Response(self.get_serializer(rappel).data)

    @action(detail=True, methods=['post'])
    def ignorer(self, request, pk=None):
        self._require_admin()
        rappel = self.get_object()
        if rappel.statut not in (self.queryset.model.Statut.EN_ATTENTE, self.queryset.model.Statut.TRAITE):
            return Response({'detail': "Ce rappel n'est plus actif."}, status=status.HTTP_400_BAD_REQUEST)
        rappel.statut = self.queryset.model.Statut.IGNORE
        rappel.save(update_fields=['statut'])
        return Response(self.get_serializer(rappel).data)
