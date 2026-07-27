"""
Views pour le planning des opérateurs — refonte complète.
"""
import calendar
import datetime

from django.contrib.auth.models import User
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from ..centralized_configs import BaseViewSetConfig
from ..models.communication import InternalMessage
from ..models.planning import LeaveRequest, ShiftAssignment, ShiftConfig, ShiftSchedule
from ..models.users import Profile, Team
from ..serializers.planning import (
    LeaveRequestSerializer,
    ShiftAssignmentSerializer,
    ShiftConfigSerializer,
    ShiftScheduleSerializer,
)

# ── Algorithme de génération ──────────────────────────────────────────────────

def _build_assignments(schedule, config, start_day):
    """
    Génère les affectations du mois en respectant :
    1. Congés approuvés (priorité absolue)
    2. Gardes rotatives (pharmaciens uniquement, équité par comptage)
    3. Repos obligatoire le lendemain d'une garde
    4. Rotation X jours travail / Y jours repos
    5. Alternance équitable Matin/Nuit (si rotate_shifts)
    6. Pas plus de 3 nuits consécutives
    7. Au moins 1 opérateur en Matin et 1 en Nuit par jour (si possible)
    """
    year = schedule.month.year
    month = schedule.month.month
    _, num_days = calendar.monthrange(year, month)

    operators = list(User.objects.filter(
        is_active=True, is_superuser=False
    ).order_by('id'))
    if not operators:
        return []

    # --- Congés approuvés ---
    approved_leaves = LeaveRequest.objects.filter(
        status='APPROVED'
    ).values('user_id', 'start_date', 'end_date')
    leave_map = {}
    for leave in approved_leaves:
        leave_map.setdefault(leave['user_id'], []).append(
            (leave['start_date'], leave['end_date'])
        )

    def is_on_leave(user_id, date):
        if user_id not in leave_map:
            return False
        for start, end in leave_map[user_id]:
            if start <= date <= end:
                return True
        return False

    # --- Pharmaciens (éligibles aux gardes) ---
    pharmacist_ids = set(
        Profile.objects.filter(
            user__in=operators, role='PHARMACIEN'
        ).values_list('user_id', flat=True)
    )

    # --- Compteurs depuis affectations existantes (avant start_day) ---
    existing_counts = ShiftAssignment.objects.filter(
        schedule=schedule, date__lt=datetime.date(year, month, start_day)
    ).values('user_id', 'shift_type').annotate(total=Count('id'))
    counts = {op.id: {'MATIN': 0, 'NUIT': 0, 'GARDE': 0, 'REPOS': 0, 'CONGE': 0} for op in operators}
    for row in existing_counts:
        if row['user_id'] in counts:
            counts[row['user_id']][row['shift_type']] += row['total']

    # --- Historique des gardes déjà posées ---
    guard_by_day = {}
    for g in ShiftAssignment.objects.filter(
        schedule=schedule, shift_type='GARDE'
    ).values('date', 'user_id'):
        guard_by_day[g['date'].day] = g['user_id']

    # --- Dernier shift de chaque opérateur (jour précédent start_day) ---
    start_date = datetime.date(year, month, start_day)
    prev_date = start_date - datetime.timedelta(days=1)
    last_shift = {}
    for a in ShiftAssignment.objects.filter(schedule=schedule, date=prev_date):
        last_shift[a.user_id] = a.shift_type

    # --- Compteur de jours de travail consécutifs ---
    consecutive_work = {op.id: 0 for op in operators}
    # Reconstruire depuis le début du mois jusqu'à start_day - 1
    for d in range(1, start_day):
        date = datetime.date(year, month, d)
        for a in ShiftAssignment.objects.filter(schedule=schedule, date=date):
            if a.shift_type in ('MATIN', 'NUIT', 'GARDE'):
                consecutive_work[a.user_id] = consecutive_work.get(a.user_id, 0) + 1
            else:
                consecutive_work[a.user_id] = 0

    # --- Compteur de nuits consécutives ---
    consecutive_nights = {op.id: 0 for op in operators}
    for d in range(max(1, start_day - 3), start_day):
        date = datetime.date(year, month, d)
        for a in ShiftAssignment.objects.filter(schedule=schedule, date=date):
            if a.shift_type == 'NUIT':
                consecutive_nights[a.user_id] = consecutive_nights.get(a.user_id, 0) + 1
            else:
                consecutive_nights[a.user_id] = 0

    # --- Équipes ---
    use_teams = config.team_mode in ('FIXED', 'ROTATING')
    teams = []
    user_team = {}
    if use_teams:
        teams = list(Team.objects.prefetch_related('members').order_by('ordering', 'name'))
        for idx, team in enumerate(teams):
            for member in team.members.all():
                user_team[member.id] = (idx, team)

    # --- Paramètres ---
    work_days = max(config.work_days_before_rest, 1)
    rest_days = max(config.rest_days, 0)
    cycle_len = work_days + rest_days
    guard_freq = max(config.guard_frequency_days, 0)
    rotate = config.rotate_shifts
    team_rotation_days = max(config.team_rotation_days, 1)
    rotation_cycle = ['MATIN', 'NUIT', 'REPOS']
    max_consecutive_nights = 3

    def team_shift_for_day(team_index, team, day):
        if config.team_mode == 'FIXED':
            return team.default_shift if team.default_shift != 'GARDE' else 'MATIN'
        block = (day - 1) // team_rotation_days
        return rotation_cycle[(team_index + block) % len(rotation_cycle)]

    assignments = []

    for day in range(start_day, num_days + 1):
        date = datetime.date(year, month, day)

        # ── 1. Assignation du gardien (pharmacien) ──
        guard_op = None
        if guard_freq > 0 and day % guard_freq == 0:
            candidates = []
            for op in operators:
                if op.id not in pharmacist_ids:
                    continue
                if is_on_leave(op.id, date):
                    continue
                # Pas de garde dans les guard_freq jours précédents
                too_recent = False
                for d in range(max(1, day - guard_freq + 1), day):
                    if guard_by_day.get(d) == op.id:
                        too_recent = True
                        break
                if too_recent:
                    continue
                candidates.append(op)

            if candidates:
                # Prioriser: moins de gardes → moins de travail total → ID plus petit
                candidates.sort(key=lambda op: (
                    counts[op.id]['GARDE'],
                    counts[op.id]['MATIN'] + counts[op.id]['NUIT'],
                    op.id,
                ))
                guard_op = candidates[0]
                guard_by_day[day] = guard_op.id

        # ── 2. Pré-calcul équipes ──
        team_shifts = {}
        if use_teams:
            for idx, team in enumerate(teams):
                team_shifts[team.id] = team_shift_for_day(idx, team, day)

        # ── 3. Assignation de chaque opérateur ──
        day_matin = []
        day_nuit = []

        for op in operators:
            # Congé approuvé
            if is_on_leave(op.id, date):
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='CONGE',
                ))
                counts[op.id]['CONGE'] += 1
                last_shift[op.id] = 'CONGE'
                consecutive_work[op.id] = 0
                consecutive_nights[op.id] = 0
                continue

            # Garde
            if guard_op and op.id == guard_op.id:
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='GARDE',
                ))
                counts[op.id]['GARDE'] += 1
                last_shift[op.id] = 'GARDE'
                consecutive_work[op.id] += 1
                consecutive_nights[op.id] = 0
                continue

            # Repos obligatoire après garde (jour précédent)
            if guard_by_day.get(day - 1) == op.id:
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='REPOS',
                ))
                counts[op.id]['REPOS'] += 1
                last_shift[op.id] = 'REPOS'
                consecutive_work[op.id] = 0
                consecutive_nights[op.id] = 0
                continue

            # Affectation par équipe
            if use_teams and op.id in user_team:
                _, team = user_team[op.id]
                shift = team_shifts[team.id]
                if shift == 'REPOS':
                    consecutive_work[op.id] = 0
                    consecutive_nights[op.id] = 0
                else:
                    consecutive_work[op.id] += 1
                    consecutive_nights[op.id] = consecutive_nights[op.id] + 1 if shift == 'NUIT' else 0
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type=shift,
                ))
                counts[op.id][shift] += 1
                last_shift[op.id] = shift
                if shift == 'MATIN':
                    day_matin.append(op)
                elif shift == 'NUIT':
                    day_nuit.append(op)
                continue

            # ── Affectation individuelle ──
            # Vérifier si l'opérateur doit être en repos (cycle)
            op_idx = operators.index(op)
            offset = op_idx * (cycle_len // max(len(operators), 1))
            cycle_pos = ((day - 1) + offset) % cycle_len

            if cycle_pos >= work_days:
                # Période de repos
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='REPOS',
                ))
                counts[op.id]['REPOS'] += 1
                last_shift[op.id] = 'REPOS'
                consecutive_work[op.id] = 0
                consecutive_nights[op.id] = 0
                continue

            # Déterminer Matin ou Nuit
            if rotate:
                # Éviter plus de max_consecutive_nights nuits de suite
                if consecutive_nights[op.id] >= max_consecutive_nights or last_shift.get(op.id) == 'NUIT' and consecutive_nights[op.id] >= 2:
                    shift = 'MATIN'
                else:
                    # Équilibrer Matin / Nuit
                    if counts[op.id]['MATIN'] <= counts[op.id]['NUIT']:
                        shift = 'MATIN'
                    else:
                        shift = 'NUIT'
            else:
                shift = 'MATIN'

            assignments.append(ShiftAssignment(
                schedule=schedule, user=op, date=date,
                shift_type=shift,
            ))
            counts[op.id][shift] += 1
            last_shift[op.id] = shift
            consecutive_work[op.id] += 1
            consecutive_nights[op.id] = consecutive_nights[op.id] + 1 if shift == 'NUIT' else 0
            if shift == 'MATIN':
                day_matin.append(op)
            elif shift == 'NUIT':
                day_nuit.append(op)

        # ── 4. Garantir une couverture minimale ──
        # Si pas d'opérateur en matin, prendre un opérateur en repos pour ce jour
        # et le requalifier en MATIN (seulement si pas en congé/garde/repos obligatoire)
        if not day_matin and not day_nuit:
            # Personne travaillant ce jour — essayer de récupérer quelqu'un en repos
            repos_ops = [op for op in operators
                         if any(a.user_id == op.id and a.shift_type == 'REPOS'
                                for a in assignments if a.date == date)]
            if repos_ops:
                # Prendre celui avec le moins de jours travaillés
                repos_ops.sort(key=lambda op: (counts[op.id]['MATIN'] + counts[op.id]['NUIT'], op.id))
                chosen = repos_ops[0]
                # Modifier l'affectation
                for a in assignments:
                    if a.user_id == chosen.id and a.date == date:
                        a.shift_type = 'MATIN'
                        counts[chosen.id]['REPOS'] -= 1
                        counts[chosen.id]['MATIN'] += 1
                        last_shift[chosen.id] = 'MATIN'
                        consecutive_work[chosen.id] += 1
                        consecutive_nights[chosen.id] = 0
                        break

    return assignments


