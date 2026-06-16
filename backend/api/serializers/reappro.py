# -*- coding: utf-8 -*-
"""
Serializers pour le réapprovisionnement.
"""
from rest_framework import serializers
from ..models import StockAdjustment, ReapproSession


class ReapproAdjustmentSerializer(serializers.ModelSerializer):
    produit_name = serializers.CharField(source='produit.name', read_only=True)
    lot_num = serializers.CharField(source='stock_lot.lot', read_only=True)
    expiry = serializers.DateField(source='stock_lot.date_expiration', read_only=True)

    class Meta:
        model = StockAdjustment
        fields = ['id', 'produit', 'produit_name', 'lot_num', 'expiry', 'quantity_change']


class ReapproSessionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    adjustments = ReapproAdjustmentSerializer(many=True, read_only=True)

    class Meta:
        model = ReapproSession
        fields = ['id', 'user', 'user_name', 'total_products', 'total_units', 'created_at', 'notes', 'adjustments']
