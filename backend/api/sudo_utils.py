from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.db import transaction, DatabaseError
from .audit_helpers import log_audit
import logging

logger = logging.getLogger(__name__)

def validate_sudo_mode(request, permission_attr=None, data_source=None):
    """
    Centralise la validation du mode Sudo (tiers validateur).
    
    Args:
        request: L'objet DRF Request
        permission_attr: Le nom de l'attribut de permission à vérifier sur le profil (ex: 'can_modify_price')
        data_source: Le dictionnaire contenant les données (par défaut request.data)
        
    Returns:
        tuple: (validation_user, error_response)
        - validation_user: L'utilisateur validateur (ou request.user si pas de Sudo)
        - error_response: Un objet Response DRF en cas d'erreur, sinon None
    """
    data = data_source if data_source is not None else request.data
    
    # Paramètres Sudo standards
    # On supporte plusieurs noms de paramètres pour la compatibilité
    validated_by_id = data.get('validated_by_id') or data.get('cancelled_by_id')
    sudo_password = data.get('sudo_password') or data.get('password')
    
    # Si pas d'ID de validateur, on utilise l'utilisateur actuel
    if not validated_by_id:
        validation_user = request.user
    else:
        # Tentative de validation par un tiers
        # IMPORTANT: On utilise une transaction séparée pour isoler les erreurs DB
        # et éviter de corrompre la transaction principale
        try:
            with transaction.atomic():
                validator_user = User.objects.get(id=validated_by_id)
        except User.DoesNotExist:
            return None, Response({'detail': 'Utilisateur validateur introuvable.'}, status=status.HTTP_400_BAD_REQUEST)
        except DatabaseError as e:
            logger.error(f"[SUDO] Erreur DB lors de la récupération de l'utilisateur: {str(e)}", exc_info=True)
            return None, Response({'detail': 'Erreur de base de données lors de la validation.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not sudo_password:
            return None, Response({'detail': 'Mot de passe requis pour la validation Sudo.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérification du mot de passe
        if not validator_user.check_password(sudo_password):
            return None, Response({'detail': 'Mot de passe incorrect pour le validateur.'}, status=status.HTTP_403_FORBIDDEN)
        
        validation_user = validator_user

    # Vérification de la permission granulaire sur le validateur
    if permission_attr and not validation_user.is_superuser:
        try:
            with transaction.atomic():
                has_permission = hasattr(validation_user, 'profile') and getattr(validation_user.profile, permission_attr, False)
        except DatabaseError as e:
            logger.error(f"[SUDO] Erreur DB lors de la vérification des permissions: {str(e)}", exc_info=True)
            return None, Response({'detail': 'Erreur de base de données lors de la vérification des permissions.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        if not has_permission:
            return None, Response({
                'detail': f"L'utilisateur {validation_user.username} n'a pas la permission requise ({permission_attr})."
            }, status=status.HTTP_403_FORBIDDEN)

    # Enregistrement AuditLog (Optionnel mais recommandé si validé par un tiers)
    if validation_user != request.user:
        action_name = "Action nécessitant privilège d'encaissement/modification"
        if permission_attr:
            action_name = f"Privilège: {permission_attr}"

        try:
            with transaction.atomic():
                log_audit(
                    user=validation_user, # The person giving sudo rights 
                    action='SUDO_VAL', # The newly added Action
                    model_name='SudoMode',
                    object_id=request.user.username, # The user who requested it
                    description=f"Validation Sudo accordée à {request.user.username} - {action_name} - Route: {request.path}",
                    details={
                        'requested_by': request.user.username,
                        'permission': permission_attr,
                        'path': request.path
                    },
                    request=request
                )
        except DatabaseError as e:
            # On log l'erreur mais on ne bloque pas la validation si l'audit échoue
            logger.error(f"[SUDO] Erreur DB lors de l'enregistrement de l'audit: {str(e)}", exc_info=True)

    return validation_user, None
