"""
Feedback API views
"""
import threading

from rest_framework import serializers
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
    """API view for creating and listing feedbacks. Réservé aux admins."""
    permission_classes = [IsAuthenticated, IsAdminUser]

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
            # Envoi SMTP en thread daemon : ne pas bloquer la réponse si le
            # serveur mail est lent ou non configuré (fréquent chez les clients).
            threading.Thread(
                target=email_service.send_feedback_notification,
                args=(feedback,),
                daemon=True,
            ).start()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class FeedbackDetailView(APIView):
    """API view for retrieving a specific feedback. Réservé aux admins."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, pk):
        """Retrieve a specific feedback."""
        try:
            feedback = Feedback.objects.get(pk=pk, user=request.user)
            serializer = FeedbackSerializer(feedback)
            return Response(serializer.data)
        except Feedback.DoesNotExist:
            return Response({'error': 'Feedback not found'}, status=404)
