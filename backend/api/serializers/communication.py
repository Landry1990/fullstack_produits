# -*- coding: utf-8 -*-
"""
Serializers pour la communication (SMS, WhatsApp, Telegram, messages internes).
"""
from rest_framework import serializers
from ..models import (
    SmsTemplate, SmsLog, WhatsAppLog, TelegramLog,
    RuptureFournisseur, InternalMessage, MessageTemplate,
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
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    recipient_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    parent_content = serializers.CharField(source='parent.content', read_only=True)
    parent_sender_name = serializers.CharField(source='parent.sender.username', read_only=True)
    is_archived = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = InternalMessage
        fields = '__all__'
        read_only_fields = ['sender', 'created_at', 'read_by', 'archived_by']

    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url
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
