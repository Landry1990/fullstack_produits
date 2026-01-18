"""
Serializers optimisés pour différents contextes (list vs detail).

Ce fichier contient des versions allégées des serializers pour améliorer
les performances lors des listes paginées.
"""
from rest_framework import serializers
from .models import Produit, Facture, Client, Commande, StockLot
from .serializers import (
    ProduitSerializer, FactureSerializer, ClientSerializer,
    CommandeSerializer, StockLotSerializer
)


class ProduitListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des produits.
    Contient uniquement les champs essentiels pour l'affichage en liste.
    """
    rayon_name = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    
    class Meta:
        model = Produit
        fields = [
            'id', 'name', 'cip1', 'cip2', 'cip3',
            'stock', 'stock_minimum', 'pmp', 'selling_price',
            'rayon_name', 'fournisseur_name', 'rotation_moyenne',
            'use_lot_management',
            'tva', 'cost_price', 'taux_marge',
            'dernier_achat', 'dernier_vente'
        ]


class ProduitDetailSerializer(ProduitSerializer):
    """
    Serializer complet pour les détails d'un produit.
    Hérite du serializer de base avec tous les champs.
    """
    pass


class ClientListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des clients.
    """
    current_debt = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Client
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'client_type', 'current_debt', 'is_loyalty_member',
            'points_fidelite', 'taux_couverture', 'plafond',
            'remise_automatique'
        ]


class ClientDetailSerializer(ClientSerializer):
    """
    Serializer complet pour les détails d'un client.
    Inclut les ayants droit et toutes les informations.
    """
    pass


class FactureListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des factures.
    Évite de charger tous les produits et paiements.
    """
    client_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name',
            'date', 'status', 'status_display',
            'total_ht', 'total_ttc', 'remise'
        ]
    
    def get_client_name(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"


class FactureDetailSerializer(FactureSerializer):
    """
    Serializer complet pour les détails d'une facture.
    Inclut tous les produits et paiements.
    """
    pass


class CommandeListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des commandes.
    Inclut les champs pour les commandes directes (type, taux_change, frais_coefficient).
    """
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = Commande
        fields = [
            'id', 'numero_facture', 'fournisseur', 'fournisseur_nom',
            'date', 'date_cloture', 'status', 'status_display', 'total',
            'type', 'type_display', 'taux_change', 'frais_coefficient'
        ]


class CommandeDetailSerializer(CommandeSerializer):
    """
    Serializer complet pour les détails d'une commande.
    Inclut tous les produits.
    """
    pass


class StockLotListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des lots de stock.
    """
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    
    class Meta:
        model = StockLot
        fields = [
            'id', 'produit', 'produit_nom', 'fournisseur_nom',
            'lot', 'date_expiration', 'quantity_remaining',
            'price_cost', 'selling_price', 'date_reception'
        ]


class StockLotDetailSerializer(StockLotSerializer):
    """
    Serializer complet pour les détails d'un lot.
    """
    pass


# Mapping pour faciliter l'utilisation dans les ViewSets
SERIALIZER_MAPPING = {
    'Produit': {
        'list': ProduitListSerializer,
        'detail': ProduitDetailSerializer,
    },
    'Client': {
        'list': ClientListSerializer,
        'detail': ClientDetailSerializer,
    },
    'Facture': {
        'list': FactureListSerializer,
        'detail': FactureDetailSerializer,
    },
    'Commande': {
        'list': CommandeListSerializer,
        'detail': CommandeDetailSerializer,
    },
    'StockLot': {
        'list': StockLotListSerializer,
        'detail': StockLotDetailSerializer,
    },
}


def get_serializer_class(model_name, action='list'):
    """
    Fonction utilitaire pour obtenir le bon serializer selon le contexte.
    
    Args:
        model_name: Nom du modèle ('Produit', 'Client', etc.)
        action: Action DRF ('list', 'retrieve', 'create', 'update', 'destroy')
    
    Returns:
        La classe de serializer appropriée
    
    Usage dans un ViewSet:
        def get_serializer_class(self):
            return get_serializer_class('Produit', self.action)
    """
    mapping = SERIALIZER_MAPPING.get(model_name, {})
    
    # Pour retrieve, utiliser le serializer detail
    if action == 'retrieve':
        return mapping.get('detail', mapping.get('list'))
    
    # Pour list, utiliser le serializer list
    elif action == 'list':
        return mapping.get('list', mapping.get('detail'))
    
    # Pour create/update/destroy, utiliser le serializer detail
    else:
        return mapping.get('detail', mapping.get('list'))
