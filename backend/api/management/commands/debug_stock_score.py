"""
Commande de debug pour le score de santé du stock
Usage: python manage.py debug_stock_score
"""
from django.core.management.base import BaseCommand
from django.db.models import Sum, Count, F, Q, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta

from api.models import Produit
from api.models.settings import PharmacySettings


class Command(BaseCommand):
    help = 'Affiche le calcul détaillé du score de santé du stock'

    def handle(self, *args, **options):
        today = timezone.now().date()
        
        self.stdout.write(self.style.MIGRATE_HEADING('=' * 60))
        self.stdout.write(self.style.MIGRATE_HEADING('DEBUG SCORE DE SANTÉ DU STOCK'))
        self.stdout.write(self.style.MIGRATE_HEADING('=' * 60))
        
        # === DONNÉES BRUTES ===
        total_active = Produit.objects.filter(is_active=True).count()
        total_active = total_active or 1
        
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
        
        dead_stock_count = dormant_qs.count()
        
        total_stock_value = Produit.objects.filter(is_active=True).aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal('0'))
        )['total'] or Decimal('1')
        
        # === AFFICHAGE DONNÉES BRUTES ===
        self.stdout.write(self.style.WARNING('\n📊 DONNÉES BRUTES:'))
        self.stdout.write(f'  Total produits actifs: {total_active}')
        self.stdout.write(f'  Produits en rupture: {rupture_count}')
        self.stdout.write(f'  Capital dormant: {float(dead_stock_value):,.0f} FCFA')
        self.stdout.write(f'  Valeur stock total: {float(total_stock_value):,.0f} FCFA')
        self.stdout.write(f'  Produits dormants (count): {dead_stock_count}')
        
        # === CALCULS ===
        rupture_ratio = float(rupture_count) / float(total_active)
        availability_rate = (1 - rupture_ratio) * 100
        
        dead_ratio = float(dead_stock_value) / float(total_stock_value)
        rotation_rate = (1 - dead_ratio) * 100
        
        # === POIDS ===
        settings = PharmacySettings.objects.first()
        avail_weight = Decimal(str(settings.availability_weight)) / Decimal('100.0') if settings else Decimal('0.6')
        rot_weight = Decimal(str(settings.rotation_weight)) / Decimal('100.0') if settings else Decimal('0.4')
        
        # === AFFICHAGE CALCULS ===
        self.stdout.write(self.style.WARNING('\n🧮 CALCULS:'))
        self.stdout.write(f'  Ratio rupture: {rupture_ratio:.4f} ({rupture_count}/{total_active})')
        self.stdout.write(f'  Taux disponibilité: {availability_rate:.2f}%')
        self.stdout.write(f'  Ratio dormant: {dead_ratio:.4f} ({float(dead_stock_value):,.0f}/{float(total_stock_value):,.0f})')
        self.stdout.write(f'  Taux rotation: {rotation_rate:.2f}%')
        self.stdout.write(f'  Poids disponibilité: {float(avail_weight)}')
        self.stdout.write(f'  Poids rotation: {float(rot_weight)}')
        
        # === SCORE FINAL ===
        health_score = (Decimal(str(availability_rate)) * avail_weight) + (Decimal(str(rotation_rate)) * rot_weight)
        
        self.stdout.write(self.style.WARNING('\n🏆 SCORE FINAL:'))
        self.stdout.write(f'  ({availability_rate:.2f} × {float(avail_weight)}) + ({rotation_rate:.2f} × {float(rot_weight)}) = {float(health_score):.2f}')
        
        # === DIAGNOSTIC ===
        self.stdout.write(self.style.MIGRATE_HEADING('\n' + '=' * 60))
        self.stdout.write(self.style.MIGRATE_HEADING('DIAGNOSTIC'))
        self.stdout.write(self.style.MIGRATE_HEADING('=' * 60))
        
        if float(health_score) < 50:
            self.stdout.write(self.style.ERROR(f'⚠️  SCORE TRÈS BAS: {float(health_score):.1f}%'))
            if availability_rate < 80:
                self.stdout.write(self.style.ERROR(f'   → Problème: Trop de ruptures ({rupture_count} produits)'))
            if rotation_rate < 80:
                self.stdout.write(self.style.ERROR(f'   → Problème: Trop de stock dormant ({dead_stock_count} produits)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'✅ SCORE CORRECT: {float(health_score):.1f}%'))
        
        self.stdout.write(self.style.MIGRATE_HEADING('=' * 60))
