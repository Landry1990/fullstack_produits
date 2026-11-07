"""
Serializers pour les produits, stock et catalog.
"""
from django.db.models import Q
from rest_framework import serializers

from ..models import (
    DrugInteraction,
    FamilleRisque,
    Forme,
    Groupe,
    MedicamentReference,
    Produit,
    Rayon,
    StockLot,
    Substance,
)
from .mixins import UppercaseSerializerMixin


class SubstanceSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    produits_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Substance
        fields = '__all__'


class DrugInteractionSerializer(serializers.ModelSerializer):
    substance_a_nom = serializers.CharField(source='substance_a.nom', read_only=True)
    substance_b_nom = serializers.CharField(source='substance_b.nom', read_only=True)
    gravity_display = serializers.CharField(source='get_gravity_display', read_only=True)

    class Meta:
        model = DrugInteraction
        fields = '__all__'


class MedicamentReferenceSerializer(serializers.ModelSerializer):
    substance_nom = serializers.CharField(source='substance.nom', read_only=True)
    class Meta:
        model = MedicamentReference
        fields = '__all__'


class RayonSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    produits_count = serializers.SerializerMethodField()
    produits_count_total = serializers.SerializerMethodField()

    def get_produits_count(self, obj):
        val = getattr(obj, 'produits_count', None)
        return val if val is not None else obj.produit_set.count()

    def get_produits_count_total(self, obj):
        """Produits directs + produits des sous-rayons (hiérarchie à 2 niveaux)."""
        val = getattr(obj, 'produits_count_total', None)
        if val is not None:
            return val
        return Produit.objects.filter(Q(rayon=obj) | Q(rayon__parent=obj)).count()

    def validate_parent(self, parent):
        """Hiérarchie strictement limitée à 2 niveaux (rayon → sous-rayon)."""
        if parent is None:
            return parent
        if parent.parent_id is not None:
            raise serializers.ValidationError(
                "Un sous-rayon ne peut pas devenir parent (2 niveaux maximum)."
            )
        instance = self.instance
        if instance is not None:
            if parent.pk == instance.pk:
                raise serializers.ValidationError(
                    "Un rayon ne peut pas être son propre parent."
                )
            if instance.sub_rayons.exists():
                raise serializers.ValidationError(
                    "Impossible : ce rayon a des sous-rayons, il doit rester à la racine."
                )
        return parent

    class Meta:
        model = Rayon
        fields = '__all__'


class FormeSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Forme
        fields = '__all__'


class FamilleRisqueSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = FamilleRisque
        fields = '__all__'


class GroupeSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    produits_count = serializers.SerializerMethodField()

    def get_produits_count(self, obj):
        val = getattr(obj, 'produits_count', None)
        return val if val is not None else obj.produits.count()

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


class StockLotUpdateSerializer(StockLotSerializer):
    """Mise à jour d'un lot : numéro, péremption et prix (achat/vente) modifiables.

    Les quantités restent figées — un écart de stock se corrige par ajustement,
    pas en éditant le lot. Les prix sont éditables pour corriger une erreur
    de saisie à la réception (impacte la marge des unités restantes).
    """

    class Meta(StockLotSerializer.Meta):
        read_only_fields = [
            'produit', 'quantity_initial', 'quantity_paid', 'quantity_free',
            'quantity_remaining', 'quantity_reserved',
            'fournisseur', 'commande_produit', 'date_reception', 'is_divers'
        ]


class ProduitSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    """Serializer optimisé pour Produit avec gestion N+1 des lots et promotions."""
    rayon_name = serializers.CharField(source='rayon.name', read_only=True)
    rayon_path = serializers.SerializerMethodField()
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    stock_lots = serializers.SerializerMethodField()
    total_stock = serializers.IntegerField(read_only=True)
    total_stock_reserve = serializers.IntegerField(read_only=True)
    # OPTIMISATION: Utilise les annotations SQL au lieu de requêtes N+1 (.count)
    lots_count = serializers.IntegerField(read_only=True)  # From annotation
    has_active_lots = serializers.BooleanField(read_only=True)  # From annotation
    forme_nom = serializers.CharField(source='forme.nom', read_only=True)
    groupe_nom = serializers.CharField(source='groupe.nom', read_only=True)
    is_service = serializers.BooleanField(read_only=True)

    active_promotion = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = '__all__'

    def get_rayon_path(self, obj):
        """Chemin complet du rayon : « PARENT › SOUS-RAYON » ou « RAYON »."""
        if not obj.rayon:
            return None
        if obj.rayon.parent_id and obj.rayon.parent:
            return f"{obj.rayon.parent.name} › {obj.rayon.name}"
        return obj.rayon.name

    def get_stock_lots(self, obj):
        # Limiter à 5 lots les plus proches de la péremption pour la vue liste
        # Le frontend peut charger tous les lots via un endpoint dédié si besoin.
        # Utilise les lots déjà préchargés quand disponibles (Prefetch to_attr
        # 'active_lots' du ViewSet, ou prefetch 'stock_lots' de bulk_detail) —
        # un .filter() ici ignorerait le cache prefetch → N+1.
        prefetched_active = getattr(obj, 'active_lots', None)
        if prefetched_active is not None:
            lots = prefetched_active[:5]
        elif 'stock_lots' in getattr(obj, '_prefetched_objects_cache', {}):
            # Même sémantique que le .filter() ci-dessous : lots non vides,
            # triés par date d'expiration (NULLS LAST, comme PostgreSQL en ASC).
            lots = sorted(
                (lot for lot in obj.stock_lots.all() if (lot.quantity_remaining or 0) > 0),
                key=lambda lot: (lot.date_expiration is None, lot.date_expiration),
            )[:5]
        else:
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


class ProduitUpdateSerializer(ProduitSerializer):
    """Mise à jour d'un produit : stock et PMP ne sont pas modifiables via PATCH/PUT.
    Le formulaire produit continue d'envoyer `stock` à la création (stock initial)."""

    class Meta(ProduitSerializer.Meta):
        read_only_fields = ['stock', 'stock_reserve', 'pmp']
