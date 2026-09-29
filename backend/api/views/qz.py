"""Endpoints pour la signature sécurisée QZ Tray."""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.utils.qz_cert import get_certificate_pem, sign_qz_request


def qz_certificate(request):
    """Retourne le certificat public utilisé pour signer les requêtes QZ Tray."""
    # Le certificat public peut être exposé sans authentification.
    cert = get_certificate_pem()
    return HttpResponse(cert, content_type="text/plain")


class QzSignView(APIView):
    """Signe une requête QZ Tray avec la clé privée du serveur."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        to_sign = request.data.get("request")
        if not to_sign or not isinstance(to_sign, str):
            return Response(
                {"error": "Champ 'request' manquant ou invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        signature = sign_qz_request(to_sign)
        return Response({"signature": signature})
