# -*- coding: utf-8 -*-
"""
Serializers pour les promis, ordonnanciers et coupons.
"""
from rest_framework import serializers
from ..models import Promis, LigneOrdonnancier, Ordonnancier, CouponMonnaie


class PromisSerializer(serializers.ModelSerializer):
    client_display = serializers.CharField(read_only=True)
    client_phone_display = serializers.CharField(read_only=True)
    produit_name = serializers.SerializerMethodField()
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Promis
        fields = [
            'id', 'facture', 'facture_numero', 'client', 'client_name', 'client_phone',
            'client_display', 'client_phone_display', 'produit', 'produit_name', 'produit_cip',
            'quantite', 'status', 'status_display', 'date_promis', 'date_livraison',
            'notes', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['date_promis', 'date_livraison', 'created_by']

    def get_produit_name(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom


class LigneOrdonnancierSerializer(serializers.ModelSerializer):
    """Serializer pour une ligne de l'ordonnancier (un médicament)"""
    produit_name = serializers.CharField(source='produit.name', read_only=True, allow_null=True)
    ordonnancier = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = LigneOrdonnancier
        fields = ['id', 'ordonnancier', 'produit', 'produit_name', 'produit_nom',
                  'quantite', 'surveillance_category']


class OrdonnancierSerializer(serializers.ModelSerializer):
    """Serializer pour l'ordonnancier (registre des ordonnances)"""
    lignes = LigneOrdonnancierSerializer(many=True, read_only=True)
    enregistre_par_nom = serializers.SerializerMethodField()
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True, allow_null=True)

    class Meta:
        model = Ordonnancier
        fields = ['numero_ordre', 'date_delivrance', 'patient_nom', 'prescripteur_nom',
                  'facture', 'facture_numero', 'lignes', 'enregistre_par',
                  'enregistre_par_nom', 'image_ordonnance', 'created_at']
        read_only_fields = ['numero_ordre', 'created_at']

    def get_enregistre_par_nom(self, obj):
        if obj.enregistre_par:
            full_name = f"{obj.enregistre_par.first_name} {obj.enregistre_par.last_name}".strip()
            return full_name or obj.enregistre_par.username
        return ''


class OrdonnancierCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création d'une entrée d'ordonnancier"""
    lignes = LigneOrdonnancierSerializer(many=True, required=False)

    class Meta:
        model = Ordonnancier
        fields = ['patient_nom', 'prescripteur_nom', 'facture', 'lignes', 'image_ordonnance']

    def validate(self, data):
        return data

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes', [])
        ordonnancier = Ordonnancier.objects.create(**validated_data)

        for ligne_data in lignes_data:
            LigneOrdonnancier.objects.create(ordonnancier=ordonnancier, **ligne_data)

        return ordonnancier


class CouponMonnaieSerializer(serializers.ModelSerializer):
    """Serializer pour les coupons de monnaie (bons de reste)."""
    cree_par_nom = serializers.SerializerMethodField()
    utilise_par_nom = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CouponMonnaie
        fields = [
            'id', 'numero', 'montant', 'status', 'status_display',
            'date_creation', 'date_utilisation',
            'cree_par', 'cree_par_nom', 'utilise_par', 'utilise_par_nom',
            'facture_origine', 'facture_utilisation', 'notes'
        ]
        read_only_fields = ['id', 'numero', 'date_creation', 'date_utilisation']

    def get_cree_par_nom(self, obj):
        if obj.cree_par:
            full_name = f"{obj.cree_par.first_name} {obj.cree_par.last_name}".strip()
            return full_name or obj.cree_par.username
        return ''

    def get_utilise_par_nom(self, obj):
        if obj.utilise_par:
            full_name = f"{obj.utilise_par.first_name} {obj.utilise_par.last_name}".strip()
            return full_name or obj.utilise_par.username
        return ''
