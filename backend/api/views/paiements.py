# -*- coding: utf-8 -*-
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from ..models import PaiementFournisseur, Fournisseur, Commande
from ..serializers import PaiementFournisseurSerializer
from ..pagination import StandardResultsSetPagination

class PaiementFournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for supplier payments."""
    queryset = PaiementFournisseur.objects.all().select_related('fournisseur', 'commande', 'created_by')
    serializer_class = PaiementFournisseurSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
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

    @action(detail=False, methods=['get'])
    def recap_journalier(self, request):
        """
        Génère un récapitulatif des paiements par date et fournisseur.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        query = PaiementFournisseur.objects.all().select_related('fournisseur')
        
        if date_debut:
            query = query.filter(date_paiement__gte=date_debut)
        if date_fin:
            query = query.filter(date_paiement__lte=date_fin)
            
        from django.db.models import Sum, F
        from django.db.models.functions import TruncDate
        
        recap = query.annotate(
            jour=TruncDate('date_paiement')
        ).values(
            'jour', 'fournisseur__name', 'mode_paiement', 'reference'
        ).annotate(
            total_montant=Sum('montant')
        ).order_by('-jour', 'fournisseur__name')
        
        data = []
        for item in recap:
            data.append({
                'date': item['jour'],
                'fournisseur': item['fournisseur__name'],
                'mode_paiement': item['mode_paiement'],
                'reference': item['reference'] or '-',
                'total_montant': item['total_montant']
            })
            
        return Response(data)
