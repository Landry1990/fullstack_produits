# -*- coding: utf-8 -*-
"""
Serializers pour la configuration et les paramètres globaux.
"""
from rest_framework import serializers
from decimal import Decimal
from ..models import (
    TVA, InvoiceSettings, LoyaltySetting, PharmacySettings,
    ConfigurationOption, ObjectifCommercial,
)


class TVASerializer(serializers.ModelSerializer):
    class Meta:
        model = TVA
        fields = '__all__'


class InvoiceSettingsSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceSettings
        fields = '__all__'

    def get_company_name(self, obj):
        from ..utils_licence import valider_licence_systeme
        valide, msg, payload = valider_licence_systeme()
        if valide and payload and payload.get('pharmacie_nom'):
            return payload.get('pharmacie_nom')
        return obj.company_name


class LoyaltySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySetting
        fields = '__all__'
        read_only_fields = ['points_earned', 'points_spent', 'current_points']


class PharmacySettingsSerializer(serializers.ModelSerializer):
    pharmacy_name = serializers.SerializerMethodField()

    class Meta:
        model = PharmacySettings
        fields = '__all__'

    def get_pharmacy_name(self, obj):
        from ..utils_licence import valider_licence_systeme
        valide, msg, payload = valider_licence_systeme()
        if valide and payload and payload.get('pharmacie_nom'):
            return payload.get('pharmacie_nom')
        return obj.pharmacy_name


class ConfigurationOptionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = ConfigurationOption
        fields = '__all__'


class ObjectifCommercialSerializer(serializers.ModelSerializer):
    """Serializer pour les objectifs commerciaux"""
    periode_display = serializers.CharField(source='get_periode_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ObjectifCommercial
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']
        validators = []

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
