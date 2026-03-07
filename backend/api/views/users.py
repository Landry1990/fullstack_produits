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

from ..models import Profile as UserProfile, Client, AuditLog, UserDailySession
from ..serializers import UserSerializer, ProfileSerializer as UserProfileSerializer
from ..audit_helpers import log_audit

class CustomAuthToken(ObtainAuthToken):
    """
    Custom auth token view that returns user details along with the token.
    """
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = None
        if username and password:
            user_obj = User.objects.filter(username__iexact=username).first()
            if user_obj:
                if user_obj.check_password(password) or \
                   user_obj.check_password(password.lower()) or \
                   user_obj.check_password(password.upper()) or \
                   user_obj.check_password(password.capitalize()):
                    user = user_obj
                    
        if not user or not user.is_active:
            return Response({'non_field_errors': ['Impossible de se connecter avec les identifiants fournis.']}, status=status.HTTP_400_BAD_REQUEST)

        # Method A: Delete existing tokens to ensure single session
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        
        # Determine user role and profile data
        role = 'vendeur'
        allowed_menus = []
        can_do_returns = False
        can_sell_negative_stock = False
        can_cash_out = True
        
        if user.is_superuser:
            role = 'admin'
            # Superuser gets all menus
            allowed_menus = [
                'dashboard', 'manager_sidebar', 'facturation', 'produits', 'commandes', 
                'clients', 'fournisseurs', 'inventaire', 'rapports',
                'parametres', 'utilisateurs', 'avoirs', 'promis',
                'ordonnancier', 'statistiques', 'audit', 'stock-analysis'
            ]
            can_do_returns = True
            can_sell_negative_stock = True
            can_cash_out = True
        elif hasattr(user, 'profile') and user.profile:
            role = user.profile.role
            allowed_menus = user.profile.allowed_menus or []
            can_do_returns = user.profile.can_do_returns
            can_sell_negative_stock = user.profile.can_sell_negative_stock
            can_cash_out = user.profile.can_cash_out
            
        # Record daily session (login)
        from django.utils import timezone
        import datetime
        today = timezone.now().date()
        
        # 1. Auto-close old unclosed sessions from previous days
        unclosed_old_sessions = UserDailySession.objects.filter(
            user=user, 
            date__lt=today, 
            last_logout__isnull=True
        )
        for old_session in unclosed_old_sessions:
            # Set logout to 23:59:59 of that day
            end_of_day = timezone.make_aware(
                datetime.datetime.combine(old_session.date, datetime.time.max)
            )
            old_session.last_logout = end_of_day
            old_session.save()

        # 2. Get or create today's session
        # get_or_create handles the "first login of the day" logic naturally
        # since it will create on first login and return existing on subsequent ones
        # Reset last_logout if user reconnects the same day
        session, created = UserDailySession.objects.get_or_create(
            user=user, 
            date=today
        )
        if not created and session.last_logout:
            session.last_logout = None
            session.save()
            
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'email': user.email,
            'role': role,
            'is_superuser': user.is_superuser,
            'allowed_menus': allowed_menus,
            'can_do_returns': can_do_returns,
            'can_sell_negative_stock': can_sell_negative_stock,
            'can_cash_out': can_cash_out,
            'server_time': timezone.now().isoformat(),
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

    def perform_create(self, serializer):
        user = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='User',
            object_id=user.id,
            description=f"Création utilisateur: {user.username}",
            details={
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            },
            request=self.request
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='User',
            object_id=user.id,
            description=f"Mise à jour utilisateur: {user.username}",
            details={
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            },
            request=self.request
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user_id = instance.id
        username = instance.username
        
        response = super().destroy(request, *args, **kwargs)
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='User',
            object_id=user_id,
            description=f"Suppression utilisateur: {username}",
            details={'username': username},
            request=request
        )
        return response

    @action(detail=False, methods=['post'])
    def verify_password(self, request):
        """
        Vérifie le mot de passe d'un utilisateur (pour le mode sudo).
        POST { "user_id": 1, "password": "xxx" }
        """
        user_id = request.data.get('user_id')
        password = request.data.get('password')
        
        if not user_id or not password:
            return Response({'valid': False, 'detail': 'user_id et password requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'valid': False, 'detail': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        
        if target_user.check_password(password) or \
           target_user.check_password(password.lower()) or \
           target_user.check_password(password.upper()) or \
           target_user.check_password(password.capitalize()):
            return Response({'valid': True})
        else:
            return Response({'valid': False, 'detail': 'Mot de passe incorrect.'})

    @action(detail=False, methods=['get'])
    def operators(self, request):
        """
        Liste tous les utilisateurs actifs (pour le mode sudo / sélection d'opérateur).
        Retourne uniquement les champs nécessaires, accessible à tout utilisateur authentifié.
        """
        users = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
        data = [
            {
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
            }
            for u in users
        ]
        return Response(data)

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

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        """
        Record logout time for the current user.
        """
        from django.utils import timezone
        today = timezone.now().date()
        
        try:
            session = UserDailySession.objects.get(user=request.user, date=today)
            session.last_logout = timezone.now()
            session.save()
            return Response({'status': 'Déconnexion enregistrée'})
        except UserDailySession.DoesNotExist:
            # If session doesn't exist (e.g. login wasn't tracked), create it with first_login=now
            UserDailySession.objects.create(user=request.user, date=today, last_logout=timezone.now())
            return Response({'status': 'Déconnexion enregistrée (nouvelle session)'})

class UserDailySessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing user daily sessions.
    """
    queryset = UserDailySession.objects.all().order_by('-date', '-first_login')
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user', 'date']
    ordering_fields = ['first_login', 'last_logout', 'date']

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return UserDailySession.objects.all().order_by('-date', '-first_login')
        return UserDailySession.objects.filter(user=user).order_by('-date', '-first_login')

    def get_serializer_class(self):
        from ..serializers_sessions import UserDailySessionSerializer
        return UserDailySessionSerializer
    @action(detail=False, methods=['get'])
    def recap_mensuel(self, request):
        """
        Returns a summary of hours worked per user for a specific month/year.
        Params: month (1-12), year (e.g. 2024)
        """
        from django.db.models import Sum, F, ExpressionWrapper, fields, Count
        import datetime
        
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        
        if not month or not year:
            today = datetime.date.today()
            month = today.month
            year = today.year
            
        sessions = self.get_queryset().filter(
            date__month=month,
            date__year=year,
            last_logout__isnull=False
        ).annotate(
            session_duration=ExpressionWrapper(
                F('last_logout') - F('first_login'),
                output_field=fields.DurationField()
            )
        )
        
        # Aggregate by user
        from django.contrib.auth.models import User
        users_stats = []
        
        # Get all users (or only those with sessions)
        relevant_users = User.objects.filter(is_active=True)
        if not request.user.is_superuser:
            relevant_users = relevant_users.filter(id=request.user.id)
            
        for user in relevant_users:
            user_sessions = sessions.filter(user=user)
            total_duration = user_sessions.aggregate(total=Sum('session_duration'))['total']
            days_count = user_sessions.count()
            
            if days_count > 0 and total_duration:
                total_seconds = int(total_duration.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                
                avg_seconds = total_seconds / days_count
                avg_hours = int(avg_seconds // 3600)
                avg_minutes = int((avg_seconds % 3600) // 60)
                
                users_stats.append({
                    'user_id': user.id,
                    'username': user.username,
                    'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'days_count': days_count,
                    'total_hours': hours,
                    'total_minutes': minutes,
                    'total_duration_display': f"{hours}h {minutes}min",
                    'avg_duration_display': f"{avg_hours}h {avg_minutes}min" if days_count > 0 else "0min"
                })
        
        return Response(users_stats)
