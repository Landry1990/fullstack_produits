# -*- coding: utf-8 -*-
"""
Serializers pour l'inventaire, les avoirs, et les mouvements de stock.
"""
from rest_framework import serializers
from ..models import (
    LigneInventaire, Inventaire, LigneAvoir, Avoir,
    MouvementStock, StockAdjustment,
    RelationTransformation, HistoriqueTransformation,
)


class LigneInventaireSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    produit_rayon = serializers.CharField(source='produit.rayon.name', read_only=True)
    produit_description = serializers.CharField(source='produit.description', read_only=True)
    produit_cost_price = serializers.DecimalField(source='produit.cost_price', max_digits=10, decimal_places=2, read_only=True)
    produit_pmp = serializers.DecimalField(source='produit.pmp', max_digits=10, decimal_places=2, read_only=True)

    # Champs pour la gestion des lots
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    lot_expiration = serializers.DateField(source='stock_lot.date_expiration', read_only=True, allow_null=True)
    lot_quantity_remaining = serializers.IntegerField(source='stock_lot.quantity_remaining', read_only=True, allow_null=True)

    class Meta:
        model = LigneInventaire
        fields = '__all__'

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom


class InventaireSerializer(serializers.ModelSerializer):
    lignes = LigneInventaireSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    total_valeur_theorique = serializers.SerializerMethodField()
    total_valeur_physique = serializers.SerializerMethodField()
    total_ecart_valeur = serializers.SerializerMethodField()

    class Meta:
        model = Inventaire
        fields = '__all__'
        read_only_fields = ['is_active', 'created_at', 'updated_at', 'reference']

    def get_total_valeur_theorique(self, obj):
        return sum(
            (ligne.stock_theorique * (ligne.pmp_snapshot or ligne.produit.cost_price or 0))
            for ligne in obj.lignes.all()
        )

    def get_total_valeur_physique(self, obj):
        return sum(
            (ligne.quantite_physique * (ligne.pmp_snapshot or ligne.produit.cost_price or 0))
            for ligne in obj.lignes.all()
        )

    def get_total_ecart_valeur(self, obj):
        return sum(
            (ligne.ecart * (ligne.pmp_snapshot or ligne.produit.cost_price or 0))
            for ligne in obj.lignes.all()
        )


class LigneAvoirSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    lot_expiration = serializers.DateField(source='stock_lot.date_expiration', read_only=True, allow_null=True)
    lot_quantity_remaining = serializers.IntegerField(source='stock_lot.quantity_remaining', read_only=True, allow_null=True)

    class Meta:
        model = LigneAvoir
        fields = '__all__'
        read_only_fields = ['total']

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom


class AvoirSerializer(serializers.ModelSerializer):
    produits = LigneAvoirSerializer(many=True, read_only=True)
    fournisseur_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    total_ht = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_avoir_display = serializers.CharField(source='get_type_avoir_display', read_only=True)

    class Meta:
        model = Avoir
        fields = '__all__'
        read_only_fields = ['numero', 'date', 'created_at', 'updated_at', 'total_ht']

    def get_fournisseur_name(self, obj):
        return obj.fournisseur.name if obj.fournisseur else obj.fournisseur_nom

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return obj.validated_by.get_full_name() or obj.validated_by.username
        return ''


class MouvementStockSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    produit_nom = serializers.SerializerMethodField()

    class Meta:
        model = MouvementStock
        fields = '__all__'

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom


class StockAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer pour les ajustements de stock avec traçabilité"""
    user_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    produit_name = serializers.SerializerMethodField()
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    reason_type_display = serializers.SerializerMethodField()
    lot_number = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    valorisation = serializers.SerializerMethodField()

    class Meta:
        model = StockAdjustment
        fields = [
            'id', 'produit', 'produit_name', 'produit_cip',
            'stock_lot', 'lot_number',
            'user', 'user_name', 'username',
            'quantity_before', 'quantity_after', 'quantity_change',
            'reserve_before', 'reserve_after', 'reserve_change',
            'valorisation',
            'reason_type', 'reason_type_display', 'reason_detail',
            'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'quantity_change']

    def get_reason_type_display(self, obj):
        # Essayer d'abord les choix standards du modèle
        standard_label = dict(obj.ReasonType.choices).get(obj.reason_type)
        if standard_label:
            return standard_label

        # Sinon chercher dans les options de configuration
        from ..models import ConfigurationOption
        config_opt = ConfigurationOption.objects.filter(
            type=ConfigurationOption.Type.STOCK_ADJUSTMENT_REASON,
            code=obj.reason_type
        ).first()

        return config_opt.label if config_opt else obj.reason_type

    def get_valorisation(self, obj):
        if obj.stock_lot:
            val = abs(obj.quantity_change) * (obj.stock_lot.price_cost or 0)
            return float(val)
        return 0

    def get_produit_name(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username
        return ''


class RelationTransformationSerializer(serializers.ModelSerializer):
    produit_source_nom = serializers.CharField(source='produit_source.name', read_only=True)
    produit_destination_nom = serializers.CharField(source='produit_destination.name', read_only=True)

    class Meta:
        model = RelationTransformation
        fields = '__all__'


class HistoriqueTransformationSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    produit_source_nom = serializers.SerializerMethodField()
    produit_destination_nom = serializers.SerializerMethodField()

    class Meta:
        model = HistoriqueTransformation
        fields = '__all__'

    def get_produit_source_nom(self, obj):
        return obj.produit_source.name if obj.produit_source else obj.produit_source_nom

    def get_produit_destination_nom(self, obj):
        return obj.produit_destination.name if obj.produit_destination else obj.produit_destination_nom
