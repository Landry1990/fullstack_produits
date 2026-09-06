"""Mixin pour l'action de clôture de caisse (cloturer).
"""
import logging
from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ....audit_helpers import log_audit
from ....models import AuditLog, Caisse, ClotureCaisse, MouvementCaisse
from ...rapports.tz_utils import parse_api_datetime as _parse_iso_datetime

logger = logging.getLogger(__name__)


class CaisseClotureMixin:
    """Action de clôture de caisse pour CaisseViewSet."""

    @action(detail=False, methods=['post'], url_path='cloturer')
    @transaction.atomic
    def cloturer(self, request):
        montant_reel = request.data.get('montant_reel')
        if montant_reel is None:
            return Response({'detail': 'Le montant réel est requis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            montant_reel = Decimal(str(montant_reel))
        except (ValueError, TypeError, InvalidOperation):
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        # Billetage (détail des coupures comptées) — optionnel
        billetage = request.data.get('billetage')
        if billetage is not None and not isinstance(billetage, dict):
            billetage = None

        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        user_id = request.data.get('user_id')
        poste_caisse_id = request.data.get('poste_caisse_id')

        start_date = None
        end_date = None

        if date_debut:
            start_date = _parse_iso_datetime(date_debut)
            if start_date is None:
                logger.error(f"Error parsing date_debut {date_debut}")

        if date_fin:
            end_date = _parse_iso_datetime(date_fin)
            if end_date is None:
                logger.error(f"Error parsing date_fin {date_fin}")

        if not start_date:
            # FIX: Filtrer la dernière clôture par user_id pour éviter de mélanger les caissiers
            if user_id:
                last_cloture = ClotureCaisse.objects.filter(user_id=user_id).order_by('-date').first()
            else:
                last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None

        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement__in=['en_compte', 'depot'])
        if not user_id:
            return Response({'detail': 'Veuillez sélectionner un caissier spécifique pour clôturer.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Caissier introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        transactions = transactions.filter(user_id=user_id)
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
        if poste_caisse_id:
            transactions = transactions.filter(facture__poste_caisse_id=poste_caisse_id)

        # Filtre pour exclure les montants de recouvrement du calcul de clôture journalière
        # NOTE : On n'exclut PLUS le type PROFESSIONNEL ici, car s'ils paient en espèces,
        # l'argent est bien dans la caisse physique du vendeur.
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(reference__icontains='[RECOUV]')
        paiements_sales = transactions.exclude(recouvrement_q)

        # OPTIMISATION : ventes + recouvrement en UNE seule requête agrégée
        ventes_recouv_agg = transactions.aggregate(
            total_ventes=Coalesce(Sum('montant', filter=~recouvrement_q), Value(0, output_field=DecimalField())),
            total_recouv=Coalesce(Sum('montant', filter=recouvrement_q), Value(0, output_field=DecimalField())),
        )
        total_ventes = ventes_recouv_agg['total_ventes']
        # Global breakdown par mode (Ventes + Recouvrements)
        modes_globaux = transactions.exclude(mode_paiement__in=['en_compte', 'depot']).values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(-item['total'] if item['mode_paiement'] == 'coupon' else item['total']) for item in modes_globaux}

        # FIX: Filtrer les mouvements par user_id pour éviter de mélanger les caissiers
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        if user_id:
            mouvements = mouvements.filter(user_id=user_id)

        # OPTIMISATION : ENTREE + SORTIE en UNE seule requête agrégée
        moves_agg = mouvements.aggregate(
            entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
            sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField())),
        )
        total_entrees = moves_agg['entrees']
        total_sorties = moves_agg['sorties']
        # total_ventes inclut déjà tous les modes (espèces, carte, mobile...) hors recouvrement

        # Calcul du CA Divers
        from ....models import FactureProduitAllocation
        facture_ids = paiements_sales.values('facture_id')
        allocations_diverses = FactureProduitAllocation.objects.filter(
            facture_produit__facture_id__in=facture_ids,
            stock_lot__is_divers=True
        )
        total_ca_divers = allocations_diverses.aggregate(
            ca_div=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        )['ca_div'] or Decimal('0.00')
        total_ca_pharmacie = total_ventes - total_ca_divers

        # Récupérer le fond de caisse du dernier poste de vente du caissier
        from ....models import PosteVente
        poste_qs = PosteVente.objects.filter(vendeur=target_user)
        if poste_caisse_id:
            poste_qs = poste_qs.filter(caisse_id=poste_caisse_id)
        last_poste = poste_qs.order_by('-date_ouverture').first()
        fond_de_caisse = Decimal(str(last_poste.fond_de_caisse)) if last_poste and last_poste.fond_de_caisse else Decimal('0.00')

        # Créer les mouvements manuels envoyés par le frontend
        mouvements_manuels_data = request.data.get('mouvements_manuels', [])
        logger.info(f"[CLOTURE] Mouvements manuels reçus pour user={user_id}: {mouvements_manuels_data}")
        mouvements_crees = []
        mouvements_to_create = []
        for mv in mouvements_manuels_data:
            montant_mv = mv.get('montant', 0)
            motif_mv = mv.get('motif')
            logger.info(f"[CLOTURE] Traitement mouvement: montant={montant_mv}, motif={motif_mv}, type={mv.get('type')}")
            if montant_mv > 0 and motif_mv:
                mouvements_to_create.append(MouvementCaisse(
                    type=mv.get('type', 'SORTIE'),
                    montant=Decimal(str(mv['montant'])),
                    motif=mv['motif'],
                    user=target_user,
                    poste_caisse_id=poste_caisse_id,
                    date=end_date or timezone.now()
                ))
        # OPTIMISATION : bulk_create au lieu de N create() individuels
        if mouvements_to_create:
            mouvements_crees = MouvementCaisse.objects.bulk_create(mouvements_to_create)
            for m in mouvements_crees:
                logger.info(f"[CLOTURE] Mouvement créé id={m.pk}, type={m.type}, montant={m.montant}, user={m.user_id}")

        # Recalculer les totaux avec les mouvements manuels créés
        if mouvements_crees:
            mouvements = MouvementCaisse.objects.all()
            if start_date:
                mouvements = mouvements.filter(date__gte=start_date)
            if end_date:
                mouvements = mouvements.filter(date__lte=end_date)
            if user_id:
                mouvements = mouvements.filter(user_id=user_id)
            moves_agg = mouvements.aggregate(
                entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
                sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField())),
            )
            total_entrees = moves_agg['entrees']
            total_sorties = moves_agg['sorties']

        # Vérifier s'il y a au moins un mouvement (ventes, mouvements existants ou manuels)
        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0 and not mouvements_crees:
             return Response({'detail': 'Impossible de clôturer : aucun mouvement détecté depuis la dernière clôture.'}, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier qu'il n'existe pas déjà une clôture couvrant cette même période
        # On utilise des inégalités strictes pour ne pas bloquer deux clôtures
        # journalières contiguës (fin de J = début de J+1 à 00:00).
        doublon_qs = ClotureCaisse.objects.filter(user=target_user)
        if start_date:
            doublon_qs = doublon_qs.filter(date_fin__gt=start_date)
        if end_date:
            doublon_qs = doublon_qs.filter(date_debut__lt=end_date)
        else:
            doublon_qs = doublon_qs.filter(date_debut__lt=timezone.now())
        existing = doublon_qs.order_by('-date').first()
        if existing:
            return Response({
                'detail': f'Une clôture existe déjà pour cette période (#{existing.pk} du {existing.date.strftime("%d/%m/%Y %H:%M")}). Veuillez choisir une autre plage de dates.',
                'existing_cloture_id': existing.pk,
            }, status=status.HTTP_409_CONFLICT)

        # recouv_total déjà calculé via ventes_recouv_agg (1 requête au lieu de 2)
        recouv_total = ventes_recouv_agg['total_recouv']

        # Utiliser le montant théorique calculé côté frontend (déjà inclut fond + ventes + entrées - sorties)
        montant_theorique_frontend = request.data.get('montant_theorique_frontend')
        if montant_theorique_frontend is not None:
            try:
                total_theorique = Decimal(str(montant_theorique_frontend))
            except (ValueError, TypeError, InvalidOperation):
                total_theorique = fond_de_caisse + total_ventes + total_entrees - total_sorties
        else:
            total_theorique = fond_de_caisse + total_ventes + total_entrees - total_sorties
        ecart = montant_reel - total_theorique

        # type: ignore[index] - details is a mixed dict[str, Any] for API response
        details['__meta__'] = {  # type: ignore[index]
            'total_ventes': float(total_ventes),
            'total_recouvrement_especes': float(recouv_total),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties),
            'total_ca_divers': float(total_ca_divers),
            'total_ca_pharmacie': float(total_ca_pharmacie),
            'fond_de_caisse': float(fond_de_caisse)
        }

        mouvements_list = []
        for m in mouvements.select_related('user'):
            mouvements_list.append({'type': m.type, 'montant': float(m.montant), 'motif': m.motif, 'user_nom': m.user.get_full_name() or m.user.username if m.user else "Inconnu", 'date': m.date.isoformat()})
        # type: ignore[index] - details is a mixed dict[str, Any] for API response
        details['mouvements_audit'] = mouvements_list  # type: ignore[index]

        cloture = ClotureCaisse.objects.create(
            montant_reel=montant_reel, montant_theorique=total_theorique, ecart_caisse=ecart,
            total_ventes=total_ventes, total_entrees=total_entrees, total_sorties=total_sorties,
            details_paiement=details, date_debut=start_date, date_fin=end_date,
            user=target_user, cloture_par=request.user if request.user.is_authenticated else None,
            poste_caisse_id=poste_caisse_id,
            billetage=billetage if billetage is not None else {}
        )

        # Fermer le poste de vente s'il est encore actif
        if last_poste and not last_poste.date_fermeture:
            last_poste.date_fermeture = timezone.now()
            last_poste.est_actif = False
            last_poste.save(update_fields=['date_fermeture', 'est_actif'])

        log_audit(user=request.user, action=AuditLog.Action.CLOTURE_CAISSE, model_name='ClotureCaisse', object_id=cloture.pk,  # type: ignore[attr-defined]
            description=f"Clôture de caisse: Théorique={total_theorique:.0f}F, Réel={montant_reel:.0f}F, Écart={ecart:+.0f}F (tous modes)",
            details={'theorique': float(total_theorique), 'reel': float(montant_reel), 'ecart': float(ecart), 'ventes': float(total_ventes), 'entrees': float(total_entrees), 'sorties': float(total_sorties), 'fond_de_caisse': float(fond_de_caisse)},
            request=request
        )

        # Réponse structurée pour matcher l'attente du frontend
        cloture_data = {
            'id': cloture.pk,
            'date': cloture.date.isoformat(),
            'montant_reel': float(montant_reel),
            'montant_theorique': float(total_theorique),
            'ecart_caisse': float(ecart),
            'total_ventes': float(total_ventes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties),
            'total_ca_divers': float(total_ca_divers),
            'total_ca_pharmacie': float(total_ca_pharmacie),
            'fond_de_caisse': float(fond_de_caisse),
            'date_debut': start_date.isoformat() if start_date else None,
            'date_fin': end_date.isoformat() if end_date else None,
            'details': details,
            'billetage': cloture.billetage or {},
            'user': target_user.get_full_name() or target_user.username,
            'mouvements_manuels': [
                {'type': m.type, 'montant': float(m.montant), 'motif': m.motif}
                for m in mouvements_crees
            ]
        }

        return Response({'status': 'success', 'cloture': cloture_data})  # type: ignore[attr-defined]
