import jwt
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models.licence import Licence, LicenceNotification
from api.utils_licence import (
    CLE_PUBLIQUE,
    get_hardware_id,
    get_licence_details,
    valider_licence_systeme,
)


def _validate_admin_sudo(request):
    """
    Valide qu'une requête provient d'un administrateur.
    Utilisé pour protéger l'installation/suppression de licence.

    Accepte soit :
    - Un utilisateur authentifié + superuser (session active)
    - Un mot de passe admin fourni dans sudo_password (premier démarrage sans session)
    - Un code keyday fourni dans keyday (mot de passe journalier donné par le support)

    Retourne (user, error_response). error_response est None si OK.
    """
    from api.keyday import validate_keyday

    # Cas 1: utilisateur authentifié + superuser
    user = request.user
    if user and getattr(user, 'is_authenticated', False) and user.is_superuser:
        return user, None

    # Cas 2: code keyday (mot de passe journalier du support)
    keyday_code = request.data.get('keyday')
    if keyday_code and validate_keyday(keyday_code):
        # Le keyday est valide — on retourne le premier superuser comme "auteur"
        admin = User.objects.filter(is_active=True, is_superuser=True).first()
        return admin, None

    # Cas 3: mot de passe admin fourni (premier démarrage)
    sudo_password = request.data.get('sudo_password')
    if sudo_password:
        for candidate in User.objects.filter(is_active=True, is_superuser=True):
            if candidate.check_password(sudo_password):
                return candidate, None

    # Aucune méthode d'authentification valide
    has_keyday = bool(request.data.get('keyday'))
    has_sudo = bool(request.data.get('sudo_password'))
    if not has_keyday and not has_sudo:
        return None, Response(
            {'detail': 'Mot de passe administrateur ou code journalier requis pour cette action.'},
            status=status.HTTP_403_FORBIDDEN
        )
    return None, Response(
        {'detail': 'Mot de passe ou code journalier incorrect.'},
        status=status.HTTP_403_FORBIDDEN
    )


