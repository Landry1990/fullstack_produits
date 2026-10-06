from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...models.stock import SignalementBesoin
from ...serializers import SignalementBesoinSerializer


class SignalementBesoinViewSet(viewsets.ModelViewSet):
    """
    Besoins de commande signalés depuis le terrain (mobile comptoir).
    Un signalement = « ce produit manque / a été demandé » → à intégrer
    dans les suggestions de commande. Distinct de RuptureFournisseur
    (indisponibilité chez le grossiste).
    """
    queryset = SignalementBesoin.objects.select_related('produit', 'utilisateur').all()
    serializer_class = SignalementBesoinSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['produit', 'statut']
    search_fields = ['produit__name', 'note']

    def perform_create(self, serializer):
        serializer.save(utilisateur=self.request.user)

    def _set_statut(self, pk, statut, err_msg):
        signalement = self.get_object()
        if signalement.statut != SignalementBesoin.Statut.NOUVEAU:
            return Response({'error': err_msg}, status=status.HTTP_400_BAD_REQUEST)
        signalement.statut = statut
        signalement.save(update_fields=['statut'])
        return Response(SignalementBesoinSerializer(signalement).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def integrer(self, request, pk=None):
        """Marque le signalement comme intégré à une commande."""
        return self._set_statut(
            pk, SignalementBesoin.Statut.INTEGRE,
            'Ce signalement a déjà été traité.'
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def ignorer(self, request, pk=None):
        """Marque le signalement comme ignoré (doublon, non pertinent…)."""
        return self._set_statut(
            pk, SignalementBesoin.Statut.IGNORE,
            'Ce signalement a déjà été traité.'
        )
