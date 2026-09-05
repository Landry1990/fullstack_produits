from datetime import date

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ...models import Challenge, Facture, FactureProduit, FactureProduitAllocation


class DashboardChallengesMixin(viewsets.ViewSet):
    """Résumé des challenges en cours pour le dashboard manager."""

    @action(detail=False, methods=['get'])
    def challenges_summary(self, request):
        """
        GET /api/dashboard/challenges_summary/

        Retourne un résumé des challenges actifs en cours maintenant
        (is_active=True, statut='ENC', date_debut <= today <= date_fin).
        Limité aux 5 plus récents. Tableau vide si aucun.
        """
        today = date.today()
        challenges = (
            Challenge.objects
            .filter(
                is_active=True,
                statut=Challenge.Statut.EN_COURS,
                date_debut__lte=today,
                date_fin__gte=today,
            )
            .select_related('created_by')
            .prefetch_related('participants', 'produits', 'equipes__membres', 'point_tiers')
            .order_by('-date_debut', '-id')[:5]
        )

        # Réutilisation des helpers de classement du ChallengeViewSet
        from ..challenges import ChallengeViewSet
        cv = ChallengeViewSet()

        result = []
        for challenge in challenges:
            result.append(self._summarize_challenge(cv, challenge))

        return Response(result)

    # ------------------------------------------------------------------
    # Helpers internes
    # ------------------------------------------------------------------
    def _summarize_challenge(self, cv, challenge):
        """Construit le résumé d'un challenge en réutilisant la logique de classement."""
        type_objectif = challenge.type_objectif or Challenge.TypeObjectif.CA
        mode = challenge.mode or Challenge.Mode.INDIVIDUEL
        source_produits = challenge.source_produits or Challenge.SourceProduits.MANUEL
        objectif_valeur = challenge.objectif_valeur

        date_debut = challenge.date_debut
        date_fin = challenge.date_fin
        jours_restants = max(0, (date_fin - date.today()).days)

        # Vendeurs ciblés
        if challenge.all_users:
            participant_ids = None
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

        # Calcul du classement selon le type d'objectif
        if type_objectif == Challenge.TypeObjectif.POINTS:
            produit_ids = cv._resolve_produits_peremption(challenge, source_produits)
            tiers = list(challenge.point_tiers.order_by('mois_max'))
            alloc_qs = FactureProduitAllocation.objects.filter(
                facture_produit__facture__in=factures_qs,
                facture_produit__produit_id__in=produit_ids,
                stock_lot__date_expiration__isnull=False,
            ).select_related('facture_produit__facture', 'stock_lot')

            if mode == Challenge.Mode.EQUIPES:
                classement = cv._classement_equipes_points(challenge, alloc_qs, tiers, objectif_valeur)
            else:
                classement = cv._classement_individuel_points(alloc_qs, tiers, objectif_valeur)

            produits_count = len(produit_ids)
        else:
            # Mode classique CA / BOITES
            produit_ids = list(challenge.produits.values_list('id', flat=True))
            if produit_ids:
                lignes_qs = FactureProduit.objects.filter(
                    facture__in=factures_qs,
                    produit_id__in=produit_ids,
                )
            else:
                lignes_qs = FactureProduit.objects.filter(facture__in=factures_qs)

            if mode == Challenge.Mode.EQUIPES:
                classement = cv._classement_equipes(challenge, lignes_qs, type_objectif, objectif_valeur)
            else:
                classement = cv._classement_individuel(lignes_qs, type_objectif, objectif_valeur)

            produits_count = len(produit_ids)

        # Métrique principale selon le type d'objectif
        if type_objectif == Challenge.TypeObjectif.BOITES:
            metric_key = 'nb_boites'
        elif type_objectif == Challenge.TypeObjectif.POINTS:
            metric_key = 'points'
        else:
            metric_key = 'ca'

        # Total de la métrique principale sur l'ensemble du classement
        total = sum(float(entry.get(metric_key, 0) or 0) for entry in classement)

        # Progression globale (capée à 100 si objectif défini)
        progression_globale = 0.0
        if objectif_valeur is not None and float(objectif_valeur) > 0:
            progression_globale = min(100.0, round((total / float(objectif_valeur)) * 100, 2))

        # Top 3 (max 3 entrées)
        top3 = []
        for entry in classement[:3]:
            top3.append({
                'rang': entry['rang'],
                'entity_name': entry['entity_name'],
                'entity_type': entry['entity_type'],
                'valeur': float(entry.get(metric_key, 0) or 0),
                'points': int(entry.get('points', 0) or 0) if type_objectif == Challenge.TypeObjectif.POINTS else 0,
            })

        return {
            'id': challenge.id,
            'nom': challenge.nom,
            'type_objectif': type_objectif,
            'type_objectif_display': challenge.get_type_objectif_display(),
            'mode': mode,
            'mode_display': challenge.get_mode_display(),
            'date_debut': date_debut.isoformat(),
            'date_fin': date_fin.isoformat(),
            'jours_restants': jours_restants,
            'objectif_valeur': float(objectif_valeur) if objectif_valeur is not None else None,
            'source_produits': source_produits,
            'produits_count': produits_count,
            'equipes_count': challenge.equipes.count(),
            'participants_count': challenge.participants.count(),
            'progression_globale': progression_globale,
            'top3': top3,
        }
