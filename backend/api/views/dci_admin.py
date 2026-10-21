"""
Endpoints admin pour la gestion DCI : import, matching, liaison manuelle,
base médicamenteuse MQ et génériques.
"""
import os
import re
import tempfile
import threading
import uuid
from io import StringIO

from django.core.management import call_command
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ..audit_helpers import log_audit
from ..models import AuditLog, DrugInteraction, MedicamentReference, Produit, Substance
from ..product_pharma_service import invalidate_pharma_cache
from ..utils.validation import parse_id, parse_int


# Registre en mémoire des jobs MQ lancés depuis l'admin (mono-process uvicorn)
MQ_JOBS = {}
MQ_COMMANDS = {
    'relink': ('import_mq_data', {'skip_substances': True, 'skip_interactions': True}),
    'match': ('match_mq_by_name', {}),
    'resolve': ('resolve_mq_stubs', {}),
}
MQ_JOB_TTL_SECONDS = 3600


def _run_mq_job(job_id, action_name):
    from django.db import close_old_connections

    close_old_connections()
    command, kwargs = MQ_COMMANDS[action_name]
    out = StringIO()
    job = MQ_JOBS[job_id]
    job['status'] = 'running'
    try:
        call_command(command, stdout=out, **kwargs)
        job['status'] = 'done'
    except Exception as exc:  # noqa: BLE001 — remonter l'erreur dans l'UI
        job['status'] = 'error'
        job['error'] = str(exc)
    finally:
        job['output'] = out.getvalue()[-8000:]
        close_old_connections()


