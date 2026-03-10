from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from ..models import ObjectifCommercial
from ..serializers import ObjectifCommercialSerializer
from ..pagination import StandardResultsSetPagination

class ObjectifViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des objectifs commerciaux.
    """
    queryset = ObjectifCommercial.objects.all()
    serializer_class = ObjectifCommercialSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        periode = self.request.query_params.get('periode')
        if periode:
            queryset = queryset.filter(periode=periode)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Surcharge la création pour faire un 'upsert' (mise à jour si l'objectif existe déjà).
        """
        periode = request.data.get('periode')
        date_debut = request.data.get('date_debut')
        
        if periode and date_debut:
            existing_objectif = ObjectifCommercial.objects.filter(
                periode=periode, 
                date_debut=date_debut
            ).first()
            
            if existing_objectif:
                serializer = self.get_serializer(existing_objectif, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                self.perform_update(serializer)
                return Response(serializer.data, status=status.HTTP_200_OK)
                
        return super().create(request, *args, **kwargs)

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
