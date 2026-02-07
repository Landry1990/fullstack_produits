from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from ..models import ObjectifCommercial
from ..serializers import ObjectifCommercialSerializer

class ObjectifViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des objectifs commerciaux.
    """
    queryset = ObjectifCommercial.objects.all()
    serializer_class = ObjectifCommercialSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        periode = self.request.query_params.get('periode')
        if periode:
            queryset = queryset.filter(periode=periode)
        return queryset

    @action(detail=False, methods=['get'])
    def courants(self, request):
        """
        Récupère les objectifs actuels (jour, semaine, mois).
        """
        objectifs = ObjectifCommercial.get_objectifs_courants()
        data = {
            'jour': ObjectifCommercialSerializer(objectifs['jour']).data if objectifs['jour'] else None,
            'semaine': ObjectifCommercialSerializer(objectifs['semaine']).data if objectifs['semaine'] else None,
            'mois': ObjectifCommercialSerializer(objectifs['mois']).data if objectifs['mois'] else None,
        }
        return Response(data)
