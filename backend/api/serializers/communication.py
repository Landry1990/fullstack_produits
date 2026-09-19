"""
Serializers pour la communication (SMS, WhatsApp, Telegram, messages internes).
"""
from pathlib import Path

from django.db.models import Q
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers
from rest_framework.reverse import reverse

from ..models import (
    InternalMessage,
    MessageTemplate,
    RuptureFournisseur,
    SmsLog,
    SmsTemplate,
    TelegramLog,
    WhatsAppLog,
)


class SmsTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsTemplate
        fields = '__all__'


class SmsLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    promis_detail = serializers.SerializerMethodField()

    class Meta:
        model = SmsLog
        fields = '__all__'
        read_only_fields = ['status', 'sent_at', 'provider_response', 'sent_by']

    def get_promis_detail(self, obj):
        if obj.promis:
            return f"{obj.promis.produit_name} ({obj.promis.quantite})"
        return None


class WhatsAppLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    client_name_db = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = WhatsAppLog
        fields = '__all__'


class TelegramLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    client_name_db = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = TelegramLog
        fields = '__all__'


class RuptureFournisseurSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    utilisateur_nom = serializers.CharField(source='utilisateur.username', read_only=True)

    class Meta:
        model = RuptureFournisseur
        fields = '__all__'


class InternalMessageSerializer(serializers.ModelSerializer):
    attachment = serializers.FileField(write_only=True, required=False, allow_null=True)
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    recipient_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    parent_content = serializers.CharField(source='parent.content', read_only=True)
    parent_sender_name = serializers.CharField(source='parent.sender.username', read_only=True)
    is_archived = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = InternalMessage
        fields = [
            'id', 'sender', 'sender_name', 'recipient', 'recipient_name', 'content',
            'attachment', 'attachment_url', 'read_by', 'is_read', 'is_archived',
            'parent', 'parent_content', 'parent_sender_name', 'created_at',
        ]
        read_only_fields = ['sender', 'created_at', 'read_by']

    def validate_attachment(self, attachment):
        if attachment is None:
            return None

        allowed_types = {
            '.jpg': {'image/jpeg'},
            '.jpeg': {'image/jpeg'},
            '.png': {'image/png'},
            '.webp': {'image/webp'},
            '.pdf': {'application/pdf'},
        }
        extension = Path(attachment.name).suffix.lower()
        if extension not in allowed_types:
            raise serializers.ValidationError('Format non autorisé. Utilisez PDF, JPG, PNG ou WebP.')
        if attachment.content_type not in allowed_types[extension]:
            raise serializers.ValidationError('Le type du fichier ne correspond pas à son extension.')
        if attachment.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('La pièce jointe ne doit pas dépasser 10 Mo.')

        position = attachment.tell()
        try:
            attachment.seek(0)
            if extension == '.pdf':
                if attachment.read(5) != b'%PDF-':
                    raise serializers.ValidationError('Le contenu du fichier ne correspond pas à son format.')
                attachment.seek(max(0, attachment.size - 1024))
                if b'%%EOF' not in attachment.read():
                    raise serializers.ValidationError('Le contenu du fichier ne correspond pas à son format.')
            else:
                expected_format = {'.jpg': 'JPEG', '.jpeg': 'JPEG', '.png': 'PNG', '.webp': 'WEBP'}[extension]
                try:
                    image = Image.open(attachment)
                    image.verify()
                except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
                    raise serializers.ValidationError('Le contenu du fichier ne correspond pas à son format.')
                if image.format != expected_format:
                    raise serializers.ValidationError('Le contenu du fichier ne correspond pas à son format.')
        finally:
            attachment.seek(position)
        return attachment

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        recipient = attrs.get('recipient')
        parent = attrs.get('parent')

        if user and recipient is None and not user.is_staff:
            raise serializers.ValidationError({'recipient': 'Seul un administrateur peut envoyer un message à tous.'})

        if user and parent:
            if not InternalMessage.objects.filter(
                Q(pk=parent.pk),
                Q(sender=user) | Q(recipient=user) | Q(recipient__isnull=True),
            ).exists():
                raise serializers.ValidationError({'parent': 'Vous ne pouvez pas répondre à ce message.'})

            expected_recipient_id = parent.sender_id if parent.sender_id != user.id else parent.recipient_id
            if expected_recipient_id is not None and recipient and recipient.id != expected_recipient_id:
                raise serializers.ValidationError({'recipient': 'Le destinataire doit appartenir à la conversation d’origine.'})

        return attrs

    def get_attachment_url(self, obj):
        if obj.attachment:
            return reverse('internalmessage-attachment', kwargs={'pk': obj.pk}, request=self.context.get('request'))
        return None

    def get_recipient_name(self, obj):
        return obj.recipient.username if obj.recipient else 'Tous'

    def get_is_archived(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        if hasattr(obj, '_prefetched_objects_cache') and 'archived_by' in obj._prefetched_objects_cache:
            return any(u.id == request.user.id for u in obj.archived_by.all())
        return obj.archived_by.filter(id=request.user.id).exists()

    def get_is_read(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        if obj.sender_id == request.user.id:
            return True

        if hasattr(obj, '_prefetched_objects_cache') and 'read_by' in obj._prefetched_objects_cache:
            return any(u.id == request.user.id for u in obj.read_by.all())

        return obj.read_by.filter(id=request.user.id).exists()


class MessageTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = MessageTemplate
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']
