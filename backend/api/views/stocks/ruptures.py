import csv
from datetime import timedelta

from django.db import transaction
from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...audit_helpers import log_audit
from ...models import AuditLog
from ...models.stock import RuptureFournisseur
from ...serializers import RuptureFournisseurSerializer
from ...utils.validation import parse_int


class RuptureFournisseurViewSet(viewsets.ModelViewSet):
    """
    Gestion des ruptures fournisseurs.
    Permet de déclarer un produit indisponible chez le grossiste et de le marquer résolu.
    """
    queryset = RuptureFournisseur.objects.select_related('produit', 'fournisseur', 'utilisateur').all()
    serializer_class = RuptureFournisseurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['produit', 'est_resolu', 'fournisseur']
    search_fields = ['produit__name', 'fournisseur__name', 'remarques']

    def perform_create(self, serializer):
        produit = serializer.validated_data.get('produit')
        if produit is not None and produit.is_service:
            raise ValidationError(
                f"« {produit.name} » est un service : pas de rupture fournisseur sur un service."
            )
        rupture = serializer.save(utilisateur=self.request.user)
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='RuptureFournisseur',
            object_id=rupture.id,
            description=f"Déclaration rupture fournisseur — {produit.name if produit else 'Produit'} ({rupture.fournisseur.name if rupture.fournisseur else 'fournisseur inconnu'})",
            details={
                'produit_id': rupture.produit_id,
                'fournisseur_id': rupture.fournisseur_id,
            },
            request=self.request,
        )

    def perform_update(self, serializer):
        fields = sorted(serializer.validated_data.keys())
        rupture = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='RuptureFournisseur',
            object_id=rupture.id,
            description=f"Modification rupture fournisseur #{rupture.id} — {rupture.produit.name if rupture.produit else 'Produit'}",
            details={'fields': fields},
            request=self.request,
        )

    def perform_destroy(self, instance):
        # Tracé avant suppression (produit + fournisseur de la rupture détruite)
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='RuptureFournisseur',
            object_id=instance.id,
            description=f"Suppression rupture fournisseur #{instance.id} — {instance.produit.name if instance.produit else 'Produit'}",
            details={
                'produit_id': instance.produit_id,
                'fournisseur_id': instance.fournisseur_id,
                'est_resolu': instance.est_resolu,
            },
            request=self.request,
        )
        super().perform_destroy(instance)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def resoudre(self, request, pk=None):
        rupture = self.get_object()
        if rupture.est_resolu:
            return Response({'error': 'Cette rupture est déjà marquée comme résolue.'}, status=status.HTTP_400_BAD_REQUEST)

        rupture.est_resolu = True
        rupture.date_fin = timezone.now()
        rupture.save(update_fields=['est_resolu', 'date_fin'])
        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='RuptureFournisseur',
            object_id=rupture.id,
            description=f"Rupture fournisseur #{rupture.id} résolue — {rupture.produit.name if rupture.produit else 'Produit'}",
            details={
                'produit_id': rupture.produit_id,
                'fournisseur_id': rupture.fournisseur_id,
            },
            request=request,
        )
        return Response({'status': 'Rupture marquée comme résolue'})

    def _get_frequency_stats(self, days=None):
        queryset = RuptureFournisseur.objects.all()
        if days:
            days = parse_int(days, field='days', min_value=1, max_value=3650)
            start_date = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(date_debut__gte=start_date)
            
        stats = queryset.values(
            'produit__id', 'produit__name'
        ).annotate(
            total_ruptures=Count('id')
        ).order_by('-total_ruptures')[:200]
        
        return [
            {
                'produit_id': item['produit__id'],
                'produit_name': item['produit__name'],
                'total_ruptures': item['total_ruptures']
            } for item in stats
        ]

    @action(detail=False, methods=['get'])
    def statistiques_frequence(self, request):
        """
        Retourne la liste des produits tombant le plus souvent en rupture.
        """
        days = request.query_params.get('days')
        data = self._get_frequency_stats(days)
        return Response(data)

    @action(detail=False, methods=['get'])
    def export_frequence_csv(self, request):
        """
        Exporte les statistiques de fréquence de rupture en CSV.
        """
        days = request.query_params.get('days')
        data = self._get_frequency_stats(days)
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="frequence_ruptures.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID Produit', 'Nom Produit', 'Nombre de Ruptures'])
        for item in data:
            writer.writerow([item['produit_id'], item['produit_name'], item['total_ruptures']])

        log_audit(
            user=request.user,
            action=AuditLog.Action.EXPORT,
            model_name='RuptureFournisseur',
            object_id=0,
            description=f"Export CSV fréquence des ruptures fournisseurs ({len(data)} produits)",
            details={'days': days, 'count': len(data)},
            request=request,
        )
        return response
