from rest_framework import serializers

from ..models import LoyaltyHistory, LoyaltySetting


class LoyaltyHistorySerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    type_display = serializers.CharField(source='get_type_transaction_display', read_only=True)

    class Meta:
        model = LoyaltyHistory
        fields = '__all__'
        read_only_fields = ['client', 'facture', 'points', 'solde_apres', 'montant', 'created_by', 'created_at']


class LoyaltySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySetting
        fields = '__all__'
