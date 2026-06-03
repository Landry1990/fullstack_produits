# -*- coding: utf-8 -*-
"""
Feedback API views
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from django.contrib.auth.models import User

from ..models import Feedback
from ..services.email_service import email_service


class FeedbackSerializer(serializers.ModelSerializer):
    """Serializer for Feedback model."""
    username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    
    class Meta:
        model = Feedback
        fields = [
            'id', 'user', 'username', 'category', 'priority', 'status',
            'subject', 'description', 'screenshot', 'page_url', 'browser_info',
            'admin_response', 'responded_at', 'responded_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'admin_response', 'responded_at', 'responded_by']


class FeedbackListView(APIView):
    """API view for creating and listing feedbacks."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List feedbacks for the current user."""
        feedbacks = Feedback.objects.filter(user=request.user).order_by('-created_at')
        serializer = FeedbackSerializer(feedbacks, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Create a new feedback."""
        serializer = FeedbackSerializer(data=request.data)
        if serializer.is_valid():
            feedback = serializer.save(user=request.user)
            # Send email notification
            email_sent = email_service.send_feedback_notification(feedback)
            return Response({
                **dict(serializer.data),
                'email_sent': email_sent,
            }, status=201)
        return Response(serializer.errors, status=400)


class FeedbackDetailView(APIView):
    """API view for retrieving a specific feedback."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Retrieve a specific feedback."""
        try:
            feedback = Feedback.objects.get(pk=pk, user=request.user)
            serializer = FeedbackSerializer(feedback)
            return Response(serializer.data)
        except Feedback.DoesNotExist:
            return Response({'error': 'Feedback not found'}, status=404)
