from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from django.utils import timezone
import jwt
from api.models.licence import Licence, LicenceNotification
from api.utils_licence import valider_licence_systeme, get_hardware_id, get_licence_details

class LicenceStatusView(APIView):
    # L'utilisateur n'a pas besoin d'être connecté pour voir le statut de la licence
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
            from api.utils_licence import CLE_PUBLIQUE, get_hardware_id
            try:
                payload = jwt.decode(nouvelle_cle, CLE_PUBLIQUE, algorithms=["RS256"])
                hw_id = get_hardware_id()
                hw_match = (payload.get('hardware_id') == "ANY" or payload.get('hardware_id') == hw_id)
                return Response({
                    "pharmacie_nom": payload.get('pharmacie_nom'),
                    "pharmacien_nom": payload.get('pharmacien_nom'),
                    "plan": payload.get('plan'),
                    "exp": payload.get('exp'),
                    "hardware_match": hw_match,
                })
            except Exception as e:
                return Response({"detail": f"Clé invalide : {str(e)}"}, status=400)

        # On sauvegarde la clé temporairement
        Licence.objects.create(cle=nouvelle_cle)
        
        # On teste immédiatement si elle est valide
        est_valide, message, payload = valider_licence_systeme()
        
        if not est_valide:
            return Response({"detail": f"Clé rejetée : {message}"}, status=400)
            
        return Response({"detail": "Licence activée avec succès ! Bienvenue."})

    def delete(self, request):
        """Supprimer la licence actuelle pour recommencer"""
        Licence.objects.all().delete()
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
