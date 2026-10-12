from rest_framework import serializers

from .models import Forme


class FormeSerializer(serializers.ModelSerializer):
    produits_count = serializers.SerializerMethodField()

    def get_produits_count(self, obj):
        val = getattr(obj, 'produits_count', None)
        return val if val is not None else obj.produits.count()

    class Meta:
        model = Forme
        fields = ['id', 'nom', 'description', 'produits_count']