class DCIAdminViewSet(viewsets.ViewSet):
    """Admin DCI : stats, upload, auto-match, produits non liés, liaison manuelle."""
    # Endpoints d'administration (upload Excel ANSM, auto-match, liaison manuelle) :
    # réservés au staff, cohérent avec la route frontend /app/import-dci (AdminRoute).
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total_substances = Substance.objects.count()
        total_meds = MedicamentReference.objects.count()
        total_produits = Produit.objects.filter(is_active=True).count()
        linked_produits = Produit.objects.filter(
            Q(substances__isnull=False) | Q(dci_reference__isnull=False),
            is_active=True
        ).distinct().count()
        unlinked_produits = total_produits - linked_produits

        return Response({
            'substances': total_substances,
            'medicament_references': total_meds,
            'total_produits': total_produits,
            'linked_produits': linked_produits,
            'unlinked_produits': unlinked_produits,
            'link_rate': round((linked_produits / total_produits * 100), 1) if total_produits else 0,
            # Base médicamenteuse MQ
            'mq_interactions': DrugInteraction.objects.count(),
            'mq_stub_substances': Substance.objects.filter(nom__startswith='MQ-').count(),
            'products_with_atc': Produit.objects.exclude(
                Q(code_atc__isnull=True) | Q(code_atc=''), is_active=True
            ).count(),
        })

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_compo(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        # Sauvegarde temporaire
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            # Utilise la commande existante import_substances (logique inline ici)
            created = 0
            skipped = 0
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            lines = []
            for enc in encodings:
                try:
                    with open(tmp_path, 'r', encoding=enc) as f:
                        lines = f.readlines()
                    break
                except UnicodeDecodeError:
                    continue

            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split('\t')
                if len(parts) >= 2:
                    parts[0].strip()
                    nom = parts[1].strip()
                    if nom:
                        _, was_created = Substance.objects.get_or_create(
                            nom__iexact=nom,
                            defaults={'nom': nom.upper()}
                        )
                        if was_created:
                            created += 1
                        else:
                            skipped += 1

            log_audit(
                user=request.user,
                action=AuditLog.Action.OTHER,
                model_name='Substance',
                object_id='BULK',
                description=f"Import composition DCI « {file.name} » : {created} substance(s) créées, {skipped} existantes",
                details={'filename': file.name, 'created': created, 'skipped': skipped},
                request=request,
            )

            return Response({
                'created': created,
                'skipped': skipped,
                'total': created + skipped,
            })
        finally:
            os.unlink(tmp_path)

    @action(detail=False, methods=['post'])
    def auto_match(self, request):
        """Lance le matching automatique produit ↔ substance et retourne les résultats."""
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        try:
            call_command('link_dci_produits', stdout=out)
            output = out.getvalue()
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Parse la sortie texte
        linked = 0
        for line in output.split('\n'):
            if 'lié' in line.lower() or 'linked' in line.lower():
                m = re.search(r'(\d+)', line)
                if m:
                    linked = int(m.group(1))

        # Stats post-match
        total = Produit.objects.filter(is_active=True).count()
        linked_total = Produit.objects.filter(
            Q(substances__isnull=False) | Q(dci_reference__isnull=False),
            is_active=True
        ).distinct().count()

        log_audit(
            user=request.user,
            action=AuditLog.Action.OTHER,
            model_name='Produit',
            object_id='BULK',
            description=f"Auto-match DCI lancé : {linked} nouveau(x) lien(s), {linked_total} produit(s) lié(s) au total",
            details={
                'newly_linked': linked,
                'total_linked': linked_total,
                'total_produits': total,
            },
            request=request,
        )

        return Response({
            'output': output,
            'newly_linked': linked,
            'total_linked': linked_total,
            'total_produits': total,
            'link_rate': round((linked_total / total * 100), 1) if total else 0,
        })

    @action(detail=False, methods=['get'])
    def unlinked(self, request):
        """Liste des produits actifs sans DCI, avec suggestions de substances."""
        page = parse_int(request.query_params.get('page', 1), field='page', min_value=1, max_value=100000)
        page_size = parse_int(request.query_params.get('page_size', 50), field='page_size', min_value=1, max_value=500)
        search = request.query_params.get('search', '')

        qs = Produit.objects.filter(
            dci_reference__isnull=True,
            substances__isnull=True,
            is_active=True
        )
        if search:
            qs = qs.filter(name__icontains=search)

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        produits = qs[start:end]

        results = []
        for p in produits:
            # Suggestion : substance dont le nom est contenu dans le nom du produit.
            # On pré-filtre en SQL sur le mot le plus long (>= 4 car.) pour éviter
            # de scanner toute la table en Python (58k+ lignes après import MQ).
            suggestion = None
            words = [w for w in re.split(r'\W+', p.name.upper()) if len(w) >= 4]
            if words:
                candidates = Substance.objects.filter(
                    nom__icontains=max(words, key=len)
                )[:25]
                for sub in candidates:
                    if sub.nom.upper() in p.name.upper():
                        suggestion = {'id': sub.id, 'nom': sub.nom}
                        break
            # Fallback : chercher dans MedicamentReference
            if not suggestion:
                med = MedicamentReference.objects.filter(nom__icontains=p.name.split()[0] if p.name else '').first()
                if med and med.substances:
                    first_sub = med.substances.split(';')[0].strip()
                    sub = Substance.objects.filter(nom__iexact=first_sub).first()
                    if sub:
                        suggestion = {'id': sub.id, 'nom': sub.nom}

            results.append({
                'id': p.id,
                'name': p.name,
                'cip1': p.cip1,
                'stock': p.stock,
                'selling_price': p.selling_price,
                'suggestion': suggestion,
            })

        return Response({
            'results': results,
            'count': total,
            'page': page,
            'page_size': page_size,
        })

    @action(detail=False, methods=['post'])
    def manual_link(self, request):
        """Lie manuellement un produit à une ou plusieurs substances."""
        produit_id = request.data.get('produit_id')
        substance_ids = request.data.get('substance_ids', [])
        dci_reference_id = request.data.get('dci_reference_id')

        if not produit_id:
            return Response({'error': 'produit_id requis'}, status=status.HTTP_400_BAD_REQUEST)

        # id non entier → 400 au lieu d'un ValueError → 500 dans get(pk=...)
        produit_id = parse_id(produit_id, field='produit_id')

        try:
            produit = Produit.objects.get(pk=produit_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)

        added_names = []
        if substance_ids:
            if not isinstance(substance_ids, list):
                return Response({'error': 'substance_ids doit être une liste d\'identifiants'}, status=status.HTTP_400_BAD_REQUEST)
            parsed_ids = {parse_id(sid, field='substance_ids') for sid in substance_ids}
            # Union additive : ne JAMAIS écraser les liens existants (set()
            # supprimerait silencieusement les substances importées de MQ/ANSM).
            existing = set(produit.substances.values_list('id', flat=True))
            missing = parsed_ids - set(
                Substance.objects.filter(id__in=parsed_ids).values_list('id', flat=True)
            )
            if missing:
                return Response(
                    {'error': f'Substance(s) introuvable(s) : {sorted(missing)}'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            to_add = parsed_ids - existing
            if to_add:
                produit.substances.add(*to_add)
            added_names = list(
                Substance.objects.filter(id__in=to_add).values_list('nom', flat=True)
            )
        if dci_reference_id:
            produit.dci_reference_id = parse_id(dci_reference_id, field='dci_reference_id')
            produit.save(update_fields=['dci_reference'])

        invalidate_pharma_cache(produit.pk)

        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='Produit',
            object_id=produit.pk,
            description=f"Liaison DCI manuelle du produit « {produit.name} » (#{produit.pk})",
            details={
                'substance_ids': substance_ids,
                'substances_added': added_names,
                'dci_reference_id': produit.dci_reference_id,
            },
            request=request,
        )

        return Response({
            'success': True,
            'produit': produit.name,
            'substances': list(produit.substances.values_list('nom', flat=True)),
            'dci_reference': produit.dci_reference.nom if produit.dci_reference else None,
        })

    # ------------------------------------------------------------------
    # Base médicamenteuse MQ (import/matching lancés en tâche de fond)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'])
    def mq_run(self, request):
        """Lance une commande MQ en tâche de fond et retourne un job_id.

        actions : ``relink`` (liaison produits rapide), ``match`` (match par nom),
        ``resolve`` (résolution des stubs MQ-…).
        """
        action_name = request.data.get('action')
        if action_name not in MQ_COMMANDS:
            return Response(
                {'error': f"action inconnue, attendu l'un de {list(MQ_COMMANDS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Nettoie les vieux jobs
        import time
        now = time.time()
        for jid in [j for j, v in MQ_JOBS.items()
                    if now - v.get('started', 0) > MQ_JOB_TTL_SECONDS]:
            MQ_JOBS.pop(jid, None)

        # Refuse si un job du même type tourne déjà
        for jid, job in MQ_JOBS.items():
            if job['action'] == action_name and job['status'] == 'running':
                return Response({'job_id': jid, 'status': 'running', 'already': True})

        job_id = uuid.uuid4().hex[:12]
        MQ_JOBS[job_id] = {
            'action': action_name,
            'status': 'queued',
            'started': now,
            'output': '',
        }
        threading.Thread(
            target=_run_mq_job, args=(job_id, action_name), daemon=True,
        ).start()

        log_audit(
            user=request.user,
            action=AuditLog.Action.OTHER,
            model_name='Substance',
            object_id='BULK',
            description=f"Job MQ « {action_name} » lancé depuis l'admin DCI",
            details={'action': action_name, 'job_id': job_id},
            request=request,
        )
        return Response({'job_id': job_id, 'status': 'queued'})

    @action(detail=False, methods=['get'])
    def mq_job(self, request):
        """Statut d'un job MQ lancé via mq_run."""
        job_id = request.query_params.get('job_id')
        job = MQ_JOBS.get(job_id)
        if not job:
            return Response({'error': 'job introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'job_id': job_id,
            'action': job['action'],
            'status': job['status'],
            'output': job.get('output', ''),
            'error': job.get('error'),
        })

    # ------------------------------------------------------------------
    # Génériques — gestion manuelle
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def generiques(self, request):
        """Génériques du produit : liens déclarés (produit_reference) et produits
        partageant au moins une substance / DCI.

        Chaque ligne indique ``declared`` (lien générique explicite, réversible
        via unlink_generic) et ``shared`` (substances communes — indicatif).
        """
        produit_id = parse_id(request.query_params.get('produit_id'), field='produit_id')
        try:
            produit = Produit.objects.get(pk=produit_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)

        substance_ids = set(produit.substances.values_list('id', flat=True))
        filters = [Q(produit_reference_id=produit.pk)]
        if produit.produit_reference_id:
            # Le princeps du produit + ses autres génériques déclarés
            filters.append(Q(pk=produit.produit_reference_id))
            filters.append(Q(produit_reference_id=produit.produit_reference_id))
        if substance_ids:
            filters.append(Q(substances__id__in=substance_ids))
        if produit.dci_reference_id:
            filters.append(Q(dci_reference_id=produit.dci_reference_id))

        combined = filters[0]
        for f in filters[1:]:
            combined |= f

        qs = (
            Produit.objects.filter(combined, is_active=True)
            .exclude(pk=produit.pk)
            .prefetch_related('substances')
            .distinct()
            .order_by('name')[:50]
        )
        return Response({
            'results': [
                {
                    'id': p.id,
                    'name': p.name,
                    'cip1': p.cip1,
                    'stock': p.stock,
                    'selling_price': str(p.selling_price),
                    'declared': p.produit_reference_id == produit.pk,
                    'shared': [
                        s.nom for s in p.substances.all() if s.id in substance_ids
                    ],
                }
                for p in qs
            ]
        })

    @action(detail=False, methods=['post'])
    def link_generic(self, request):
        """Déclare ``generic_id`` comme générique de ``produit_id``.

        - Marque la provenance : ``produit_reference`` + ``is_generic``
          (c'est ce qui rend le lien réversible via unlink_generic).
        - Ajoute (union) les substances de la référence — jamais de
          suppression de liens existants.
        - Copie ``dci_reference`` seulement si le générique n'en a pas.
        Refusé si le générique est inactif ou déjà déclaré générique d'un
        autre produit (pas d'écrasement silencieux de provenance).
        """
        produit_id = parse_id(request.data.get('produit_id'), field='produit_id')
        generic_id = parse_id(request.data.get('generic_id'), field='generic_id')
        if produit_id == generic_id:
            return Response(
                {'error': 'Un produit ne peut pas être son propre générique'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            reference = Produit.objects.get(pk=produit_id)
            generic = Produit.objects.get(pk=generic_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if not generic.is_active:
            return Response(
                {'error': f'« {generic.name} » est inactif (corbeille) — impossible de le déclarer générique'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if generic.produit_reference_id and generic.produit_reference_id != reference.pk:
            return Response(
                {'error': (
                    f'« {generic.name} » est déjà déclaré générique de '
                    f'« {generic.produit_reference.name} » — retirez ce lien d\'abord'
                )},
                status=status.HTTP_409_CONFLICT,
            )
        if reference.produit_reference_id == generic.pk:
            return Response(
                {'error': 'Lien circulaire impossible : la référence est déjà générique de ce produit'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ref_substances = list(reference.substances.all())
        if not ref_substances and reference.dci_reference:
            ref_substances = [reference.dci_reference]
        if not ref_substances:
            return Response(
                {'error': 'Le produit de référence n\'a aucune substance liée — liez-le d\'abord à une DCI'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Garde-fou : si le générique possède déjà des substances et qu'AUCUNE
        # ne coïncide avec la référence, le lien est très probablement une
        # erreur (principes actifs différents) → confirmation explicite requise.
        ref_ids = {s.id for s in ref_substances}
        existing = generic.substances.all()
        existing_ids = {s.id for s in existing}
        if existing_ids and not (existing_ids & ref_ids) and not request.data.get('force'):
            return Response(
                {
                    'error': (
                        'Aucune substance commune : « '
                        f'{generic.name} » a déjà d\'autres principes actifs que « {reference.name} »'
                    ),
                    'requires_confirmation': True,
                    'reference_substances': [s.nom for s in ref_substances],
                    'generic_substances': [s.nom for s in existing],
                },
                status=status.HTTP_409_CONFLICT,
            )

        to_add = [s for s in ref_substances if s.id not in existing_ids]
        if to_add:
            generic.substances.add(*to_add)
            # Mémorise les substances ajoutées par le lien : unlink_generic ne
            # doit retirer que celles-ci (jamais les liens pré-existants).
            generic.generic_link_substances = sorted(
                set(generic.generic_link_substances or []) | {s.id for s in to_add}
            )

        changed = {
            'substances_added': [s.nom for s in to_add],
            'dci_reference_copied': False,
        }
        if reference.dci_reference_id and not generic.dci_reference_id:
            generic.dci_reference = reference.dci_reference
            changed['dci_reference_copied'] = True
        generic.produit_reference = reference
        generic.is_generic = True
        generic.save(update_fields=[
            'produit_reference', 'is_generic', 'dci_reference',
            'generic_link_substances',
        ])
        invalidate_pharma_cache(reference.pk, generic.pk)

        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='Produit',
            object_id=generic.pk,
            description=(
                f"Générique manuel : « {generic.name} » (#{generic.pk}) lié à "
                f"« {reference.name} » (#{reference.pk})"
            ),
            details={
                'reference_id': reference.pk,
                'generic_id': generic.pk,
                **changed,
            },
            request=request,
        )
        return Response({'success': True, 'generic': generic.name, **changed})

    @action(detail=False, methods=['post'])
    def unlink_generic(self, request):
        """Retire un lien générique DÉCLARÉ (produit_reference = produit_id).

        Refuse si le lien n'a pas été déclaré via link_generic — on ne
        supprime jamais des substances qui auraient été liées par import
        ou liaison manuelle directe (données cliniques).
        Retire : produit_reference, is_generic, la dci_reference copiée
        (si identique à celle de la référence) et uniquement les substances
        ajoutées par le lien (tracées dans generic_link_substances).
        """
        produit_id = parse_id(request.data.get('produit_id'), field='produit_id')
        generic_id = parse_id(request.data.get('generic_id'), field='generic_id')
        try:
            reference = Produit.objects.get(pk=produit_id)
            generic = Produit.objects.get(pk=generic_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if generic.produit_reference_id != reference.pk:
            return Response(
                {'error': (
                    f'« {generic.name} » n\'est pas un générique déclaré de '
                    f'« {reference.name} » — ses liens de substances ne sont pas modifiés'
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ne retire que les substances réellement ajoutées par link_generic
        # (tracées à la liaison) — les substances pré-existantes, liées par
        # import ou liaison manuelle, sont conservées.
        link_added_ids = set(generic.generic_link_substances or [])
        still_present = (
            list(generic.substances.filter(id__in=link_added_ids))
            if link_added_ids else []
        )
        removed_names = [s.nom for s in still_present]
        if still_present:
            generic.substances.remove(*still_present)

        dci_cleared = bool(
            generic.dci_reference_id
            and generic.dci_reference_id == reference.dci_reference_id
        )
        generic.produit_reference = None
        generic.is_generic = False
        generic.generic_link_substances = []
        if dci_cleared:
            generic.dci_reference = None
        generic.save(update_fields=[
            'produit_reference', 'is_generic', 'dci_reference',
            'generic_link_substances',
        ])
        invalidate_pharma_cache(reference.pk, generic.pk)

        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='Produit',
            object_id=generic.pk,
            description=(
                f"Générique manuel retiré : « {generic.name} » (#{generic.pk}) "
                f"délié de « {reference.name} » (#{reference.pk})"
            ),
            details={
                'reference_id': reference.pk,
                'generic_id': generic.pk,
                'substances_removed': removed_names,
                'dci_reference_cleared': dci_cleared,
            },
            request=request,
        )
        return Response({'success': True, 'removed': removed_names})

