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

from ..models.planning import ShiftConfig, ShiftSchedule, ShiftAssignment, LeaveRequest
from ..models.communication import InternalMessage
from ..serializers.planning import (
    ShiftConfigSerializer, ShiftScheduleSerializer,
    ShiftAssignmentSerializer, LeaveRequestSerializer,
)
from ..centralized_configs import BaseViewSetConfig


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
        year = schedule.month.year
        month = schedule.month.month
        _, num_days = calendar.monthrange(year, month)

        start_date = datetime.date(year, month, start_day)
        schedule.assignments.filter(date__gte=start_date).delete()

        operators = list(User.objects.filter(
            is_active=True, is_superuser=False
        ).order_by('id'))
        if not operators:
            return

        approved_leaves = LeaveRequest.objects.filter(
            status='APPROVED'
        ).values('user_id', 'start_date', 'end_date')
        leave_map = {}
        for leave in approved_leaves:
            leave_map.setdefault(leave['user_id'], []).append(
                (leave['start_date'], leave['end_date'])
            )

        work_days = config.work_days_before_rest
        rest_days = config.rest_days
        cycle_len = work_days + rest_days
        guard_freq = config.guard_frequency_days
        rotate = config.rotate_shifts

        assignments = []
        for day in range(start_day, num_days + 1):
            date = datetime.date(year, month, day)
            guard_idx = -1
            if guard_freq > 0 and day % guard_freq == 0:
                guard_idx = (day // guard_freq) % len(operators)

            for idx, operator in enumerate(operators):
                # Check leave
                on_leave = False
                if operator.id in leave_map:
                    for start, end in leave_map[operator.id]:
                        if start <= date <= end:
                            on_leave = True
                            break
                if on_leave:
                    assignments.append(ShiftAssignment(
                        schedule=schedule, user=operator,
                        date=date, shift_type='CONGE',
                    ))
                    continue

                offset = idx * (work_days // max(len(operators), 1))
                cycle_pos = (day + offset) % cycle_len

                if cycle_pos < work_days:
                    if guard_idx == idx:
                        shift = 'GARDE'
                    elif rotate:
                        week_num = (day - 1) // 7
                        shift = 'MATIN' if (week_num + idx) % 2 == 0 else 'NUIT'
                    else:
                        shift = 'MATIN'
                    assignments.append(ShiftAssignment(
                        schedule=schedule, user=operator,
                        date=date, shift_type=shift,
                    ))
                else:
                    assignments.append(ShiftAssignment(
                        schedule=schedule, user=operator,
                        date=date, shift_type='REPOS',
                    ))

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

        # Récupérer les opérateurs actifs (non-superuser, actifs)
        operators = list(User.objects.filter(
            is_active=True, is_superuser=False
        ).order_by('id'))

        if not operators:
            return Response(
                {'error': 'Aucun opérateur actif trouvé'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Récupérer les congés approuvés
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

        # Algorithme de rotation
        work_days = config.work_days_before_rest
        rest_days = config.rest_days
        cycle_len = work_days + rest_days
        guard_freq = config.guard_frequency_days
        rotate = config.rotate_shifts

        assignments = []
        for day in range(start_day, num_days + 1):
            date = datetime.date(year, month, day)
            # Un seul gardien par jour de garde (rotation entre opérateurs)
            guard_idx = -1
            if guard_freq > 0 and day % guard_freq == 0:
                guard_idx = (day // guard_freq) % len(operators)

            for idx, operator in enumerate(operators):
                if is_on_leave(operator.id, date):
                    assignments.append(ShiftAssignment(
                        schedule=schedule,
                        user=operator,
                        date=date,
                        shift_type='CONGE',
                    ))
                    continue

                # Calcul du cycle pour cet opérateur
                # Décalage par opérateur pour éviter que tout le monde ait repos le même jour
                offset = idx * (work_days // max(len(operators), 1))
                cycle_pos = (day + offset) % cycle_len

                if cycle_pos < work_days:
                    # Jour de travail
                    if guard_idx == idx:
                        shift = 'GARDE'
                    elif rotate:
                        # Alterner matin/nuit selon la semaine
                        week_num = (day - 1) // 7
                        shift = 'MATIN' if (week_num + idx) % 2 == 0 else 'NUIT'
                    else:
                        shift = 'MATIN'

                    assignments.append(ShiftAssignment(
                        schedule=schedule,
                        user=operator,
                        date=date,
                        shift_type=shift,
                    ))
                else:
                    # Jour de repos
                    assignments.append(ShiftAssignment(
                        schedule=schedule,
                        user=operator,
                        date=date,
                        shift_type='REPOS',
                    ))

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