class ShiftConfigViewSet(BaseViewSetConfig, viewsets.ModelViewSet):
    """Configuration des règles de rotation (singleton — 1 seule instance)."""
    queryset = ShiftConfig.objects.all()
    serializer_class = ShiftConfigSerializer

    def get_permissions(self):
        if self.action == 'list':
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def list(self, request, *args, **kwargs):
        """Retourne toujours la première config (ou crée une par défaut)."""
        obj, _created = ShiftConfig.objects.get_or_create(pk=1)
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Update-or-create the singleton config, then auto-regenerate current month."""
        obj, _created = ShiftConfig.objects.update_or_create(
            pk=1, defaults=request.data
        )
        serializer = self.get_serializer(obj)

        # Auto-régénérer le planning du mois en cours (du jour courant à la fin)
        today = datetime.date.today()
        month_start = datetime.date(today.year, today.month, 1)
        schedule = ShiftSchedule.objects.filter(month=month_start).first()
        if schedule:
            self._regenerate_from_day(schedule, obj, today.day)

        return Response(serializer.data, status=status.HTTP_200_OK)

    @staticmethod
    def _regenerate_from_day(schedule, config, start_day):
        """Régénère les affectations du start_day à la fin du mois."""
        start_date = datetime.date(schedule.month.year, schedule.month.month, start_day)
        schedule.assignments.filter(date__gte=start_date).delete()

        assignments = _build_assignments(schedule, config, start_day)
        if assignments:
            ShiftAssignment.objects.bulk_create(assignments)


class ShiftScheduleViewSet(BaseViewSetConfig, viewsets.ModelViewSet):
    """Planning mensuel + affectations."""
    queryset = ShiftSchedule.objects.all()
    serializer_class = ShiftScheduleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filterset_fields = ['month', 'is_published']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def generate(self, request, pk=None):
        """
        Génère automatiquement les affectations pour le mois du planning.
        Règles :
        - Rotation X jours travail / Y jours repos
        - Alternance matin/nuit si rotate_shifts=True
        - Assignation des gardes selon guard_frequency_days
        - Respect des congés approuvés

        Par défaut, préserve les affectations des jours passés (avant aujourd'hui)
        et régénère uniquement d'aujourd'hui à la fin du mois.
        Passer from_day=1 pour régénérer tout le mois.
        """
        schedule = self.get_object()
        config = ShiftConfig.objects.first()
        if not config:
            config = ShiftConfig.objects.create(pk=1)

        year = schedule.month.year
        month = schedule.month.month
        _, _num_days = calendar.monthrange(year, month)

        # Déterminer le jour de départ : par défaut aujourd'hui si on est dans le mois,
        # sinon depuis le 1er (mois passé ou futur)
        today = datetime.date.today()
        if today.year == year and today.month == month:
            start_day = today.day
        else:
            start_day = 1

        # Permettre de forcer la régénération complète avec from_day=1
        from_day_param = request.data.get('from_day') if request.method == 'POST' else None
        if from_day_param is not None:
            try:
                start_day = max(1, int(from_day_param))
            except (ValueError, TypeError):
                pass

        # Supprimer uniquement les affectations à partir de start_day
        start_date = datetime.date(year, month, start_day)
        schedule.assignments.filter(date__gte=start_date).delete()

        assignments = _build_assignments(schedule, config, start_day)
        if not assignments:
            return Response(
                {'error': 'Aucun opérateur actif trouvé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ShiftAssignment.objects.bulk_create(assignments)

        # Recharger avec les relations
        schedule.refresh_from_db()
        serializer = self.get_serializer(schedule)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminUser])
    def publish(self, request, pk=None):
        """Publie le planning (visible par les opérateurs)."""
        schedule = self.get_object()
        schedule.is_published = True
        schedule.save()
        serializer = self.get_serializer(schedule)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_assignment(self, request, pk=None):
        """Met à jour ou crée une affectation pour un jour/opérateur donné."""
        schedule = self.get_object()
        user_id = request.data.get('user_id')
        date_str = request.data.get('date')
        shift_type = request.data.get('shift_type')
        notes = request.data.get('notes', '')

        if not all([user_id, date_str, shift_type]):
            return Response(
                {'error': 'user_id, date et shift_type sont requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            date = datetime.date.fromisoformat(date_str)
            user = User.objects.get(id=user_id)
        except (ValueError, User.DoesNotExist):
            return Response(
                {'error': 'Date ou utilisateur invalide'},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj, created = ShiftAssignment.objects.update_or_create(
            schedule=schedule, user=user, date=date,
            defaults={'shift_type': shift_type, 'notes': notes}
        )
        serializer = ShiftAssignmentSerializer(obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request, pk=None):
        """Statistiques par opérateur pour ce planning (compteurs par shift_type)."""
        schedule = self.get_object()
        stats = schedule.assignments.values(
            'user_id', 'shift_type'
        ).annotate(total=Count('id')).order_by('user_id')

        # Grouper par utilisateur
        user_stats = {}
        for row in stats:
            uid = row['user_id']
            if uid not in user_stats:
                user_stats[uid] = {
                    'user_id': uid,
                    'MATIN': 0, 'NUIT': 0, 'GARDE': 0, 'REPOS': 0, 'CONGE': 0,
                    'total_work': 0,
                }
            user_stats[uid][row['shift_type']] = row['total']
            if row['shift_type'] in ('MATIN', 'NUIT', 'GARDE'):
                user_stats[uid]['total_work'] += row['total']

        # Enrichir avec infos utilisateur
        result = []
        for uid, data in sorted(user_stats.items()):
            try:
                u = User.objects.get(id=uid)
                data['username'] = u.username
                data['full_name'] = (f"{u.first_name} {u.last_name}".strip()) or u.username
            except User.DoesNotExist:
                data['username'] = f'user-{uid}'
                data['full_name'] = f'user-{uid}'
            result.append(data)

        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def send_to_operators(self, request, pk=None):
        """Envoie le planning mensuel de chaque opérateur par message interne."""
        schedule = self.get_object()
        assignments = schedule.assignments.select_related('user').order_by('user__id', 'date')

        user_plannings = {}
        for assignment in assignments:
            user_plannings.setdefault(assignment.user, []).append(assignment)

        month_label = schedule.month.strftime('%m/%Y')
        messages = []
        for user, user_assignments in user_plannings.items():
            lines = [f"Planning {month_label} — {user.first_name or user.username}", "-" * 30]
            for a in user_assignments:
                lines.append(f"{a.date.strftime('%d/%m')}: {a.get_shift_type_display()}")
            content = "\n".join(lines)
            messages.append(InternalMessage(
                sender=request.user,
                recipient=user,
                content=content,
            ))

        InternalMessage.objects.bulk_create(messages)
        return Response({
            'sent': len(messages),
            'month': month_label,
        })


class LeaveRequestViewSet(BaseViewSetConfig, viewsets.ModelViewSet):
    """Demandes de congé."""
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filterset_fields = ['status', 'leave_type']
    ordering = ['-start_date']

    def get_queryset(self):
        qs = super().get_queryset()
        # Non-admin: ne voit que ses propres demandes
        if not self.request.user.is_superuser:
            qs = qs.filter(user=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        """Approuve une demande de congé."""
        leave = self.get_object()
        leave.status = 'APPROVED'
        leave.approved_by = request.user
        leave.approved_at = datetime.datetime.now()
        leave.save()
        serializer = self.get_serializer(leave)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        """Refuse une demande de congé."""
        leave = self.get_object()
        leave.status = 'REJECTED'
        leave.approved_by = request.user
        leave.approved_at = datetime.datetime.now()
        leave.save()
        serializer = self.get_serializer(leave)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_leaves(self, request):
        """Récupère les congés de l'utilisateur connecté."""
        leaves = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(leaves, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def balance(self, request):
        """Calcule le solde de congés pour l'utilisateur connecté."""
        config = ShiftConfig.objects.first()
        annual_days = config.annual_leave_days if config else 26

        used_days = sum(
            l.days_count for l in LeaveRequest.objects.filter(
                user=request.user, status='APPROVED', leave_type='CONGE'
            )
        )
        pending_days = sum(
            l.days_count for l in LeaveRequest.objects.filter(
                user=request.user, status='PENDING', leave_type='CONGE'
            )
        )
        return Response({
            'annual_days': annual_days,
            'used_days': used_days,
            'pending_days': pending_days,
            'remaining_days': annual_days - used_days,
        })
