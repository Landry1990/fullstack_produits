"""
Helper functions for creating explicit audit log entries.
Centralizes audit logging logic for consistent, readable audit trails.
"""
from .models import AuditLog


def log_audit(user, action, model_name, object_id, description, details=None, request=None):
    """
    Crée un log d'audit explicite avec description lisible.
    
    Args:
        user: L'utilisateur effectuant l'action (User instance)
        action: Le type d'action (AuditLog.Action choice)
        model_name: Nom du modèle concerné (str)
        object_id: ID de l'objet concerné (int/str)
        description: Description lisible de l'action (str)
        details: Détails supplémentaires en JSON (dict, optional)
        request: L'objet request pour extraire l'IP (optional)
    
    Returns:
        AuditLog: L'instance créée
    """
    ip_address = None
    if request:
        # Obtenir l'IP, en tenant compte des proxies
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')
    
    try:
        # S'assurer que la description est une chaîne Unicode propre
        safe_description = str(description)
        
        return AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action=action,
            model_name=model_name,
            object_id=str(object_id) if object_id else None,
            description=safe_description,
            details=details or {},
            ip_address=ip_address
        )
    except Exception as e:
        # Le log d'audit ne doit JAMAIS bloquer l'opération principale
        print(f"Erreur lors de la création du log d'audit: {e}")
        return None
