# -*- coding: utf-8 -*-
"""
Serializers pour les produits, stock et catalog.
"""
from rest_framework import serializers
from django.db.models import Q
from ..models import (
    Substance, MedicamentReference, Rayon, Forme, FamilleRisque,
    Groupe, Produit, StockLot, Promotion,
)


class SubstanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Substance
        fields = '__all__'


class MedicamentReferenceSerializer(serializers.ModelSerializer):
    substance_nom = serializers.CharField(source='substance.nom', read_only=True)
    class Meta:
        model = MedicamentReference
        fields = '__all__'


class RayonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rayon
        fields = '__all__'


class FormeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Forme
        fields = '__all__'


class FamilleRisqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilleRisque
        fields = '__all__'


class GroupeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Groupe
        fields = '__all__'


class StockLotSerializer(serializers.ModelSerializer):
    produit_name = serializers.CharField(source='produit.name', read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True, default='N/A')
    expire_date_display = serializers.DateField(source='date_expiration', read_only=True)

    class Meta:
        model = StockLot
        fields = [
            'id', 'produit', 'produit_name', 'lot', 'date_expiration', 'expire_date_display',
            'quantity_initial', 'quantity_paid', 'quantity_free', 'quantity_remaining', 'quantity_reserved',
            'price_cost', 'selling_price', 'fournisseur', 'fournisseur_name',
            'commande_produit', 'date_reception', 'is_divers'
        ]
        read_only_fields = ['date_reception']


class ProduitSerializer(serializers.ModelSerializer):
    """Serializer optimisé pour Produit avec gestion N+1 des lots et promotions."""
    rayon_name = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    stock_lots = serializers.SerializerMethodField()
    total_stock = serializers.IntegerField(read_only=True)
    total_stock_reserve = serializers.IntegerField(read_only=True)
    # OPTIMISATION: Utilise les annotations SQL au lieu de requêtes N+1 (.count)
    lots_count = serializers.IntegerField(read_only=True)  # From annotation
    has_active_lots = serializers.BooleanField(read_only=True)  # From annotation
    forme_nom = serializers.CharField(source='forme.nom', read_only=True)
    groupe_nom = serializers.CharField(source='groupe.nom', read_only=True)

    active_promotion = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = '__all__'

    def get_stock_lots(self, obj):
        # Limiter à 5 lots les plus récents pour la vue liste
        # Le frontend peut charger tous les lots via un endpoint dédié si besoin
        lots = obj.stock_lots.filter(quantity_remaining__gt=0).order_by('date_expiration')[:5]
        return StockLotSerializer(lots, many=True).data

    def get_active_promotion(self, obj):
        """
        Retourne la meilleure promotion active.
        OPTIMISATION: Vérifie d'abord si les promos sont préchargées.
        """
        try:
            # Si les promos sont préchargées via prefetch_related
            if hasattr(obj, '_prefetched_objects_cache') and 'promotions' in obj._prefetched_objects_cache:
                from datetime import date
                today = date.today()
                active_promos = [
                    p for p in obj.promotions.all()
                    if p.is_active and p.start_date <= today and (p.end_date is None or p.end_date >= today)
                ]
                promo = active_promos[0] if active_promos else None
            else:
                # Fallback: requête optimisée
                from ..services import PromotionService
                promo = PromotionService.get_active_promotions().filter(
                    Q(products=obj) | Q(rayons=obj.rayon)
                ).select_related().first()

            if promo:
                return {
                    'id': promo.id,
                    'name': promo.name,
                    'discount_type': promo.discount_type,
                    'value': promo.value,
                    'buy_quantity': promo.buy_quantity,
                    'get_quantity': promo.get_quantity
                }
            return None
        except Exception:
            return None
