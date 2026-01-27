
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..clinical_service import ClinicalService

class ClinicalViewSet(viewsets.ViewSet):
    """
    ViewSet pour les vérifications cliniques.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def check(self, request):
        """
        Vérifie une liste de produits pour des interactions.
        Body: { "produits": [id1, id2, ...] }
        """
        produit_ids = request.data.get('produits', [])
        
        if not produit_ids:
            return Response({'alerts': []})

        try:
            # Conversion en int sécurisée
            ids = [int(p_id) for p_id in produit_ids]
            alerts = ClinicalService.check_interactions(ids)
            return Response({'alerts': alerts})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
