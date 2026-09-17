"""
Service de détection et fusion de doublons clients.
"""
from decimal import Decimal
import difflib

from django.contrib.postgres.search import TrigramSimilarity
from django.db import transaction


def find_duplicate_candidates(name: str | None, phone: str | None, exclude_id: int | None = None):
    """
    Recherche les clients déjà existants qui pourraient être des doublons.
    Renvoie une liste de dictionnaires triés par pertinence.
    """
    from ..models import Client

    candidates = {}

    if phone:
        phone = phone.strip()
        if phone:
            qs = Client.objects.filter(phone__iexact=phone)
            if exclude_id:
                qs = qs.exclude(id=exclude_id)
            for client in qs:
                candidates[client.id] = {
                    'id': client.id,
                    'name': client.name,
                    'client_type': client.client_type,
                    'phone': client.phone,
                    'score': 1.0,
                }

    if name:
        name = name.strip()
        if len(name) >= 3:
            qs = Client.objects.annotate(similarity=TrigramSimilarity('name', name))
            qs = qs.filter(similarity__gt=0.3)
            if exclude_id:
                qs = qs.exclude(id=exclude_id)
            qs = qs.order_by('-similarity')[:10]

            for client in qs:
                ratio = difflib.SequenceMatcher(None, client.name.lower(), name.lower()).ratio()
                score = max(client.similarity or 0, ratio)
                if client.id in candidates:
                    candidates[client.id]['score'] = max(candidates[client.id]['score'], round(score, 2))
                else:
                    candidates[client.id] = {
                        'id': client.id,
                        'name': client.name,
                        'client_type': client.client_type,
                        'phone': client.phone,
                        'score': round(score, 2),
                    }

    return sorted(candidates.values(), key=lambda c: c['score'], reverse=True)[:5]


@transaction.atomic
def merge_clients(source_id: int, target_id: int) -> tuple[object, dict]:
    """
    Fusionne le client source dans le client cible.
    Les factures ne sont PAS déplacées (demande métier).
    """
    from ..models import AvoirClient, Client, DepotClient, LoyaltyHistory

    if source_id == target_id:
        raise ValueError("Un client ne peut pas être fusionné avec lui-même.")

    source = Client.objects.get(id=source_id)
    target = Client.objects.get(id=target_id)

    if source.merged_into_id or target.merged_into_id:
        raise ValueError("Impossible de fusionner un client déjà impliqué dans une fusion.")

    if not target.is_active:
        raise ValueError("Le client cible doit être actif.")

    target.points_fidelite = (target.points_fidelite or 0) + (source.points_fidelite or 0)
    target.solde_depot = (target.solde_depot or Decimal('0.00')) + (source.solde_depot or Decimal('0.00'))

    def prefer_target(target_val, source_val, default=0):
        """Conserve la valeur cible si déjà renseignée, sinon prend la source."""
        t = target_val or default
        s = source_val or default
        if t == default and s != default:
            return s
        return t

    target.pending_discount = prefer_target(target.pending_discount, source.pending_discount)
    target.remise_automatique = prefer_target(target.remise_automatique, source.remise_automatique)
    target.plafond = prefer_target(target.plafond, source.plafond, Decimal('-1.00'))
    target.taux_couverture = prefer_target(target.taux_couverture, source.taux_couverture)
    target.majoration_pro_pourcentage = prefer_target(target.majoration_pro_pourcentage, source.majoration_pro_pourcentage)

    target.is_loyalty_member = target.is_loyalty_member or source.is_loyalty_member
    target.is_deposit_enabled = target.is_deposit_enabled or source.is_deposit_enabled

    if not target.message_alerte and source.message_alerte:
        target.message_alerte = source.message_alerte
        target.blocking_alerte = source.blocking_alerte

    target_matricules = set(
        target.ayants_droit.values_list('matricule', flat=True)
    )
    source.ayants_droit.exclude(matricule__in=target_matricules).update(client=target)

    DepotClient.objects.filter(client=source).update(client=target)
    LoyaltyHistory.objects.filter(client=source).update(client=target)
    AvoirClient.objects.filter(client=source).update(client=target)

    target.save()

    source.merged_into = target
    source.is_active = False
    source.save(update_fields=['merged_into', 'is_active'])

    result = {
        'status': 'success',
        'message': f"{source.name} a été fusionné dans {target.name}.",
        'source_id': source.id,
        'target_id': target.id,
        'target_name': target.name,
    }
    return target, result
