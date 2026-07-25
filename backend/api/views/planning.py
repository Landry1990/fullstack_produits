# -*- coding: utf-8 -*-
"""
Views pour le planning des opérateurs.
"""
import calendar
import datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.contrib.auth.models import User

from django.db.models import Count

from ..models.planning import ShiftConfig, ShiftSchedule, ShiftAssignment, LeaveRequest
from ..models.communication import InternalMessage
from ..models.users import Profile, Team
from ..serializers.planning import (
    ShiftConfigSerializer, ShiftScheduleSerializer,
    ShiftAssignmentSerializer, LeaveRequestSerializer,
)
from ..centralized_configs import BaseViewSetConfig


def _build_assignments(schedule, config, start_day):
    """Génère les affectations du mois respectant congés, garde, équité et équipes."""
    year = schedule.month.year
    month = schedule.month.month
    _, num_days = calendar.monthrange(year, month)

    operators = list(User.objects.filter(
        is_active=True, is_superuser=False
    ).order_by('id'))
    if not operators:
        return []

    # Congés approuvés
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

    # Pharmaciens diplômés
    pharmacist_ids = set(
        Profile.objects.filter(
            user__in=operators, role='PHARMACIEN'
        ).values_list('user_id', flat=True)
    )

    # Compteurs existants (affectations déjà en base, utile en régénération partielle)
    existing_counts = ShiftAssignment.objects.filter(
        schedule=schedule
    ).values('user_id', 'shift_type').annotate(total=Count('id'))
    counts = {op.id: {'MATIN': 0, 'NUIT': 0, 'GARDE': 0, 'REPOS': 0, 'CONGE': 0} for op in operators}
    for row in existing_counts:
        counts[row['user_id']][row['shift_type']] += row['total']

    # Gardes déjà posées (pour éviter garde jour J puis jour J+1 sans repos)
    guard_by_day = {}
    for g in ShiftAssignment.objects.filter(
        schedule=schedule, shift_type='GARDE'
    ).values('date', 'user_id'):
        guard_by_day[g['date'].day] = g['user_id']

    # Dernier shift connu (jour précédent le start_day si on régénère à partir d'un jour > 1)
    start_date = datetime.date(year, month, start_day)
    prev_date = start_date - datetime.timedelta(days=1)
    last_shift = {}
    try:
        for a in ShiftAssignment.objects.filter(schedule=schedule, date=prev_date):
            last_shift[a.user_id] = a.shift_type
    except ValueError:
        pass

    # Chargement des équipes et appartenances
    use_teams = config.team_mode in ('FIXED', 'ROTATING')
    teams = []
    user_team = {}
    if use_teams:
        teams = list(Team.objects.prefetch_related('members').order_by('ordering', 'name'))
        for idx, team in enumerate(teams):
            for member in team.members.all():
                user_team[member.id] = (idx, team)

    op_index = {op.id: idx for idx, op in enumerate(operators)}
    work_days = max(config.work_days_before_rest, 1)
    rest_days = max(config.rest_days, 0)
    cycle_len = work_days + rest_days
    guard_freq = max(config.guard_frequency_days, 0)
    rotate = config.rotate_shifts
    team_rotation_days = max(config.team_rotation_days, 1)
    rotation_cycle = ['MATIN', 'NUIT', 'REPOS']

    def team_shift_for_day(team_index, team, day):
        if config.team_mode == 'FIXED':
            return team.default_shift if team.default_shift != 'GARDE' else 'MATIN'
        # ROTATING : chaque équipe tourne sur MATIN/NUIT/REPOS
        block = (day - 1) // team_rotation_days
        return rotation_cycle[(team_index + block) % len(rotation_cycle)]

    assignments = []

    for day in range(start_day, num_days + 1):
        date = datetime.date(year, month, day)

        # Choix du gardien pour le jour (toujours un pharmacien, indépendamment de l'équipe)
        guard_op = None
        if guard_freq > 0 and day % guard_freq == 0:
            candidates = []
            for op in operators:
                if op.id not in pharmacist_ids:
                    continue
                if is_on_leave(op.id, date):
                    continue
                # Pas de garde trop rapprochée
                already = False
                for d in range(day - guard_freq + 1, day):
                    if guard_by_day.get(d) == op.id:
                        already = True
                        break
                if already:
                    continue
                candidates.append(op)

            if candidates:
                candidates.sort(key=lambda op: (
                    counts[op.id]['GARDE'],
                    counts[op.id]['MATIN'] + counts[op.id]['NUIT'],
                    op.id,
                ))
                guard_op = candidates[0]
                guard_by_day[day] = guard_op.id

        # Pré-calcul du poste de chaque équipe pour le jour (mode équipe)
        team_shifts = {}
        if use_teams:
            for idx, team in enumerate(teams):
                team_shifts[team.id] = team_shift_for_day(idx, team, day)

        for op in operators:
            if is_on_leave(op.id, date):
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='CONGE',
                ))
                counts[op.id]['CONGE'] += 1
                last_shift[op.id] = 'CONGE'
                continue

            if guard_op and op.id == guard_op.id:
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='GARDE',
                ))
                counts[op.id]['GARDE'] += 1
                last_shift[op.id] = 'GARDE'
                continue

            # Repos obligatoire le lendemain d'une garde
            if guard_by_day.get(day - 1) == op.id:
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='REPOS',
                ))
                counts[op.id]['REPOS'] += 1
                last_shift[op.id] = 'REPOS'
                continue

            # Affectation par équipe
            if use_teams and op.id in user_team:
                _, team = user_team[op.id]
                shift = team_shifts[team.id]
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type=shift,
                ))
                counts[op.id][shift] += 1
                last_shift[op.id] = shift
                continue

            # Affectation individuelle (mode INDIVIDUAL ou opérateur sans équipe)
            idx = op_index[op.id]
            offset = idx * (cycle_len // max(len(operators), 1))
            cycle_pos = ((day - 1) + offset) % cycle_len

            if cycle_pos < work_days:
                if rotate:
                    # Éviter deux nuits de suite
                    if last_shift.get(op.id) == 'NUIT':
                        shift = 'MATIN'
                    else:
                        # Équilibre MATIN / NUIT
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
            else:
                assignments.append(ShiftAssignment(
                    schedule=schedule, user=op, date=date,
                    shift_type='REPOS',
                ))
                counts[op.id]['REPOS'] += 1
                last_shift[op.id] = 'REPOS'

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
        _, num_days = calendar.monthrange(year, month)

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
