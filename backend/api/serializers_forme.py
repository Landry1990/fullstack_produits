from rest_framework import serializers
from .models import Forme

class FormeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Forme
        fields = ['id', 'nom', 'description']
