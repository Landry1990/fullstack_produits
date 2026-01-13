from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import LoyaltySetting, InvoiceSettings
from ..serializers import LoyaltySettingSerializer, InvoiceSettingsSerializer

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
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
