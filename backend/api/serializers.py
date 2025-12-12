from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Sum
from decimal import Decimal
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, 
    CommandeProduit, Facture, FactureProduit, Caisse, Profile,
    StockLot, FactureProduitAllocation, AyantDroit, ClotureCaisse
)

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['allowed_menus', 'can_do_returns', 'can_sell_negative_stock']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'password', 'profile']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        
        # Profile is created by signal, update it
        if profile_data:
            profile = user.profile
            profile.allowed_menus = profile_data.get('allowed_menus', [])
            profile.can_do_returns = profile_data.get('can_do_returns', False)
            profile.can_sell_negative_stock = profile_data.get('can_sell_negative_stock', False)
            profile.save()
            
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password', None)
        
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        
        if password:
            instance.set_password(password)
            
        instance.save()

        if profile_data:
            profile = instance.profile
            profile.allowed_menus = profile_data.get('allowed_menus', profile.allowed_menus)
            profile.can_do_returns = profile_data.get('can_do_returns', profile.can_do_returns)
            profile.can_sell_negative_stock = profile_data.get('can_sell_negative_stock', profile.can_sell_negative_stock)
            profile.save()
            
        return instance

class RayonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rayon
        fields = '__all__'

class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = '__all__'

from django.db import transaction

# ... (imports)

class AyantDroitSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all(), required=False)
    
    class Meta:
        model = AyantDroit
        fields = ['id', 'client', 'matricule', 'nom', 'societe', 'date_creation']


class ClientSerializer(serializers.ModelSerializer):
    ayants_droit = AyantDroitSerializer(many=True, required=False)
    current_debt = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Client
        fields = '__all__'

    @transaction.atomic
    def create(self, validated_data):
        ayants_droit_data = validated_data.pop('ayants_droit', [])
        client = Client.objects.create(**validated_data)
        for ad_data in ayants_droit_data:
            AyantDroit.objects.create(client=client, **ad_data)
        return client

    @transaction.atomic
    def update(self, instance, validated_data):
        ayants_droit_data = validated_data.pop('ayants_droit', None)
        
        # Mise à jour des champs du client
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Mise à jour des ayants droit si fournis
        if ayants_droit_data is not None:
            # IDs des ayants droit reçus (ceux qui ont un ID)
            incoming_ids = [item['id'] for item in ayants_droit_data if 'id' in item]
            
            # Supprimer ceux qui ne sont pas dans la liste reçue
            instance.ayants_droit.exclude(id__in=incoming_ids).delete()
            
            # Mettre à jour ou créer
            for ad_data in ayants_droit_data:
                ad_id = ad_data.get('id')
                if ad_id:
                    ad = AyantDroit.objects.get(id=ad_id, client=instance)
                    ad.matricule = ad_data.get('matricule', ad.matricule)
                    ad.nom = ad_data.get('nom', ad.nom)
                    ad.societe = ad_data.get('societe', ad.societe)
                    ad.save()
                else:
                    AyantDroit.objects.create(client=instance, **ad_data)
                    
        return instance

class ProduitSerializer(serializers.ModelSerializer):
    rayon_nom = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)

    class Meta:
        model = Produit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'taux_marge', 'pourcentage_marge']

class CommandeProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    commande_date = serializers.DateTimeField(source='commande.date', read_only=True)
    fournisseur_name = serializers.CharField(source='commande.fournisseur.name', read_only=True)
    
    class Meta:
        model = CommandeProduit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class CommandeSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    produits = CommandeProduitSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Commande
        fields = '__all__'
        read_only_fields = ['date', 'status']

class FactureProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)

    class Meta:
        model = FactureProduit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class CaisseSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    mode_paiement_display = serializers.CharField(source='get_mode_paiement_display', read_only=True)
    
    class Meta:
        model = Caisse
        fields = '__all__'
        read_only_fields = ['date_paiement']
    
    def get_user_details(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'full_name': full_name or obj.user.username
            }
        return None
    
    def get_client_name(self, obj):
        if obj.facture.client:
            return obj.facture.client.name
        elif obj.facture.client_name_override:
            return obj.facture.client_name_override
        return "Client de passage"

class FactureSerializer(serializers.ModelSerializer):
    client_nom = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    produits = FactureProduitSerializer(many=True, read_only=True)
    ayant_droit_details = AyantDroitSerializer(source='ayant_droit', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    def get_client_nom(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"
    
    def get_client_name(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"

    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'client_nom', 'client_name_override', 
            'ayant_droit', 'ayant_droit_details',
            'date', 'status', 'status_display', 'produits', 
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc', 'notes'
        ]

class StockLotSerializer(serializers.ModelSerializer):
    """Serializer pour les lots de stock avec traçabilité fournisseur"""
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    
    class Meta:
        model = StockLot
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class FactureProduitAllocationSerializer(serializers.ModelSerializer):
    """Serializer pour les allocations de vente (traçabilité FIFO)"""
    fournisseur_nom = serializers.CharField(source='stock_lot.fournisseur.name', read_only=True)
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True)
    margin = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    revenue = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = FactureProduitAllocation
        fields = '__all__'
        read_only_fields = ['created_at']

class ClotureCaisseSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = ClotureCaisse
        fields = '__all__'
        read_only_fields = ['date']

class CreanceSerializer(serializers.ModelSerializer):
    """Serializer pour les créances (ventes en compte)"""
    client_name = serializers.SerializerMethodField()
    ayant_droit_details = AyantDroitSerializer(source='ayant_droit', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    montant_paye = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()
    paiements = CaisseSerializer(many=True, read_only=True)
    
    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'client_name_override',
            'ayant_droit', 'ayant_droit_details', 'date', 'status', 'status_display',
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc',
            'montant_paye', 'reste_a_payer', 'paiements', 'notes'
        ]
    
    def get_client_name(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"
    
    def get_montant_paye(self, obj):
        """Calcule le montant total payé (tous modes sauf en_compte)"""
        total = obj.paiements.filter(
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(
            total=Sum('montant')
        )['total']
        return total or Decimal('0.00')
    
    def get_reste_a_payer(self, obj):
        """Calcule le reste à payer"""
        montant_paye = self.get_montant_paye(obj)
        return obj.total_ttc - montant_paye