class LicenceStatusView(APIView):
    # L'utilisateur n'a pas besoin d'être connecté pour voir le statut de la licence
    # Ignorer les tokens périmés envoyés accidentellement par le navigateur
    authentication_classes = []
    permission_classes = [AllowAny] 
    
    def get(self, request):
        """Récupérer l'état actuel de la licence et l'empreinte matérielle"""
        est_valide, message, payload = valider_licence_systeme()
        return Response({
            "is_valid": est_valide,
            "message": message,
            "hardware_id": get_hardware_id(),
            "payload": payload
        })
        
    def post(self, request):
        """Le Frontend envoie une nouvelle clé pour l'activer ou la prévisualiser"""
        nouvelle_cle = request.data.get('cle')
        preview_mode = request.data.get('preview', False)

        if not nouvelle_cle:
            return Response({"detail": "La clé de licence est requise."}, status=400)

        if preview_mode:
            # Le preview reste ouvert (lecture seule, ne modifie rien)
            try:
                payload = jwt.decode(
                    nouvelle_cle, CLE_PUBLIQUE, algorithms=["RS256"],
                    options={"verify_exp": False},
                )
                hw_id = get_hardware_id()
                hw_match = (payload.get('hardware_id') == "ANY" or payload.get('hardware_id') == hw_id)

                # Vérifier install_before pour afficher un avertissement
                install_before = payload.get('install_before')
                install_expired = False
                install_before_str = None
                if install_before:
                    from datetime import datetime as _dt
                    try:
                        ib_date = _dt.utcfromtimestamp(install_before)
                        install_before_str = ib_date.strftime('%d/%m/%Y')
                        install_expired = _dt.utcnow() > ib_date
                    except (ValueError, TypeError, OSError):
                        pass

                return Response({
                    "pharmacie_nom": payload.get('pharmacie_nom'),
                    "pharmacien_nom": payload.get('pharmacien_nom'),
                    "plan": payload.get('plan'),
                    "exp": payload.get('exp'),
                    "hardware_match": hw_match,
                    "install_before": install_before_str,
                    "install_expired": install_expired,
                })
            except Exception as e:
                return Response({"detail": f"Clé invalide : {e!s}"}, status=400)

        # ── Protection : installation nécessite un admin ──
        admin_user, error = _validate_admin_sudo(request)
        if error:
            return error

        # Validation en mémoire AVANT d'écraser l'ancienne licence
        try:
            payload = jwt.decode(
                nouvelle_cle, CLE_PUBLIQUE, algorithms=["RS256"],
                options={"verify_exp": False},
            )
        except Exception as e:
            return Response({"detail": f"Clé invalide : {e!s}"}, status=400)

        # ── Vérification du TTL d'installation (install_before) ──
        # La licence doit être installée dans les 10 jours suivant sa génération.
        # Une fois installée, elle reste valide (ce check ne se fait qu'à l'installation).
        install_before = payload.get('install_before')
        if install_before:
            from datetime import datetime as _dt
            try:
                if isinstance(install_before, (int, float)):
                    ib_date = _dt.utcfromtimestamp(install_before)
                else:
                    ib_date = _dt.utcfromtimestamp(install_before)
                now_utc = _dt.utcnow()
                if now_utc > ib_date:
                    return Response({
                        "detail": f"Clé rejetée : Cette licence devait être installée avant le "
                                  f"{ib_date.strftime('%d/%m/%Y')}. Veuillez demander une nouvelle licence."
                    }, status=400)
            except (ValueError, TypeError, OSError):
                # Si install_before est malformé, on ignore (rétrocompatibilité)
                pass

        hw_id = get_hardware_id()
        if payload.get('hardware_id') != "ANY" and payload.get('hardware_id') != hw_id:
            return Response({"detail": "Clé rejetée : Matériel non reconnu."}, status=400)

        # On écrase l'ancienne licence et on installe la nouvelle
        Licence.objects.all().delete()
        Licence.objects.create(cle=nouvelle_cle)

        # On invalide le cache pour forcer la relecture immédiate
        cache.delete('system_licence_validation')

        # On teste immédiatement si elle est valide
        est_valide, message, payload = valider_licence_systeme()

        if not est_valide:
            return Response({"detail": f"Clé rejetée : {message}"}, status=400)

        return Response({"detail": "Licence activée avec succès ! Bienvenue."})

    def delete(self, request):
        """Supprimer la licence actuelle — nécessite un admin"""
        admin_user, error = _validate_admin_sudo(request)
        if error:
            return error

        Licence.objects.all().delete()
        cache.delete('system_licence_validation')
        return Response({"detail": "Licence supprimée. Le système est à nouveau verrouillé."})


class LicenceNotificationsView(APIView):
    """
    API pour les notifications d'alerte de licence.
    Tous les utilisateurs authentifiés peuvent voir les notifications actives.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Récupérer les notifications actives de licence + statut"""
        # Notifications actives (non ignorées, non expirées)
        notifications = LicenceNotification.objects.filter(
            status=LicenceNotification.Status.ACTIVE
        ).order_by('-created_at')

        # Statut détaillé de la licence
        is_valid, payload, days_remaining, is_lifetime = get_licence_details()

        data = {
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "severity": n.severity,
                    "days_remaining": n.days_remaining,
                    "expiry_date": n.expiry_date.isoformat() if n.expiry_date else None,
                    "created_at": n.created_at.isoformat(),
                }
                for n in notifications
            ],
            "licence_status": {
                "is_valid": is_valid,
                "is_lifetime": is_lifetime,
                "days_remaining": days_remaining,
                "pharmacie_nom": payload.get('pharmacie_nom') if payload else None,
                "plan": payload.get('plan') if payload else None,
            }
        }
        return Response(data)

    def post(self, request):
        """Ignorer (dismiss) une notification"""
        notification_id = request.data.get('notification_id')

        if not notification_id:
            return Response(
                {"detail": "notification_id est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            notification = LicenceNotification.objects.get(
                id=notification_id,
                status=LicenceNotification.Status.ACTIVE
            )
            notification.status = LicenceNotification.Status.DISMISSED
            notification.dismissed_by = request.user
            notification.dismissed_at = timezone.now()
            notification.save()

            return Response({
                "detail": "Notification ignorée",
                "notification_id": notification_id
            })

        except LicenceNotification.DoesNotExist:
            return Response(
                {"detail": "Notification non trouvée ou déjà ignorée"},
                status=status.HTTP_404_NOT_FOUND
            )
