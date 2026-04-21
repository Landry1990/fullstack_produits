from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from ...models.stock import RuptureFournisseur
from ...serializers import RuptureFournisseurSerializer
from django.db.models import Count
from django.utils import timezone
from django.http import HttpResponse
from datetime import timedelta
import csv

class RuptureFournisseurViewSet(viewsets.ModelViewSet):
    """
    Gestion des ruptures fournisseurs.
    Permet de déclarer un produit indisponible chez le grossiste et de le marquer résolu.
    """
    queryset = RuptureFournisseur.objects.all()
    serializer_class = RuptureFournisseurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['produit', 'est_resolu', 'fournisseur']
    search_fields = ['produit__name', 'fournisseur__name', 'remarques']

    def perform_create(self, serializer):
        serializer.save(utilisateur=self.request.user)

    @action(detail=True, methods=['post'])
    def resoudre(self, request, pk=None):
        rupture = self.get_object()
        if rupture.est_resolu:
            return Response({'error': 'Cette rupture est déjà marquée comme résolue.'}, status=status.HTTP_400_BAD_REQUEST)
        
        rupture.est_resolu = True
        rupture.date_fin = timezone.now()
        rupture.save(update_fields=['est_resolu', 'date_fin'])
        return Response({'status': 'Rupture marquée comme résolue'})

    def _get_frequency_stats(self, days=None):
        queryset = RuptureFournisseur.objects.all()
        if days:
            start_date = timezone.now() - timedelta(days=int(days))
            queryset = queryset.filter(date_debut__gte=start_date)
            
        stats = queryset.values(
            'produit__id', 'produit__name'
        ).annotate(
            total_ruptures=Count('id')
        ).order_by('-total_ruptures')[:200]
        
        return [
            {
                'produit_id': item['produit__id'],
                'produit_name': item['produit__name'],
                'total_ruptures': item['total_ruptures']
            } for item in stats
        ]

    @action(detail=False, methods=['get'])
    def statistiques_frequence(self, request):
        """
        Retourne la liste des produits tombant le plus souvent en rupture.
        """
        days = request.query_params.get('days')
        data = self._get_frequency_stats(days)
        return Response(data)

    @action(detail=False, methods=['get'])
    def export_frequence_csv(self, request):
        """
        Exporte les statistiques de fréquence de rupture en CSV.
        """
        days = request.query_params.get('days')
        data = self._get_frequency_stats(days)
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="frequence_ruptures.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID Produit', 'Nom Produit', 'Nombre de Ruptures'])
        for item in data:
            writer.writerow([item['produit_id'], item['produit_name'], item['total_ruptures']])
            
        return response
