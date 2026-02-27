from rest_framework import viewsets, permissions, mixins
from rest_framework.response import Response
from ..models import ConfigurationObjectifs
from ..serializers import ConfigurationObjectifsSerializer

class ConfigurationObjectifsViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for global objective configurations. Since it's a singleton,
    we only allow retrieve and update operations using returning the single instance.
    """
    serializer_class = ConfigurationObjectifsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ConfigurationObjectifs.objects.all()

    def get_object(self):
        # Always return the singleton instance
        return ConfigurationObjectifs.load()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)
