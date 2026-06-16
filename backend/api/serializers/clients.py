# -*- coding: utf-8 -*-
"""
Serializers pour les clients, ayants droit et dépôts.
"""
from rest_framework import serializers
from ..models import DepotClient, AyantDroit, Client


class DepotClientSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    produit_name = serializers.CharField(source='produit.name', read_only=True)
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)

    class Meta:
        model = DepotClient
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class AyantDroitSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = AyantDroit
        fields = '__all__'


class ClientSerializer(serializers.ModelSerializer):
    ayants_droit = AyantDroitSerializer(many=True, read_only=True)
    depot_count = serializers.SerializerMethodField()
    solde_depot_display = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'code', 'name', 'phone', 'email', 'address',
            'taux_couverture', 'assure_principal', 'ayants_droit',
            'points_fidelite', 'date_naissance', 'genre', 'notes',
            'depot_count', 'solde_depot', 'solde_depot_display',
            'created_at', 'updated_at', 'is_deposit_enabled'
        ]

    def get_depot_count(self, obj):
        return obj.depots.filter(quantite_restante__gt=0).count()

    def get_solde_depot_display(self, obj):
        return f"{obj.solde_depot:.2f} F"
