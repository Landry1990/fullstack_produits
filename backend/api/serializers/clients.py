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
            'id', 'name', 'phone', 'email', 'address', 'niu', 'registre_commerce',
            'client_type', 'plafond', 'taux_couverture',
            'remise_automatique', 'majoration_pro_pourcentage',
            'points_fidelite', 'pending_discount', 'is_loyalty_member',
            'solde_depot', 'is_deposit_enabled',
            'message_alerte', 'solde_factures',
            'created_at',
            'ayants_droit', 'depot_count', 'solde_depot_display'
        ]

    def get_depot_count(self, obj):
        return obj.depots_historique.count()

    def get_solde_depot_display(self, obj):
        return f"{obj.solde_depot:.2f} F"
