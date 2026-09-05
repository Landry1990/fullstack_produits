from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, F, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from collections import defaultdict

from ..models import Challenge, ChallengeEquipe, ChallengePointTier, Facture, FactureProduit, FactureProduitAllocation, StockLot
from ..serializers.challenges import ChallengeSerializer
from ..pagination import StandardResultsSetPagination


class ChallengeViewSet(viewsets.ModelViewSet):
    """Gestion des challenges commerciaux et classement des vendeurs/équipes."""
    serializer_class = ChallengeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom', 'description']
    filterset_fields = ['statut', 'is_active', 'type_objectif', 'mode', 'source_produits']
    ordering_fields = ['date_debut', 'date_fin', 'created_at']
    ordering = ['-date_debut']

    def get_queryset(self):
        return (
            Challenge.objects
            .select_related('created_by')
            .prefetch_related('participants', 'produits', 'equipes__membres', 'point_tiers')
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def classement(self, request, pk=None):
        """Classement des vendeurs (INDIVIDUEL) ou équipes (EQUIPES) sur le challenge.

        Tri selon type_objectif (CA, BOITES ou POINTS). Si objectif_valeur défini,
        ajoute progression + atteint pour chaque entrée.

        Mode POINTS (Chasse au Trésor Anti-Péremption) :
        - source_produits=AUTO_PEREMPTION : auto-peuple les produits par lots proches de la péremption
        - source_produits=MANUEL : utilise les produits sélectionnés manuellement
        - Points calculés via les FactureProduitAllocation pondérées par urgence (ChallengePointTier)
        """
        challenge = self.get_object()

        # Rétrocompatibilité : défauts si champs non set
        type_objectif = challenge.type_objectif or Challenge.TypeObjectif.CA
        mode = challenge.mode or Challenge.Mode.INDIVIDUEL
        source_produits = challenge.source_produits or Challenge.SourceProduits.MANUEL
        objectif_valeur = challenge.objectif_valeur

        date_debut = challenge.date_debut
        date_fin = challenge.date_fin

        # Vendeurs ciblés
        if challenge.all_users:
            participant_ids = None  # tous
        else:
            participant_ids = list(challenge.participants.values_list('id', flat=True))

        # Factures valides sur la période
        factures_qs = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            is_active=True,
            date__date__gte=date_debut,
            date__date__lte=date_fin,
        )
        if participant_ids is not None:
            factures_qs = factures_qs.filter(created_by_id__in=participant_ids)

        # ------------------------------------------------------------------
        # Mode POINTS : Chasse au Trésor Anti-Péremption
        # ------------------------------------------------------------------
        if type_objectif == Challenge.TypeObjectif.POINTS:
            produit_ids = self._resolve_produits_peremption(challenge, source_produits)
            tiers = list(challenge.point_tiers.order_by('mois_max'))

            # Allocations liées aux ventes de la période sur les produits ciblés
            alloc_qs = FactureProduitAllocation.objects.filter(
                facture_produit__facture__in=factures_qs,
                facture_produit__produit_id__in=produit_ids,
                stock_lot__date_expiration__isnull=False,
            ).select_related('facture_produit__facture', 'stock_lot')

            if mode == Challenge.Mode.EQUIPES:
                classement = self._classement_equipes_points(challenge, alloc_qs, tiers, objectif_valeur)
            else:
                classement = self._classement_individuel_points(alloc_qs, tiers, objectif_valeur)

            return Response({
                'challenge': {
                    'id': challenge.id,
                    'nom': challenge.nom,
                    'date_debut': challenge.date_debut.isoformat(),
                    'date_fin': challenge.date_fin.isoformat(),
                    'statut': challenge.statut,
                    'type_objectif': type_objectif,
                    'objectif_valeur': float(objectif_valeur) if objectif_valeur is not None else None,
                    'mode': mode,
                    'source_produits': source_produits,
                    'peremption_mois': challenge.peremption_mois,
                    'produits_count': len(produit_ids),
                    'point_tiers': [
                        {'mois_max': t.mois_max, 'points': t.points}
                        for t in tiers
                    ],
                },
                'classement': classement,
            })

        # ------------------------------------------------------------------
        # Mode classique : CA / BOITES
        # ------------------------------------------------------------------
        # Produits ciblés (si vide, tous les produits)
        produit_ids = list(challenge.produits.values_list('id', flat=True))

        # Lignes de vente liées aux produits du challenge
        if produit_ids:
            lignes_qs = FactureProduit.objects.filter(
                facture__in=factures_qs,
                produit_id__in=produit_ids,
            )
        else:
            lignes_qs = FactureProduit.objects.filter(facture__in=factures_qs)

        # Construction du classement selon le mode
        if mode == Challenge.Mode.EQUIPES:
            classement = self._classement_equipes(challenge, lignes_qs, type_objectif, objectif_valeur)
        else:
            classement = self._classement_individuel(lignes_qs, type_objectif, objectif_valeur)

        return Response({
            'challenge': {
                'id': challenge.id,
                'nom': challenge.nom,
                'date_debut': challenge.date_debut.isoformat(),
                'date_fin': challenge.date_fin.isoformat(),
                'statut': challenge.statut,
                'type_objectif': type_objectif,
                'objectif_valeur': float(objectif_valeur) if objectif_valeur is not None else None,
                'mode': mode,
                'source_produits': source_produits,
                'peremption_mois': challenge.peremption_mois,
                'produits_count': len(produit_ids),
                'point_tiers': [
                    {'mois_max': t.mois_max, 'points': t.points}
                    for t in challenge.point_tiers.order_by('mois_max')
                ],
            },
            'classement': classement,
        })

    # ------------------------------------------------------------------
    # Helpers de classement
    # ------------------------------------------------------------------
    def _build_entry(self, rang, entity_id, entity_name, entity_type,
                     nb_boites, ca, nb_ventes, objectif_valeur):
        """Construit une entrée du classement avec objectif/progression si défini."""
        entry = {
            'rang': rang,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'entity_type': entity_type,
            'nb_boites': int(nb_boites or 0),
            'ca': float(ca or 0),
            'nb_ventes': int(nb_ventes or 0),
        }
        if objectif_valeur is not None:
            objectif = float(objectif_valeur)
            # Métrique principale selon type_objectif gérée par l'appelant via progression
            entry['objectif'] = objectif
            entry['progression'] = 0.0
            entry['atteint'] = False
        return entry

    def _classement_individuel(self, lignes_qs, type_objectif, objectif_valeur):
        """Agrège les ventes par vendeur."""
        rows = (
            lignes_qs
            .values('facture__created_by_id', 'facture__created_by__username')
            .annotate(
                nb_boites=Coalesce(Sum('quantity'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=0)),
                ca=Coalesce(
                    Sum(F('quantity') * (F('selling_price') - F('discount'))),
                    Value(0),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                nb_ventes=Count('facture', distinct=True),
            )
        )

        # Tri selon la métrique principale
        if type_objectif == Challenge.TypeObjectif.BOITES:
            rows = rows.order_by('-nb_boites')
        else:
            rows = rows.order_by('-ca')

        classement = []
        for rank, row in enumerate(rows, 1):
            entry = self._build_entry(
                rang=rank,
                entity_id=row['facture__created_by_id'],
                entity_name=row['facture__created_by__username'] or '—',
                entity_type='INDIVIDUEL',
                nb_boites=row['nb_boites'],
                ca=row['ca'],
                nb_ventes=row['nb_ventes'],
                objectif_valeur=objectif_valeur,
            )
            if objectif_valeur is not None:
                self._fill_objectif(entry, type_objectif, entry['nb_boites'], entry['ca'])
            classement.append(entry)
        return classement

    def _classement_equipes(self, challenge, lignes_qs, type_objectif, objectif_valeur):
        """Agrège les ventes par équipe (somme des membres)."""
        equipes = list(challenge.equipes.prefetch_related('membres'))
        if not equipes:
            return []

        # Pour chaque équipe, on filtre les lignes sur les membres
        # puis on agrège. On garde aussi les équipes sans ventes (à 0).
        resultats = []
        for equipe in equipes:
            membre_ids = list(equipe.membres.values_list('id', flat=True))
            if not membre_ids:
                resultats.append({
                    'entity_id': equipe.id,
                    'entity_name': equipe.nom,
                    'nb_boites': 0,
                    'ca': Decimal(0),
                    'nb_ventes': 0,
                })
                continue

            lignes_equipe = lignes_qs.filter(facture__created_by_id__in=membre_ids)
            agg = lignes_equipe.aggregate(
                nb_boites=Coalesce(Sum('quantity'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=0)),
                ca=Coalesce(
                    Sum(F('quantity') * (F('selling_price') - F('discount'))),
                    Value(0),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                nb_ventes=Count('facture', distinct=True),
            )
            resultats.append({
                'entity_id': equipe.id,
                'entity_name': equipe.nom,
                'nb_boites': agg['nb_boites'] or 0,
                'ca': agg['ca'] or Decimal(0),
                'nb_ventes': agg['nb_ventes'] or 0,
            })

        # Tri selon la métrique principale
        if type_objectif == Challenge.TypeObjectif.BOITES:
            resultats.sort(key=lambda r: r['nb_boites'], reverse=True)
        else:
            resultats.sort(key=lambda r: r['ca'], reverse=True)

        classement = []
        for rank, r in enumerate(resultats, 1):
            entry = self._build_entry(
                rang=rank,
                entity_id=r['entity_id'],
                entity_name=r['entity_name'],
                entity_type='EQUIPE',
                nb_boites=r['nb_boites'],
                ca=r['ca'],
                nb_ventes=r['nb_ventes'],
                objectif_valeur=objectif_valeur,
            )
            if objectif_valeur is not None:
                self._fill_objectif(entry, type_objectif, entry['nb_boites'], entry['ca'])
            classement.append(entry)
        return classement

    def _fill_objectif(self, entry, type_objectif, nb_boites, ca):
        """Remplit objectif/progression/atteint selon la métrique principale."""
        objectif = entry['objectif']
        if type_objectif == Challenge.TypeObjectif.BOITES:
            valeur = float(nb_boites or 0)
        else:
            valeur = float(ca or 0)
        progression = (valeur / objectif * 100.0) if objectif > 0 else 0.0
        entry['progression'] = round(progression, 2)
        entry['atteint'] = valeur >= objectif

    # ------------------------------------------------------------------
    # Helpers spécifiques au mode POINTS (Chasse au Trésor Anti-Péremption)
    # ------------------------------------------------------------------
    def _resolve_produits_peremption(self, challenge, source_produits):
        """Retourne la liste des produit_ids ciblés par le challenge.

        - AUTO_PEREMPTION : produits ayant au moins un lot non périmé mais
          péremptible dans ≤ peremption_mois mois, avec quantity_remaining > 0.
        - MANUEL : produits sélectionnés via le M2M produits.
        """
        if source_produits == Challenge.SourceProduits.AUTO_PEREMPTION and challenge.peremption_mois:
            today = timezone.now().date()
            future = today + timedelta(days=challenge.peremption_mois * 30)
            return list(
                StockLot.objects.filter(
                    date_expiration__isnull=False,
                    date_expiration__gt=today,
                    date_expiration__lte=future,
                    quantity_remaining__gt=0,
                )
                .exclude(produit__isnull=True)
                .values_list('produit_id', flat=True)
                .distinct()
            )
        # MANUEL (ou AUTO_PEREMPTION sans seuil défini) → produits sélectionnés
        return list(challenge.produits.values_list('id', flat=True))

    def _compute_points_for_allocation(self, allocation, tiers):
        """Calcule les points gagnés pour une allocation donnée.

        - jours_until_peremption = (lot.date_expiration - date_vente).days
        - Trouve le premier tier (trié par mois_max croissant) où
          jours_until_peremption <= tier.mois_max * 30
        - points = tier.points * allocation.quantity
        - Si aucun tier ne matche → 0
        """
        lot = allocation.stock_lot
        if not lot or not lot.date_expiration:
            return 0
        facture = allocation.facture_produit.facture
        date_vente = facture.date.date() if facture.date else None
        if date_vente is None:
            return 0
        jours_until = (lot.date_expiration - date_vente).days
        for tier in tiers:  # déjà trié par mois_max croissant
            if jours_until <= tier.mois_max * 30:
                return tier.points * allocation.quantity
        return 0

    def _build_points_entry(self, rang, entity_id, entity_name, entity_type,
                            points, nb_ventes, objectif_valeur):
        """Construit une entrée du classement pour le mode POINTS."""
        entry = {
            'rang': rang,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'entity_type': entity_type,
            'points': int(points or 0),
            'nb_ventes': int(nb_ventes or 0),
        }
        if objectif_valeur is not None:
            objectif = float(objectif_valeur)
            entry['objectif'] = objectif
            progression = (entry['points'] / objectif * 100.0) if objectif > 0 else 0.0
            entry['progression'] = round(progression, 2)
            entry['atteint'] = entry['points'] >= objectif
        return entry

    def _classement_individuel_points(self, alloc_qs, tiers, objectif_valeur):
        """Agrège les points par vendeur (mode INDIVIDUEL)."""
        # {vendeur_id: {'name': ..., 'points': int, 'nb_ventes': set()}}
        agg = defaultdict(lambda: {'name': '—', 'points': 0, 'nb_ventes': set()})

        for alloc in alloc_qs:
            facture = alloc.facture_produit.facture
            vendeur_id = facture.created_by_id
            if vendeur_id is None:
                continue
            pts = self._compute_points_for_allocation(alloc, tiers)
            agg[vendeur_id]['points'] += pts
            agg[vendeur_id]['name'] = (
                facture.created_by.username if facture.created_by else '—'
            )
            agg[vendeur_id]['nb_ventes'].add(facture.id)

        # Tri par points décroissants
        rows = sorted(agg.items(), key=lambda kv: kv[1]['points'], reverse=True)

        classement = []
        for rank, (vendeur_id, data) in enumerate(rows, 1):
            classement.append(self._build_points_entry(
                rang=rank,
                entity_id=vendeur_id,
                entity_name=data['name'],
                entity_type='INDIVIDUEL',
                points=data['points'],
                nb_ventes=len(data['nb_ventes']),
                objectif_valeur=objectif_valeur,
            ))
        return classement

    def _classement_equipes_points(self, challenge, alloc_qs, tiers, objectif_valeur):
        """Agrège les points par équipe (mode EQUIPES)."""
        equipes = list(challenge.equipes.prefetch_related('membres'))
        if not equipes:
            return []

        # Mapping vendeur_id → équipe_id
        membre_to_equipe = {}
        for equipe in equipes:
            for mid in equipe.membres.values_list('id', flat=True):
                membre_to_equipe[mid] = equipe.id

        # {equipe_id: {'name': ..., 'points': int, 'nb_ventes': set()}}
        agg = {
            eq.id: {'name': eq.nom, 'points': 0, 'nb_ventes': set()}
            for eq in equipes
        }

        for alloc in alloc_qs:
            facture = alloc.facture_produit.facture
            vendeur_id = facture.created_by_id
            equipe_id = membre_to_equipe.get(vendeur_id)
            if equipe_id is None:
                continue
            pts = self._compute_points_for_allocation(alloc, tiers)
            agg[equipe_id]['points'] += pts
            agg[equipe_id]['nb_ventes'].add(facture.id)

        # Tri par points décroissants
        rows = sorted(agg.items(), key=lambda kv: kv[1]['points'], reverse=True)

        classement = []
        for rank, (equipe_id, data) in enumerate(rows, 1):
            classement.append(self._build_points_entry(
                rang=rank,
                entity_id=equipe_id,
                entity_name=data['name'],
                entity_type='EQUIPE',
                points=data['points'],
                nb_ventes=len(data['nb_ventes']),
                objectif_valeur=objectif_valeur,
            ))
        return classement

    # ------------------------------------------------------------------
    # Action : prévisualisation des produits proches de la péremption
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def produits_peremption(self, request):
        """Prévisualise les produits proches de la péremption.

        Paramètre query `mois` (défaut: 6) : seuil en mois.
        Retourne la liste des produits ayant au moins un lot non périmé,
        péremptible dans ≤ mois mois, avec quantity_remaining > 0.
        Déduplique par produit en gardant le lot le plus urgent.
        """
        mois = int(request.query_params.get('mois', 6))
        today = timezone.now().date()
        future = today + timedelta(days=mois * 30)

        lots = (
            StockLot.objects.filter(
                date_expiration__isnull=False,
                date_expiration__gt=today,
                date_expiration__lte=future,
                quantity_remaining__gt=0,
            )
            .exclude(produit__isnull=True)
            .select_related('produit')
            .values(
                'produit_id',
                'produit__name',
                'date_expiration',
                'quantity_remaining',
            )
            .order_by('date_expiration')
        )

        # Dédupliquer par produit, garder le lot le plus urgent (déjà trié asc)
        seen = {}
        for lot in lots:
            pid = lot['produit_id']
            if pid not in seen:
                seen[pid] = lot

        result = []
        for lot in seen.values():
            date_exp = lot['date_expiration']
            jours_restants = (date_exp - today).days if date_exp else None
            result.append({
                'produit_id': lot['produit_id'],
                'produit_nom': lot['produit__name'],
                'date_expiration': date_exp.isoformat() if date_exp else None,
                'jours_restants': jours_restants,
                'quantity_remaining': lot['quantity_remaining'],
            })

        return Response({
            'mois': mois,
            'today': today.isoformat(),
            'future': future.isoformat(),
            'count': len(result),
            'produits': result,
        })
