from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, 
    CommandeProduit, Facture, FactureProduit, Caisse, Profile
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

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'

class ProduitSerializer(serializers.ModelSerializer):
    rayon_nom = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)

    class Meta:
        model = Produit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class CommandeProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    
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
    class Meta:
        model = Caisse
        fields = '__all__'
        read_only_fields = ['date_paiement']

class FactureSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.name', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    produits = FactureProduitSerializer(many=True, read_only=True)
    paiements = CaisseSerializer(many=True, read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Facture
        fields = '__all__'
        read_only_fields = ['date', 'status', 'numero_facture']