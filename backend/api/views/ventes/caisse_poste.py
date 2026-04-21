from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from ...models import PosteCaisse
from ...serializers import PosteCaisseSerializer

class PosteCaisseViewSet(viewsets.ModelViewSet):
    """
    API endpoint pour la gestion des postes de caisse physiques.
    """
    queryset = PosteCaisse.objects.all().select_related('ouvert_par')
    serializer_class = PosteCaisseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'code']

    @action(detail=True, methods=['post'])
    def ouvrir(self, request, pk=None):
        """Ouvre un poste de caisse."""
        poste = self.get_object()
        if poste.est_ouvert:
            return Response({
                "detail": f"Le poste {poste.nom} est déjà ouvert par {poste.ouvert_par.username if poste.ouvert_par else 'un utilisateur'}."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        poste.est_ouvert = True
        poste.ouvert_par = request.user
        poste.date_ouverture = timezone.now()
        poste.save()
        
        return Response(self.get_serializer(poste).data)

    @action(detail=True, methods=['post'])
    def fermer(self, request, pk=None):
        """Ferme un poste de caisse."""
        poste = self.get_object()
        if not poste.est_ouvert:
            return Response({
                "detail": f"Le poste {poste.nom} est déjà fermé."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        poste.est_ouvert = False
        poste.ouvert_par = None
        # On pourrait garder la date d'ouverture pour historique ou ajouter une date_fermeture
        poste.save()
        
        return Response(self.get_serializer(poste).data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Retourne uniquement les postes de caisse ouverts."""
        active_postes = self.get_queryset().filter(est_ouvert=True)
        serializer = self.get_serializer(active_postes, many=True)
        return Response(serializer.data)
