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
from ..pagination import StandardResultsSetPagination

def auto_close_old_sessions(user=None):
    """
    Closes any unclosed sessions from previous days.
    If user is provided, only closes sessions for that user.
    """
    from django.utils import timezone
    import datetime
    today = timezone.now().date()
    
    # We use a separate import here to avoid circular dependencies if any
    from ..models import UserDailySession
    
    query = UserDailySession.objects.filter(date__lt=today, last_logout__isnull=True)
    if user:
        query = query.filter(user=user)
        
    for session in query:
        # Set logout to 23:59:59 of that day
        end_of_day = timezone.make_aware(
            datetime.datetime.combine(session.date, datetime.time.max)
        )
        session.last_logout = end_of_day
        session.save()

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
        
        # 1. Auto-close old unclosed sessions for THIS user
        auto_close_old_sessions(user=user)

        # 2. Get or create today's session
        # get_or_create handles the "first login of the day" logic naturally
        workstation = request.data.get('workstation')
        session, created = UserDailySession.objects.get_or_create(
            user=user, 
            date=today
        )
        
        # Update workstation and reset last_logout if user reconnects the same day
        session.workstation = workstation
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
    pagination_class = StandardResultsSetPagination
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
            # If workstation identifier is sent during logout, update it
            workstation = request.data.get('workstation')
            if workstation:
                session.workstation = workstation
            session.save()
            return Response({'status': 'Déconnexion enregistrée'})
        except UserDailySession.DoesNotExist:
            # If session doesn't exist, create it with last_logout=now
            workstation = request.data.get('workstation')
            UserDailySession.objects.create(
                user=request.user, 
                date=today, 
                last_logout=timezone.now(),
                workstation=workstation
            )
            return Response({'status': 'Déconnexion enregistrée (nouvelle session)'})

class UserDailySessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing user daily sessions.
    """
    queryset = UserDailySession.objects.all().order_by('-date', '-first_login')
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user', 'date']
    ordering_fields = ['first_login', 'last_logout', 'date']

    def get_queryset(self):
        user = self.request.user
        
        # Auto-close old sessions when viewing the list
        # If superuser, close ALL old sessions. If regular user, only close their own.
        if user.is_superuser:
            auto_close_old_sessions()
            return UserDailySession.objects.all().order_by('-date', '-first_login')
        
        auto_close_old_sessions(user=user)
        return UserDailySession.objects.filter(user=user).order_by('-date', '-first_login')

    def get_serializer_class(self):
        from ..serializers_sessions import UserDailySessionSerializer
        return UserDailySessionSerializer
    @action(detail=True, methods=['post'])
    def force_logout(self, request, pk=None):
        """
        Forces a user logout by deleting their auth tokens and closing the session.
        Only superusers can perform this action.
        """
        if not request.user.is_superuser:
            return Response({'detail': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)
            
        session = self.get_object()
        user = session.user
        
        # 1. Delete all tokens for this user
        from rest_framework.authtoken.models import Token
        Token.objects.filter(user=user).delete()
        
        # 2. Update session logout time if not already set
        if not session.last_logout:
            from django.utils import timezone
            session.last_logout = timezone.now()
            session.save()
            
        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='UserDailySession',
            object_id=session.id,
            description=f"Déconnexion forcée pour l'utilisateur: {user.username}",
            details={'user_id': user.id, 'username': user.username},
            request=request
        )
        
        return Response({'status': f'Utilisateur {user.username} déconnecté avec succès.'})

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
