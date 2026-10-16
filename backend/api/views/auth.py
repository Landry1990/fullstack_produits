from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.menu_hierarchy import MENU_HIERARCHY, get_all_menu_keys, get_admin_only_keys

from ..audit_helpers import log_audit
from ..models import AuditLog


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_password(request):
    """
    Verifies the password for the currently authenticated user.
    """
    password = request.data.get('password')
    if not password:
        return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if user.check_password(password):
        log_audit(
            user=user,
            action=AuditLog.Action.OTHER,
            model_name='User',
            object_id=user.id,
            description=f"Vérification du mot de passe réussie pour {user.username}",
            request=request,
        )
        return Response({'success': True}, status=status.HTTP_200_OK)
    log_audit(
        user=user,
        action=AuditLog.Action.OTHER,
        model_name='User',
        object_id=user.id,
        description=f"Échec de vérification du mot de passe pour {user.username}",
        details={'result': 'denied'},
        request=request,
    )
    return Response({'success': False, 'error': 'Mot de passe incorrect'}, status=status.HTTP_403_FORBIDDEN)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def menu_hierarchy(request):
    """
    Retourne la hiérarchie des menus de l'application.

    Source de vérité partagée entre frontend et backend pour :
    - GestionUtilisateurs : afficher les menus accessibles
    - Validation des allowed_menus côté backend

    Réponse :
    {
      "hierarchy": [ { key, labelKey, submenus? }, ... ],
      "allKeys": [ "dashboard", "ventes", ... ],
      "adminOnlyKeys": [ "utilisateurs", ... ]
    }
    """
    return Response({
        'hierarchy': MENU_HIERARCHY,
        'allKeys': get_all_menu_keys(),
        'adminOnlyKeys': get_admin_only_keys(),
    }, status=status.HTTP_200_OK)
