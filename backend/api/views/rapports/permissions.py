from rest_framework.permissions import BasePermission


class CanAccessReports(BasePermission):
    """
    Permission restreignant l'accès aux rapports aux utilisateurs authentifiés
    disposant du droit 'statistiques_rapports' ou 'statistiques'.
    """
    message = "Accès réservé aux rapports autorisés."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True

        profile = getattr(user, 'profile', None)
        if profile is None:
            return False

        allowed = getattr(profile, 'allowed_menus', None) or []
        return any(menu in allowed for menu in ('statistiques_rapports', 'statistiques'))
