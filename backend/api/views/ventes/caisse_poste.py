from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
from ...models import PosteCaisse, SessionCaisse, Caisse
from ...serializers import PosteCaisseSerializer, SessionCaisseSerializer

class PosteCaisseViewSet(viewsets.ModelViewSet):
    """
    API endpoint pour la gestion des postes de caisse physiques.
    """
    queryset = PosteCaisse.objects.all().select_related('ouvert_par').prefetch_related('sessions')
    serializer_class = PosteCaisseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'code']

    @action(detail=True, methods=['post'])
    def ouvrir(self, request, pk=None):
        """Ouvre un poste de caisse et crée une session."""
        poste = self.get_object()
        if poste.est_ouvert:
            return Response({
                "detail": f"Le poste {poste.nom} est déjà ouvert par {poste.ouvert_par.username if poste.ouvert_par else 'un utilisateur'}."
            }, status=status.HTTP_400_BAD_REQUEST)

        fond = request.data.get('fond_de_caisse')
        fond_decimal = Decimal(fond) if fond else None

        poste.est_ouvert = True
        poste.ouvert_par = request.user
        poste.date_ouverture = timezone.now()
        poste.fond_de_caisse = fond_decimal
        poste.save()

        # Créer une session
        SessionCaisse.objects.create(
            poste=poste,
            ouvert_par=request.user,
            fond_de_caisse=fond_decimal,
            est_active=True
        )

        return Response(self.get_serializer(poste).data)

    @action(detail=True, methods=['post'])
    def fermer(self, request, pk=None):
        """Ferme un poste de caisse et sa session active."""
        poste = self.get_object()
        if not poste.est_ouvert:
            return Response({
                "detail": f"Le poste {poste.nom} est déjà fermé."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Récupérer la session active
        session = poste.sessions.filter(est_active=True).first()

        # Calculer le montant total encaissé pendant cette session
        # (les paiements Caisse liés à des factures de ce poste, créés pendant la session)
        montant_encaisse = Decimal('0')
        if session:
            montant_encaisse = Caisse.objects.filter(
                facture__poste_caisse=poste,
                created_at__gte=session.date_ouverture
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0')

            session.est_active = False
            session.date_fermeture = timezone.now()
            session.montant_total_encaisse = montant_encaisse
            session.save()

        poste.est_ouvert = False
        poste.ouvert_par = None
        poste.fond_de_caisse = None
        poste.save()

        return Response(self.get_serializer(poste).data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Retourne uniquement les postes de caisse ouverts."""
        active_postes = self.get_queryset().filter(est_ouvert=True)
        serializer = self.get_serializer(active_postes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mes_actives(self, request):
        """Retourne les postes ouverts par l'utilisateur courant."""
        mes_postes = self.get_queryset().filter(est_ouvert=True, ouvert_par=request.user)
        serializer = self.get_serializer(mes_postes, many=True)
        return Response(serializer.data)


class SessionCaisseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour consulter les sessions de caisse.
    """
    queryset = SessionCaisse.objects.all().select_related('poste', 'ouvert_par')
    serializer_class = SessionCaisseSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def actives(self, request):
        """Sessions actives du jour."""
        sessions = self.get_queryset().filter(est_active=True)
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mes_sessions(self, request):
        """Sessions de l'utilisateur courant."""
        sessions = self.get_queryset().filter(ouvert_par=request.user)
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)
