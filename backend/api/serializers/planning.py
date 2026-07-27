"""
Serializers pour le planning des opérateurs.
"""
from django.contrib.auth.models import User
from rest_framework import serializers

from ..models.planning import LeaveRequest, ShiftAssignment, ShiftConfig, ShiftSchedule
from .mixins import UppercaseSerializerMixin


class ShiftConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftConfig
        fields = '__all__'


class SimpleUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name']

    def get_full_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.username


class ShiftAssignmentSerializer(serializers.ModelSerializer):
    user_detail = SimpleUserSerializer(source='user', read_only=True)

    class Meta:
        model = ShiftAssignment
        fields = ['id', 'schedule', 'user', 'user_detail', 'date', 'shift_type', 'notes']
        read_only_fields = ['id']


class ShiftScheduleSerializer(serializers.ModelSerializer):
    assignments = ShiftAssignmentSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ShiftSchedule
        fields = ['id', 'month', 'is_published', 'created_by', 'created_by_name',
                  'created_at', 'updated_at', 'assignments']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_month(self, value):
        """Force le mois au 1er jour du mois pour éviter les doublons/ incohérences."""
        return value.replace(day=1)


class LeaveRequestSerializer(UppercaseSerializerMixin, serializers.ModelSerializer):
    user_detail = SimpleUserSerializer(source='user', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    days_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ['id', 'user', 'user_detail', 'start_date', 'end_date',
                  'leave_type', 'status', 'notes', 'approved_by', 'approved_by_name',
                  'approved_at', 'created_at', 'updated_at', 'days_count']
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']
