from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.settings import api_settings
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend

from ..models import UserProfile, Client
from ..serializers import UserSerializer, UserProfileSerializer

class CustomAuthToken(ObtainAuthToken):
    """
    Custom auth token view that returns user details along with the token.
    """
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        
        # Determine user role
        role = 'vendeur'
        if user.is_superuser:
            role = 'admin'
        elif hasattr(user, 'profile'):
            role = user.profile.role
            
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'email': user.email,
            'role': role,
            'permissions': {
                'can_delete_invoice': user.is_superuser,
                'can_view_stats': user.is_superuser or (hasattr(user, 'profile') and user.profile.role == 'manager'),
            }
        })

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for users.
    """
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return User.objects.all().order_by('username')
        return User.objects.filter(id=user.id)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        data = serializer.data
        
        # Add profile info if exists
        if hasattr(request.user, 'profile'):
            profile_serializer = UserProfileSerializer(request.user.profile)
            data['profile'] = profile_serializer.data
            
        return Response(data)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_photo(self, request, pk=None):
        user = self.get_object()
        if 'photo' not in request.data:
             return Response({'detail': 'Aucune photo fournie.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Ensure profile exists
        profile, created = UserProfile.objects.get_or_create(user=user)
        
        profile.photo = request.data['photo']
        profile.save()
        
        return Response({'status': 'Photo mise à jour', 'photo_url': profile.photo.url})
