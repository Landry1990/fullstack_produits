from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Q, Count
from django.db import transaction
from decimal import Decimal
from ...models import PosteCaisse, PosteVente, Caisse, Facture
from ...serializers import PosteCaisseSerializer, PosteVenteSerializer, SessionCaisseSerializer


class PosteCaisseViewSet(viewsets.ModelViewSet):
    """
    API endpoint pour la gestion des caisses physiques (matériel).
    """
    queryset = PosteCaisse.objects.all()
    serializer_class = PosteCaisseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'code']


class PosteVenteViewSet(viewsets.ModelViewSet):
    """
    API endpoint pour la gestion des postes de vente (sessions logiques).
    """
    queryset = PosteVente.objects.all().select_related('caisse', 'vendeur')
    serializer_class = PosteVenteSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def actives(self, request):
        """Retourne les postes de vente actifs."""
        postes = self.get_queryset().filter(est_actif=True)
        serializer = self.get_serializer(postes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='mes_actives')
    def mes_actives(self, request):
        """Retourne les postes de vente actifs de l'utilisateur courant."""
        postes = self.get_queryset().filter(est_actif=True, vendeur=request.user)
        serializer = self.get_serializer(postes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='postes_caisses_disponibles')
    def postes_caisses_disponibles(self, request):
        """Retourne les caisses physiques qui n'ont pas de poste de vente actif."""
        caisses_actives = PosteVente.objects.filter(est_actif=True).values_list('caisse_id', flat=True)
        caisses = PosteCaisse.objects.exclude(id__in=caisses_actives)
        serializer = PosteCaisseSerializer(caisses, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Crée un point de vente (définition simple avec juste un nom)."""
        nom = request.data.get('nom')
        if not nom:
            return Response(
                {"detail": "Le nom du point de vente est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST
            )
        poste = PosteVente.objects.create(nom=nom, est_actif=False)
        serializer = self.get_serializer(poste)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='disponibles')
    def disponibles(self, request):
        """Retourne les points de vente non actifs (disponibles à l'ouverture).
        Un point de vente POS n'a pas de caisse physique assignée."""
        postes = self.get_queryset().filter(
            est_actif=False, vendeur__isnull=True, caisse__isnull=True
        )
        serializer = self.get_serializer(postes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='tous_postes')
    def tous_postes(self, request):
        """Retourne tous les points de vente (définitions sans caisse physique).
        Exclut les sessions de caisse créées via ouvrir (qui ont une caisse)."""
        postes = self.get_queryset().filter(caisse__isnull=True)
        serializer = self.get_serializer(postes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='activer')
    def activer(self, request, pk=None):
        """Active un point de vente (mode POS) pour l'utilisateur courant.
        Aucune caisse physique n'est assignée — le POS envoie les ventes
        vers la caisse ouverte par la caissière."""
        poste = self.get_object()
        if poste.est_actif:
            return Response(
                {"detail": f"Le point de vente {poste.nom} est déjà actif."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Fermer uniquement les anciens postes POS actifs de l'utilisateur
        PosteVente.objects.filter(
            vendeur=request.user, est_actif=True, mode_pos=True
        ).update(
            est_actif=False, date_fermeture=timezone.now()
        )

        fond = request.data.get('fond_de_caisse')
        fond_decimal = Decimal(fond) if fond else None

        poste.vendeur = request.user
        poste.fond_de_caisse = fond_decimal
        poste.est_actif = True
        poste.mode_pos = True
        poste.caisse = None  # POS n'a pas de caisse physique
        poste.date_ouverture = timezone.now()
        poste.date_fermeture = None
        poste.montant_total_encaisse = None
        poste.save()

        # Rattacher les factures en attente sans poste de vente
        factures_rattachees = Facture.objects.filter(
            status=Facture.Status.PROFORMA,
            poste_vente__isnull=True,
            is_active=True
        ).update(poste_vente=poste)

        data = self.get_serializer(poste).data
        data['factures_en_attente_rattachees'] = factures_rattachees
        return Response(data)

    @action(detail=True, methods=['post'])
    def ouvrir(self, request, pk=None):
        """Ouvre un poste de vente sur une caisse physique."""
        caisse = PosteCaisse.objects.filter(pk=pk).first()
        if not caisse:
            return Response({"detail": "Caisse introuvable."}, status=status.HTTP_404_NOT_FOUND)

        # Vérifier si la caisse est déjà utilisée par un poste de vente actif
        actif = PosteVente.objects.filter(caisse=caisse, est_actif=True).first()
        if actif:
            vendeur = actif.vendeur.username if actif.vendeur else 'un utilisateur'
            return Response({
                "detail": f"La caisse {caisse.nom} est déjà utilisée par {vendeur}."
            }, status=status.HTTP_400_BAD_REQUEST)

        fond = request.data.get('fond_de_caisse')
        fond_decimal = Decimal(fond) if fond else None

        # Fermer uniquement les anciens postes de caisse centrale (non-POS) de l'utilisateur
        PosteVente.objects.filter(
            vendeur=request.user,
            est_actif=True,
            mode_pos=False
        ).update(
            est_actif=False,
            date_fermeture=timezone.now()
        )

        poste = PosteVente.objects.create(
            nom=caisse.nom,
            caisse=caisse,
            vendeur=request.user,
            fond_de_caisse=fond_decimal,
            date_ouverture=timezone.now(),
            est_actif=True,
            mode_pos=False
        )

        # Rattacher les factures en attente (PROF) sans poste de vente assigné
        factures_rattachees = Facture.objects.filter(
            status=Facture.Status.PROFORMA,
            poste_vente__isnull=True,
            is_active=True
        ).update(poste_vente=poste)

        data = self.get_serializer(poste).data
        data['factures_en_attente_rattachees'] = factures_rattachees
        return Response(data)

    @action(detail=True, methods=['post'])
    def fermer(self, request, pk=None):
        """Ferme un poste de vente."""
        poste = self.get_object()
        if not poste.est_actif:
            return Response({
                "detail": f"Le point de vente {poste.nom} est déjà fermé."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier si des ventes non réglées sont présentes
        ventes_non_reglees = Facture.objects.filter(
            poste_vente=poste,
            status__in=[Facture.Status.BROUILLON, Facture.Status.VALIDEE],
            is_active=True
        )
        if ventes_non_reglees.exists():
            count = ventes_non_reglees.count()
            return Response({
                "detail": f"Impossible de fermer : {count} vente(s) en attente de règlement."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculer le montant total encaissé
        montant_encaisse = Caisse.objects.filter(
            facture__poste_vente=poste,
            date_paiement__gte=poste.date_ouverture,
            statut='completee'
        ).exclude(mode_paiement__in=['en_compte', 'depot']).aggregate(total=Sum('montant'))['total'] or Decimal('0')

        poste.est_actif = False
        poste.date_fermeture = timezone.now()
        poste.montant_total_encaisse = montant_encaisse
        poste.save()

        from api.models import PharmacySettings
        pharmacy_settings = PharmacySettings.objects.first()
        pharmacy_hide_setting = pharmacy_settings.hide_cash_totals if pharmacy_settings else False
        hide_amounts = request.data.get('hide_amounts', pharmacy_hide_setting)

        # Détails par mode de paiement
        paiements_qs = Caisse.objects.filter(
            facture__poste_vente=poste,
            date_paiement__gte=poste.date_ouverture,
            statut='completee'
        ).exclude(mode_paiement__in=['en_compte', 'depot'])

        details_par_mode = {}
        if not hide_amounts:
            for item in paiements_qs.values('mode_paiement').annotate(total=Sum('montant')):
                if item['total']:
                    details_par_mode[item['mode_paiement']] = float(item['total'])

        rapport = {
            'detail': f'Point de vente {poste.nom} fermé avec succès',
            'poste': {
                'id': poste.id,
                'nom': poste.nom,
                'caisse': poste.caisse.nom if poste.caisse else None,
                'code': poste.caisse.code if poste.caisse else None
            },
            'session': {
                'date_ouverture': poste.date_ouverture,
                'date_fermeture': poste.date_fermeture,
                'fond_de_caisse': float(poste.fond_de_caisse) if poste.fond_de_caisse else 0,
                'montant_encaisse': float(montant_encaisse) if not hide_amounts else None,
                'montant_theorique': float((poste.fond_de_caisse or Decimal('0')) + montant_encaisse) if not hide_amounts else None,
                'montant_masque': hide_amounts
            },
            'transactions': {
                'total': paiements_qs.values('facture').distinct().count(),
                'montant_total': float(montant_encaisse) if not hide_amounts else None
            },
            'details_par_mode': details_par_mode if not hide_amounts else {},
            'hide_amounts': hide_amounts
        }

        return Response(rapport)

    @action(detail=False, methods=['get'], url_path='recap_session')
    def recap_session(self, request):
        """Retourne les totaux en temps réel par mode de paiement pour le poste de vente actif."""
        poste = PosteVente.objects.filter(
            vendeur=request.user,
            est_actif=True
        ).select_related('caisse').first()

        if not poste and request.user.is_superuser:
            postes = list(PosteVente.objects.filter(est_actif=True).select_related('caisse'))
            if not postes:
                return Response({'has_session': False})

            fond_total = sum(Decimal(str(p.fond_de_caisse)) for p in postes if p.fond_de_caisse)
            postes_noms = [p.nom for p in postes]

            filtre_postes = Q()
            for p in postes:
                filtre_postes |= Q(facture__poste_vente=p, date_paiement__gte=p.date_ouverture)

            paiements_qs = Caisse.objects.filter(
                filtre_postes,
                statut='completee'
            ).exclude(mode_paiement__in=['en_compte', 'depot'])

            agg = paiements_qs.aggregate(total=Sum('montant'), count=Count('facture', distinct=True))
            total_general = agg['total'] or Decimal('0')
            nb_transactions = agg['count'] or 0

            details = {}
            for item in paiements_qs.values('mode_paiement').annotate(total=Sum('montant')):
                if item['total']:
                    details[item['mode_paiement']] = float(item['total'])

            date_ouverture = min(p.date_ouverture for p in postes)
            poste_nom = ' + '.join(postes_noms) if len(postes_noms) > 1 else postes_noms[0]

            return Response({
                'has_session': True,
                'poste_nom': poste_nom,
                'date_ouverture': date_ouverture,
                'fond_de_caisse': float(fond_total),
                'total_encaisse': float(total_general),
                'total_avec_fond': float(total_general + fond_total),
                'nb_transactions': nb_transactions,
                'details_par_mode': details,
            })

        if not poste:
            return Response({'has_session': False})

        paiements = Caisse.objects.filter(
            facture__poste_vente=poste,
            date_paiement__gte=poste.date_ouverture,
            statut='completee'
        ).exclude(mode_paiement__in=['en_compte', 'depot'])

        total_general = paiements.aggregate(t=Sum('montant'))['t'] or Decimal('0')
        modes_data = paiements.values('mode_paiement').annotate(total=Sum('montant'))
        details = {
            item['mode_paiement']: float(item['total'])
            for item in modes_data
            if item['total']
        }

        nb_transactions = paiements.values('facture').distinct().count()
        fond = Decimal(str(poste.fond_de_caisse)) if poste.fond_de_caisse else Decimal('0')

        return Response({
            'has_session': True,
            'poste_nom': poste.nom,
            'date_ouverture': poste.date_ouverture,
            'fond_de_caisse': float(fond),
            'total_encaisse': float(total_general),
            'total_avec_fond': float(total_general + fond),
            'nb_transactions': nb_transactions,
            'details_par_mode': details,
        })

    @action(detail=True, methods=['post'], url_path='forcer-fermeture')
    def forcer_fermeture(self, request, pk=None):
        """Force la fermeture d'un poste de vente bloqué."""
        poste = self.get_object()

        if poste.est_actif:
            montant_encaisse = Caisse.objects.filter(
                facture__poste_vente=poste,
                date_paiement__gte=poste.date_ouverture
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0')
            poste.est_actif = False
            poste.date_fermeture = timezone.now()
            poste.montant_total_encaisse = montant_encaisse
            poste.save()

        return Response({
            'detail': f'Le point de vente {poste.nom} a été fermé forcément.',
        })


class SessionCaisseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint en lecture seule pour consulter l'historique des sessions de caisse.
    """
    queryset = PosteVente.objects.all().select_related('caisse', 'vendeur')
    serializer_class = SessionCaisseSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def actives(self, request):
        sessions = self.get_queryset().filter(est_actif=True)
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mes_sessions(self, request):
        sessions = self.get_queryset().filter(vendeur=request.user)
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)
