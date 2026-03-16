from rest_framework import serializers
from .models import UserDailySession
from django.contrib.auth.models import User

class UserDailySessionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = UserDailySession
        fields = [
            'id', 'user', 'username', 'full_name', 
            'date', 'first_login', 'last_logout', 
            'duration_display', 'workstation'
        ]

    def get_full_name(self, obj):
        if obj.user.first_name or obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}".strip()
        return obj.user.username

    def get_duration_display(self, obj):
        duration = obj.duration
        if duration:
            total_seconds = int(duration.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            if hours > 0:
                return f"{hours}h {minutes}min"
            return f"{minutes} min"
        return None
