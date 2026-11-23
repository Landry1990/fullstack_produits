from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum

from api.audit_helpers import log_audit
from api.models import (
    AuditLog, CompteComptable, EcritureComptable, ExerciceComptable,
    JournalComptable, LigneEcriture,
)


RECLASSEMENTS = {
    '613000': ('622200', 'Locations de bâtiments', ('loyer', 'location')),
    '622000': ('628000', 'Frais de télécommunications', ('internet', 'téléphone', 'telephone')),
}


class Command(BaseCommand):
    help = 'Simule les reclassements de charges sélectionnées ; --apply crée des OD sans modifier les pièces originales.'

    def add_arguments(self, parser):
        parser.add_argument('--ligne', type=int, action='append', required=True)
        parser.add_argument('--apply', action='store_true', dest='apply_changes')

    @transaction.atomic
    def handle(self, *args, **options):
        ids = sorted(set(options['ligne']))
        lignes = list(LigneEcriture.objects.select_for_update(of=('self',)).filter(
            pk__in=ids).select_related('compte', 'ecriture').order_by('pk'))
        if len(lignes) != len(ids):
            raise CommandError('Une des lignes sélectionnées est introuvable.')
        prepared = []
        for ligne in lignes:
            source = ligne.ecriture
            exercice = ExerciceComptable.objects.select_for_update().get(pk=source.exercice_id)
            regle = RECLASSEMENTS.get(ligne.compte.numero)
            if not regle or ligne.debit <= 0 or ligne.credit != 0:
                raise CommandError(f'Ligne {ligne.pk} : compte ou sens non pris en charge.')
            cible, libelle, mots = regle
            texte = f'{source.libelle} {ligne.libelle_ligne}'.lower()
            if not any(mot in texte for mot in mots):
                raise CommandError(f'Ligne {ligne.pk} : nature de la charge à vérifier manuellement.')
            if source.est_liee or not source.is_balanced():
                raise CommandError(f'Pièce {source.pk} : pièce liée ou déséquilibrée, correction manuelle requise.')
            reference = f'RECL-CHARGE-{ligne.pk}'
            existantes = list(EcritureComptable.objects.filter(reference=reference))
            if existantes:
                if len(existantes) != 1:
                    raise CommandError(f'{reference} : corrections multiples à vérifier.')
                correction = existantes[0]
                details = set(correction.lignes.values_list('compte__numero', 'debit', 'credit'))
                attendu = {(cible, ligne.debit, Decimal('0')), (ligne.compte.numero, Decimal('0'), ligne.debit)}
                if correction.date != source.date or correction.exercice_id != exercice.pk or correction.lignes.count() != 2 or details != attendu:
                    raise CommandError(f'{reference} : correction existante incohérente.')
                self.stdout.write(f'{reference} : déjà reclassée, aucune modification.')
                continue
            if exercice.est_cloture or not exercice.date_debut <= source.date <= exercice.date_fin:
                raise CommandError(f'Pièce {source.pk} : exercice clôturé ou date hors exercice.')
            compte = CompteComptable.objects.filter(numero=cible).first()
            if compte and (compte.type != 'CHARGE' or not compte.is_active):
                raise CommandError(f'Compte cible {cible} inactif ou de type incorrect.')
            prepared.append((ligne, exercice, cible, libelle, reference))
            self.stdout.write(f'Ligne {ligne.pk} / pièce {source.pk} / {source.date} : {ligne.compte.numero} → {cible}, {ligne.debit}')
        if not options['apply_changes']:
            self.stdout.write(f'Simulation uniquement : {len(prepared)} reclassement(s), aucune écriture créée.')
            return
        journal, _ = JournalComptable.objects.get_or_create(code='OD', defaults={'nom': 'Opérations diverses'})
        JournalComptable.objects.select_for_update().get(pk=journal.pk)
        for ligne, exercice, cible, libelle, reference in prepared:
            compte, _ = CompteComptable.objects.get_or_create(
                numero=cible, defaults={'libelle': libelle, 'type': 'CHARGE', 'is_active': True})
            correction = EcritureComptable.objects.create(
                date=ligne.ecriture.date, exercice=exercice, journal=journal,
                reference=reference, libelle=f'Reclassement SYSCOHADA - pièce {ligne.ecriture_id} / ligne {ligne.pk}')
            LigneEcriture.objects.create(ecriture=correction, compte=compte, debit=ligne.debit,
                                         libelle_ligne=f'Reclassement de {ligne.compte.numero}')
            LigneEcriture.objects.create(ecriture=correction, compte=ligne.compte, credit=ligne.debit,
                                         libelle_ligne=f'Reclassement vers {cible}')
            audit = log_audit(
                user=None, action=AuditLog.Action.OTHER, model_name='EcritureComptable',
                object_id=correction.pk, description=correction.libelle,
                details={'commande': 'reclasser_charges_syscohada', 'source_ligne_id': ligne.pk,
                         'source_ecriture_id': ligne.ecriture_id, 'ancien_compte': ligne.compte.numero,
                         'nouveau_compte': cible, 'montant': str(ligne.debit),
                         'reference_source': ligne.ecriture.reference})
            if audit is None:
                raise CommandError('Échec de la traçabilité : transaction annulée.')
            self.stdout.write(f'{reference} : OD {correction.numero_piece} créée.')
        for compte in {ligne.compte for ligne, *_ in prepared}:
            if compte.libelle not in ('Loyer', 'Loyer (Bail)', 'Internet & Téléphone'):
                continue
            totaux = compte.lignes.aggregate(debit=Sum('debit'), credit=Sum('credit'))
            if totaux['debit'] == totaux['credit']:
                compte.is_active = False
                compte.save(update_fields=['is_active'])
        self.stdout.write(self.style.SUCCESS(f'{len(prepared)} reclassement(s) appliqué(s). Pièces originales et trésorerie inchangées.'))
