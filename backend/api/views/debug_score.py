"""
Endpoint de debug pour le score de santé du stock
Affiche le calcul détaillé pour identifier le bug
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Q, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta

from api.models import Produit
from api.models.settings import PharmacySettings


class DebugStockScoreView(APIView):
    """
    DEBUG: Affiche le calcul détaillé du score de santé
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        today = timezone.now().date()
        
        # === DONNÉES BRUTES ===
        total_active = Produit.objects.filter(is_active=True).count()
        total_active = total_active or 1  # Évite division par zéro
        
        rupture_count = Produit.objects.filter(is_active=True, stock__lte=0).count()
        
        dormant_days = 90
        limit_date = today - timedelta(days=dormant_days)
        
        dormant_qs = Produit.objects.filter(stock__gt=0, is_active=True).filter(
            Q(dernier_vente__lte=limit_date) | 
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=limit_date)) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) & Q(created_at__date__lte=limit_date))
        )
        
        dead_stock_value = dormant_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total']
        
        total_stock_value = Produit.objects.filter(is_active=True).aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total'] or Decimal('1')
        
        # === CALCUL INTERMÉDIAIRE ===
        rupture_ratio = float(rupture_count) / float(total_active)
        availability_rate = (1 - rupture_ratio) * 100
        
        dead_ratio = float(dead_stock_value) / float(total_stock_value)
        rotation_rate = (1 - dead_ratio) * 100
        
        # === POIDS ===
        settings = PharmacySettings.objects.first()
        avail_weight = Decimal(str(settings.availability_weight)) / Decimal('100.0') if settings else Decimal('0.6')
        rot_weight = Decimal(str(settings.rotation_weight)) / Decimal('100.0') if settings else Decimal('0.4')
        
        # === CALCUL FINAL ===
        health_score = (Decimal(str(availability_rate)) * avail_weight) + (Decimal(str(rotation_rate)) * rot_weight)
        
        return Response({
            'debug': {
                'total_active_products': total_active,
                'rupture_count': rupture_count,
                'rupture_ratio': round(rupture_ratio, 4),
                'dead_stock_value': float(dead_stock_value),
                'total_stock_value': float(total_stock_value),
                'dead_ratio': round(dead_ratio, 4),
            },
            'calculs': {
                'availability_rate': round(float(availability_rate), 2),
                'rotation_rate': round(float(rotation_rate), 2),
                'avail_weight': float(avail_weight),
                'rot_weight': float(rot_weight),
            },
            'score_final': round(float(health_score), 2),
            'verification': f"({round(float(availability_rate), 2)} × {float(avail_weight)}) + ({round(float(rotation_rate), 2)} × {float(rot_weight)}) = {round(float(health_score), 2)}"
        })
