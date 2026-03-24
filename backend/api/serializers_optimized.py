"""
Serializers optimisés pour différents contextes (list vs detail).

Ce fichier contient des versions allégées des serializers pour améliorer
les performances lors des listes paginées.
"""
from rest_framework import serializers
from .serializers import (
    ProduitSerializer, FactureSerializer, ClientSerializer,
    CommandeSerializer, StockLotSerializer, InventaireSerializer
)
from .models import Produit, Facture, Client, Commande, StockLot, Inventaire


class ProduitListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des produits.
    Contient uniquement les champs essentiels pour l'affichage en liste.
    """
    rayon_name = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    forme_nom = serializers.CharField(source='forme.nom', read_only=True)
    
    class Meta:
        model = Produit
        fields = [
            'id', 'name', 'cip1', 'cip2', 'cip3',
            'stock', 'stock_minimum', 'pmp', 'selling_price',
            'rayon_name', 'fournisseur_name', 'forme_nom', 'rotation_moyenne',
            'use_lot_management',
            'tva', 'cost_price', 'taux_marge',
            'dernier_achat', 'dernier_vente', 'is_supplier_exclusive',
            'stock_reserve', 'has_reserve_storage', 'capacite_rayon', 'min_rayon'
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
    ayants_droit_count = serializers.IntegerField(source='ayants_droit.count', read_only=True)
    
    class Meta:
        model = Client
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'client_type', 'current_debt', 'solde_depot', 'is_deposit_enabled', 
            'is_loyalty_member', 'points_fidelite', 'taux_couverture', 'plafond',
            'remise_automatique', 'ayants_droit_count'
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
    created_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    montant_regle = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    montant_en_compte = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    ayant_droit_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'created_by_name',
            'validated_by_name', 'ayant_droit_details',
            'date', 'status', 'status_display',
            'total_ht', 'total_ttc', 'remise', 'session_ticket_number',
            'montant_regle', 'montant_en_compte'
        ]

    def get_ayant_droit_details(self, obj):
        if obj.ayant_droit:
            return {
                'nom': obj.ayant_droit.nom,
                'matricule': obj.ayant_droit.matricule
            }
        return None

    session_ticket_number = serializers.IntegerField(source='ticket_session', read_only=True)
    
    def get_client_name(self, obj):
        if obj.client_name_override:
            return obj.client_name_override
        if obj.client:
            return obj.client.name
        return "Client de passage"

    def get_created_by_name(self, obj):
        if obj.created_by:
            full_name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full_name or obj.created_by.username
        return ''

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            full_name = f"{obj.validated_by.first_name} {obj.validated_by.last_name}".strip()
            return full_name or obj.validated_by.username
        return ''


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
    fournisseur_nom = serializers.SerializerMethodField()
    # Use annotated fields for better performance
    total = serializers.DecimalField(source='total_annotated', max_digits=12, decimal_places=2, read_only=True)
    montant_paye = serializers.DecimalField(source='montant_paye_annotated', max_digits=12, decimal_places=2, read_only=True)
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    reste_a_payer = serializers.SerializerMethodField()
    statut_paiement = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Commande
        fields = [
            'id', 'numero_facture', 'fournisseur', 'fournisseur_nom',
            'date', 'date_cloture', 'status', 'status_display', 'total',
            'type', 'type_display', 'taux_change', 'frais_coefficient',
            'montant_paye', 'reste_a_payer', 'statut_paiement', 'closed_by_name',
            'items_count'
        ]

    def get_fournisseur_nom(self, obj):
        if obj.fournisseur:
            return obj.fournisseur.name
        return obj.fournisseur_nom or "N/A"

    def get_closed_by_name(self, obj):
        if obj.closed_by:
            return obj.closed_by.get_full_name() or obj.closed_by.username
        return ''

    def get_reste_a_payer(self, obj):
        # Use annotated values if available
        total = getattr(obj, 'total_annotated', None)
        if total is None:
            total = obj.total
            
        paye = getattr(obj, 'montant_paye_annotated', None)
        if paye is None:
            paye = obj.montant_paye
            
        return max(0, total - paye)

    def get_statut_paiement(self, obj):
        if obj.status != Commande.Status.CLOTUREE:
            return "NON_CONCERNE"
        
        # Use annotated values
        total = getattr(obj, 'total_annotated', None)
        if total is None:
            total = obj.total
            
        paye = getattr(obj, 'montant_paye_annotated', None)
        if paye is None:
            paye = obj.montant_paye
            
        reste = max(0, total - paye)
        
        if reste <= 0:
            return "PAYE"
        if paye > 0:
            return "PARTIEL"
        return "IMPAYE"


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


class InventaireListSerializer(serializers.ModelSerializer):
    """
    Serializer allégé pour la liste des inventaires.
    Les totaux sont calculés via annotations SQL pour éviter N+1.
    """
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    # Ces champs seront annotés dans le QuerySet
    total_valeur_theorique = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True, coerce_to_string=False)
    total_valeur_physique = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True, coerce_to_string=False)
    total_ecart_valeur = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True, coerce_to_string=False)
    
    class Meta:
        model = Inventaire  # Need to import Inventaire
        fields = [
            'id', 'date', 'description', 'status', 'inventory_type', 'created_by_name',
            'total_valeur_theorique', 'total_valeur_physique', 'total_ecart_valeur'
        ]

class InventaireDetailSerializer(InventaireSerializer): # Need to import InventaireSerializer
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
    'Inventaire': {
        'list': InventaireListSerializer,
        'detail': InventaireDetailSerializer,
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
