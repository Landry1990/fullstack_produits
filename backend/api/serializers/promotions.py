# -*- coding: utf-8 -*-
"""
Serializers pour les promotions et objectifs commerciaux.
"""
from rest_framework import serializers
from ..models import PromotionPackItem, ConfigurationObjectifs, Promotion


class PromotionPackItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = PromotionPackItem
        fields = ['product', 'product_name', 'quantity']


class ConfigurationObjectifsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationObjectifs
        fields = '__all__'

    def create(self, validated_data):
        return ConfigurationObjectifs.objects.get_or_create(pk=1)[0]

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class PromotionSerializer(serializers.ModelSerializer):
    """Serializer pour la gestion des promotions"""
    # OPTIMISATION: Utilise les annotations SQL au lieu de requêtes N+1 (.count)
    products_count = serializers.IntegerField(read_only=True)  # From annotation
    rayons_count = serializers.IntegerField(read_only=True)      # From annotation
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    pack_items = PromotionPackItemSerializer(many=True, required=False)

    class Meta:
        model = Promotion
        fields = '__all__'
        read_only_fields = ['is_active', 'created_at', 'updated_at']

    def create(self, validated_data):
        pack_items_data = validated_data.pop('pack_items', [])
        products = validated_data.pop('products', [])
        rayons = validated_data.pop('rayons', [])

        promotion = Promotion.objects.create(**validated_data)

        if products:
            promotion.products.set(products)
        if rayons:
            promotion.rayons.set(rayons)

        for item in pack_items_data:
            PromotionPackItem.objects.create(promotion=promotion, **item)

        return promotion

    def update(self, instance, validated_data):
        pack_items_data = validated_data.pop('pack_items', None)
        products = validated_data.pop('products', None)
        rayons = validated_data.pop('rayons', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if products is not None:
            instance.products.set(products)
        if rayons is not None:
            instance.rayons.set(rayons)

        if pack_items_data is not None:
            instance.pack_items.all().delete()
            for item in pack_items_data:
                PromotionPackItem.objects.create(promotion=instance, **item)

        return instance
