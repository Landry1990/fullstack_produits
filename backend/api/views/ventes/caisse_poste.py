from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
from ...models import PosteCaisse, SessionCaisse, Caisse, Facture
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
        """Ouvre un poste de caisse et crée une session. Ferme les anciennes sessions de l'utilisateur."""
        poste = self.get_object()
        if poste.est_ouvert:
            return Response({
                "detail": f"Le poste {poste.nom} est déjà ouvert par {poste.ouvert_par.username if poste.ouvert_par else 'un utilisateur'}."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Fermer automatiquement les anciennes sessions de l'utilisateur
        anciennes_sessions = SessionCaisse.objects.filter(
            ouvert_par=request.user,
            est_active=True
        )
        for session in anciennes_sessions:
            # Calculer le montant encaissé
            montant_encaisse = Caisse.objects.filter(
                facture__poste_caisse=session.poste,
                date_paiement__gte=session.date_ouverture
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0')
            
            session.est_active = False
            session.date_fermeture = timezone.now()
            session.montant_total_encaisse = montant_encaisse
            session.save()
            
            # Fermer aussi le poste associé
            session.poste.est_ouvert = False
            session.poste.ouvert_par = None
            session.poste.save()

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

        # Vérifier si des ventes non réglées sont présentes sur ce poste
        ventes_non_reglees = Facture.objects.filter(
            poste_caisse=poste,
            status__in=[Facture.Status.BROUILLON, Facture.Status.VALIDEE],
            is_active=True
        )
        if ventes_non_reglees.exists():
            count = ventes_non_reglees.count()
            return Response({
                "detail": f"Impossible de fermer la caisse : {count} vente(s) en attente de règlement. Veuillez régler ou annuler les ventes avant de clôturer."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Récupérer la session active
        session = poste.sessions.filter(est_active=True).first()

        # Calculer le montant total encaissé pendant cette session
        # (les paiements Caisse liés à des factures de ce poste, créés pendant la session)
        montant_encaisse = Decimal('0')
        if session:
            montant_encaisse = Caisse.objects.filter(
                facture__poste_caisse=poste,
                date_paiement__gte=session.date_ouverture
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0')

            session.est_active = False
            session.date_fermeture = timezone.now()
            session.montant_total_encaisse = montant_encaisse
            session.save()

        poste.est_ouvert = False
        poste.ouvert_par = None
        poste.fond_de_caisse = None
        poste.save()

        # Vérifier si on doit masquer les montants (option de sécurité pour certains pharmacies)
        from api.models import PharmacySettings
        pharmacy_settings = PharmacySettings.objects.first()
        pharmacy_hide_setting = pharmacy_settings.hide_cash_totals if pharmacy_settings else False
        
        # Priorité : 1) Paramètre de requête, 2) Paramètre de la pharmacie
        hide_amounts = request.data.get('hide_amounts', pharmacy_hide_setting)

        # Générer le rapport de clôture
        rapport = {
            'detail': f'Caisse {poste.nom} fermée avec succès',
            'poste': {
                'id': poste.id,
                'nom': poste.nom,
                'code': poste.code
            },
            'session': {
                'date_ouverture': session.date_ouverture if session else None,
                'date_fermeture': timezone.now(),
                'fond_de_caisse': float(session.fond_de_caisse) if session and session.fond_de_caisse else 0,
                'montant_encaisse': float(montant_encaisse) if not hide_amounts else None,
                'montant_theorique': float((session.fond_de_caisse or Decimal('0')) + montant_encaisse) if session else float(montant_encaisse) if not hide_amounts else None,
                'montant_masque': hide_amounts
            },
            'transactions': {
                'total': Caisse.objects.filter(
                    facture__poste_caisse=poste,
                    date_paiement__gte=session.date_ouverture if session else timezone.now()
                ).count(),
                'montant_total': float(montant_encaisse) if not hide_amounts else None
            },
            'hide_amounts': hide_amounts
        }

        return Response(rapport)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Retourne uniquement les postes de caisse ouverts."""
        active_postes = self.get_queryset().filter(est_ouvert=True)
        serializer = self.get_serializer(active_postes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='mes_actives')
    def mes_actives(self, request):
        """Retourne les postes ouverts par l'utilisateur courant."""
        mes_postes = self.get_queryset().filter(est_ouvert=True, ouvert_par=request.user)
        serializer = self.get_serializer(mes_postes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='forcer-fermeture')
    def forcer_fermeture(self, request, pk=None):
        """Force la fermeture d'un poste de caisse bloqué (session crashée)."""
        poste = self.get_object()
        
        # Forcer la fermeture de toutes les sessions actives
        sessions_actives = poste.sessions.filter(est_active=True)
        for session in sessions_actives:
            # Calculer le montant encaissé
            montant_encaisse = Caisse.objects.filter(
                facture__poste_caisse=poste,
                date_paiement__gte=session.date_ouverture
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0')
            
            session.est_active = False
            session.date_fermeture = timezone.now()
            session.montant_total_encaisse = montant_encaisse
            session.save()
        
        # Forcer la fermeture du poste
        poste.est_ouvert = False
        poste.ouvert_par = None
        poste.fond_de_caisse = None
        poste.save()
        
        return Response({
            'detail': f'Le poste {poste.nom} a été fermé forcément.',
            'sessions_fermees': sessions_actives.count()
        })


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
