from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import LoyaltySetting, InvoiceSettings, PharmacySettings, AuditLog, ConfigurationOption
from ..serializers import LoyaltySettingSerializer, InvoiceSettingsSerializer, PharmacySettingsSerializer, ConfigurationOptionSerializer
from ..audit_helpers import log_audit
from ..pagination import StandardResultsSetPagination

# ... (existing classes)

class ConfigurationOptionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for dynamic configuration options.
    """
    queryset = ConfigurationOption.objects.all()
    serializer_class = ConfigurationOptionSerializer
    permission_classes = [permissions.IsAuthenticated] # Read allowed for all, Write restricted if needed elsewhere
    pagination_class = StandardResultsSetPagination
    filterset_fields = ['type', 'code', 'is_active']
    ordering_fields = ['order', 'label']

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='ConfigurationOption',
            object_id=obj.pk,
            description=f"Création option {obj.type}: {obj.label}",
            details=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='ConfigurationOption',
            object_id=obj.pk,
            description=f"Mise à jour option {obj.type}: {obj.label}",
            details=serializer.data,
            request=self.request
        )


class LoyaltySettingViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing loyalty settings.
    Singleton pattern - only one settings object should exist.
    """
    queryset = LoyaltySetting.objects.all()
    serializer_class = LoyaltySettingSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        # Ensure at least one setting exists
        if not LoyaltySetting.objects.exists():
            LoyaltySetting.objects.create()
        # Refresh queryset to include the newly created object if necessary
        self.queryset = LoyaltySetting.objects.all()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # For singleton pattern, always update existing or create if doesn't exist
        obj, created = LoyaltySetting.objects.get_or_create(pk=1)
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        # This should not be called for singleton, but kept for compatibility
        obj, created = LoyaltySetting.objects.update_or_create(
            pk=1,
            defaults=serializer.validated_data
        )
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE if not created else AuditLog.Action.CREATE,
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
        # Always return the first object (singleton pattern)
        obj, created = LoyaltySetting.objects.get_or_create(pk=1)
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
        from django.utils import timezone
        settings, created = PharmacySettings.objects.get_or_create(pk=1)
        serializer = PharmacySettingsSerializer(settings)
        data = serializer.data
        data['server_time'] = timezone.now().isoformat()
        return Response(data)

    def put(self, request):
        settings, created = PharmacySettings.objects.get_or_create(pk=1)
        serializer = PharmacySettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            from django.utils import timezone
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='PharmacySettings',
                object_id=settings.pk,
                description=f"Mise à jour des paramètres de la pharmacie: {settings.pharmacy_name}",
                details=serializer.data,
                request=request
            )
            data = serializer.data
            data['server_time'] = timezone.now().isoformat()
            return Response(data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WhatsAppTestView(APIView):
    """Endpoint pour tester l'envoi d'un message WhatsApp."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import requests as req_lib
        from ..models import PharmacySettings
        ps = PharmacySettings.objects.first()
        phone_id = (ps.whatsapp_phone_id or '').strip() if ps else ''
        token = (ps.whatsapp_access_token or '').strip() if ps else ''
        recipient = request.data.get('numero', '')
        if not recipient:
            return Response({'error': 'Champ "numero" requis'}, status=status.HTTP_400_BAD_REQUEST)
        clean_number = ''.join(filter(str.isdigit, recipient))
        if not phone_id or not token:
            return Response(
                {'status': 'simulation', 'message': 'Credentials manquants en DB — Phone ID ou Token vide'},
                status=status.HTTP_400_BAD_REQUEST
            )
        url = f"https://graph.facebook.com/v25.0/{phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_number,
            "type": "template",
            "template": {
                "name": "hello_world",
                "language": {"code": "en_US"}
            }
        }
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        try:
            resp = req_lib.post(url, headers=headers, json=payload, timeout=10)
            data = resp.json()
            if resp.status_code == 200:
                return Response({'status': 'ok', 'message': 'Message envoyé', 'detail': data})
            return Response(
                {'status': 'error', 'message': data.get('error', {}).get('message', 'Erreur Meta'), 'detail': data},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class TVAViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing VAT rates.
    """
    from ..models import TVA
    from ..serializers import TVASerializer
    
    queryset = TVA.objects.all()
    serializer_class = TVASerializer
    permission_classes = [permissions.IsAuthenticated] # Read/Write for authenticated users (manage in settings)
    pagination_class = StandardResultsSetPagination
    
    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='TVA',
            object_id=obj.pk,
            description=f"Création taux TVA: {obj.taux}%",
            details=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='TVA',
            object_id=obj.pk,
            description=f"Modification taux TVA: {obj.taux}%",
            details=serializer.data,
            request=self.request
        )

    def perform_destroy(self, instance):
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='TVA',
            object_id=instance.pk,
            description=f"Suppression taux TVA: {instance.taux}%",
            request=self.request
        )
        instance.delete()
