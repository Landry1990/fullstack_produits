"""
Service de détection et fusion de doublons clients.
"""
from decimal import Decimal
import difflib

from django.contrib.postgres.search import TrigramSimilarity
from django.db import transaction


def find_duplicate_candidates(
    name: str | None,
    phone: str | None,
    exclude_id: int | None = None,
    client_type: str | None = None,
):
    """
    Recherche les clients déjà existants qui pourraient être des doublons.
    Renvoie une liste de dictionnaires triés par pertinence.
    """
    from ..models import Client

    candidates = {}

    if phone:
        phone = phone.strip()
        if phone:
            qs = Client.objects.filter(phone__iexact=phone, is_active=True)
            if client_type:
                qs = qs.filter(client_type=client_type)
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
            qs = qs.filter(similarity__gt=0.3, is_active=True)
            if client_type:
                qs = qs.filter(client_type=client_type)
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
    Fusionne le client source dans le client cible et transfère tout
    l'historique métier (ventes, créances, dépôts, avoirs, promis, messages).
    """
    from ..models import (
        AvoirClient,
        Client,
        DepotClient,
        Facture,
        LoyaltyHistory,
        Promis,
        RelevePaiement,
        SmsLog,
        TelegramLog,
        TreatmentReminder,
        WhatsAppLog,
    )
    from ..cache_utils import ClientDebtCache

    if source_id == target_id:
        raise ValueError("Un client ne peut pas être fusionné avec lui-même.")

    clients = {
        client.id: client
        for client in Client.objects.select_for_update().filter(id__in=[source_id, target_id])
    }
    if len(clients) != 2:
        raise Client.DoesNotExist("Client source ou cible introuvable.")
    source = clients[source_id]
    target = clients[target_id]

    if source.client_type != target.client_type:
        raise ValueError("Seuls deux clients du même type peuvent être fusionnés.")

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
    target.delai_paiement_jours = prefer_target(target.delai_paiement_jours, source.delai_paiement_jours)

    for field in ('address', 'phone', 'email', 'niu', 'registre_commerce'):
        if not getattr(target, field) and getattr(source, field):
            setattr(target, field, getattr(source, field))

    target.is_loyalty_member = target.is_loyalty_member or source.is_loyalty_member
    target.is_deposit_enabled = target.is_deposit_enabled or source.is_deposit_enabled

    if not target.message_alerte and source.message_alerte:
        target.message_alerte = source.message_alerte
        target.blocking_alerte = source.blocking_alerte

    target_ayants = {
        (ayant.matricule or '').strip().upper(): ayant
        for ayant in target.ayants_droit.all()
    }
    beneficiaries_moved = 0
    beneficiaries_deduplicated = 0
    for ayant in source.ayants_droit.order_by('id'):
        matricule = (ayant.matricule or '').strip().upper()
        existing = target_ayants.get(matricule) if matricule else None
        if existing:
            Facture.objects.filter(ayant_droit=ayant).update(ayant_droit=existing)
            ayant.delete()
            beneficiaries_deduplicated += 1
        else:
            ayant.client = target
            ayant.save(update_fields=['client'])
            if matricule:
                target_ayants[matricule] = ayant
            beneficiaries_moved += 1

    transferred = {
        'factures': Facture.objects.filter(client=source).update(client=target),
        'releves': RelevePaiement.objects.filter(client=source).update(client=target),
        'promis': Promis.objects.filter(client=source).update(client=target),
        'avoirs': AvoirClient.objects.filter(client=source).update(client=target),
        'depots': DepotClient.objects.filter(client=source).update(client=target),
        'loyalty_history': LoyaltyHistory.objects.filter(client=source).update(client=target),
        'sms_logs': SmsLog.objects.filter(client=source).update(client=target),
        'whatsapp_logs': WhatsAppLog.objects.filter(client=source).update(client=target),
        'telegram_logs': TelegramLog.objects.filter(client=source).update(client=target),
        'rappels_traitement': TreatmentReminder.objects.filter(client=source).update(client=target),
        'ayants_droit': beneficiaries_moved,
        'ayants_droit_dedupliques': beneficiaries_deduplicated,
    }

    target.recalculate_solde(save=False)
    target.save()

    source.merged_into = target
    source.is_active = False
    source.points_fidelite = 0
    source.solde_depot = Decimal('0.00')
    source.pending_discount = Decimal('0.00')
    source.recalculate_solde(save=False)
    source.save(update_fields=[
        'merged_into',
        'is_active',
        'points_fidelite',
        'solde_depot',
        'pending_discount',
        'solde_factures',
        'nombre_factures_impayees',
        'derniere_mise_a_jour_solde',
    ])

    transaction.on_commit(
        lambda: ClientDebtCache.invalidate_client(source.id),
        robust=True,
    )
    transaction.on_commit(
        lambda: ClientDebtCache.invalidate_client(target.id),
        robust=True,
    )

    result = {
        'status': 'success',
        'message': f"{source.name} a été fusionné dans {target.name}.",
        'source_id': source.id,
        'target_id': target.id,
        'target_name': target.name,
        'transferred': transferred,
    }
    return target, result
