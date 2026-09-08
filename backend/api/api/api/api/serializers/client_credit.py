from django.db import transaction
from rest_framework import serializers

from ..models import AvoirClient, LigneAvoirClient


class LigneAvoirClientSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)

    class Meta:
        model = LigneAvoirClient
        fields = '__all__'
        read_only_fields = ['avoir_client']


class AvoirClientSerializer(serializers.ModelSerializer):
    lignes = LigneAvoirClientSerializer(many=True)
    created_by_name = serializers.SerializerMethodField()
    client_name = serializers.CharField(source='client.name', read_only=True)
    facture_numero = serializers.CharField(source='facture_origine.numero_facture', read_only=True)

    class Meta:
        model = AvoirClient
        fields = '__all__'
        read_only_fields = ['numero', 'statut', 'created_by']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate_lignes(self, lignes):
        if not lignes:
            raise serializers.ValidationError("L'avoir doit contenir au moins une ligne.")
        return lignes

    @transaction.atomic
    def create(self, validated_data):
        lignes = validated_data.pop('lignes')
        request = self.context.get('request')
        validated_data['created_by'] = request.user if request else None
        avoir = AvoirClient.objects.create(**validated_data)
        LigneAvoirClient.objects.bulk_create([
            LigneAvoirClient(avoir_client=avoir, **ligne) for ligne in lignes
        ])
        return avoir

    @transaction.atomic
    def update(self, instance, validated_data):
        lignes = validated_data.pop('lignes', None)
        if instance.statut != AvoirClient.Statut.BROUILLON:
            raise serializers.ValidationError("Seul un avoir brouillon peut être modifié.")
        instance = super().update(instance, validated_data)
        if lignes is not None:
            instance.lignes.all().delete()
            LigneAvoirClient.objects.bulk_create([
                LigneAvoirClient(avoir_client=instance, **ligne) for ligne in lignes
            ])
        return instance
