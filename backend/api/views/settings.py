from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import LoyaltySetting, InvoiceSettings, PharmacySettings, AuditLog
from ..serializers import LoyaltySettingSerializer, InvoiceSettingsSerializer, PharmacySettingsSerializer
from ..audit_helpers import log_audit

class LoyaltySettingViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing loyalty settings.
    Singleton pattern - only one settings object should exist.
    """
    queryset = LoyaltySetting.objects.all()
    serializer_class = LoyaltySettingSerializer
    permission_classes = [permissions.IsAdminUser]

    def list(self, request, *args, **kwargs):
        # Ensure at least one setting exists
        if not self.queryset.exists():
            LoyaltySetting.objects.create()
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='LoyaltySetting',
            object_id=obj.pk,
            description="Mise à jour des paramètres de fidélité",
            details=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='LoyaltySetting',
            object_id=obj.pk,
            description="Mise à jour des paramètres de fidélité",
            details=serializer.data,
            request=self.request
        )

    def get_object(self):
        # Always return the first object
        obj, created = LoyaltySetting.objects.get_or_create(pd=1)
        self.check_object_permissions(self.request, obj)
        return obj


class InvoiceConfigurationView(APIView):
    """
    API View pour gérer la configuration des factures.
    Singleton: récupère ou crée l'unique configuration.
    """
    permission_classes = [IsAuthenticated] # Ou IsAdminUser selon besoins

    def get(self, request):
        config, created = InvoiceSettings.objects.get_or_create(pk=1)
        serializer = InvoiceSettingsSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        config, created = InvoiceSettings.objects.get_or_create(pk=1)
        serializer = InvoiceSettingsSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='InvoiceSettings',
                object_id=config.pk,
                description="Mise à jour de la configuration des factures",
                details=serializer.data,
                request=request
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PharmacySettingsView(APIView):
    """
    API View pour gérer les paramètres de la pharmacie.
    Singleton: récupère ou crée l'unique configuration.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings, created = PharmacySettings.objects.get_or_create(pk=1)
        serializer = PharmacySettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings, created = PharmacySettings.objects.get_or_create(pk=1)
        serializer = PharmacySettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='PharmacySettings',
                object_id=settings.pk,
                description=f"Mise à jour des paramètres de la pharmacie: {settings.name}",
                details=serializer.data,
                request=request
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

