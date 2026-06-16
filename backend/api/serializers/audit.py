# -*- coding: utf-8 -*-
"""
Serializers pour l'audit, logs et mouvements de caisse.
"""
from rest_framework import serializers
from ..models import AuditLog, MouvementCaisse


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'action_display', 'model_name',
                  'object_id', 'description', 'details', 'ip_address', 'timestamp']

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username
        return 'Système'


class MouvementCaisseSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MouvementCaisse
        fields = '__all__'
        read_only_fields = ['date']
