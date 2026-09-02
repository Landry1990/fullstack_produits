from rest_framework import serializers
from ..models import Challenge


class ChallengeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    participants_count = serializers.IntegerField(source='participants.count', read_only=True)
    produits_count = serializers.IntegerField(source='produits.count', read_only=True)
    is_ongoing = serializers.BooleanField(read_only=True)

    class Meta:
        model = Challenge
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and not validated_data.get('created_by'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)
