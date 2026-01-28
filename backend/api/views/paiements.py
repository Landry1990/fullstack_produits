# -*- coding: utf-8 -*-
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from ..models import PaiementFournisseur, Fournisseur, Commande
from ..serializers import PaiementFournisseurSerializer

class PaiementFournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for supplier payments."""
    queryset = PaiementFournisseur.objects.all().select_related('fournisseur', 'commande', 'created_by')
    serializer_class = PaiementFournisseurSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['fournisseur', 'commande', 'mode_paiement']
    search_fields = ['reference', 'fournisseur__name', 'notes']
    ordering_fields = ['date_paiement', 'created_at', 'montant']
    ordering = ['-date_paiement', '-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def par_fournisseur(self, request):
        """Récupère les paiements d'un fournisseur spécifique."""
        fournisseur_id = request.query_params.get('fournisseur_id')
        if not fournisseur_id:
            return Response({"error": "fournisseur_id est requis"}, status=status.HTTP_400_BAD_REQUEST)
        
        paiements = self.queryset.filter(fournisseur_id=fournisseur_id)
        serializer = self.get_serializer(paiements, many=True)
        return Response(serializer.data)
