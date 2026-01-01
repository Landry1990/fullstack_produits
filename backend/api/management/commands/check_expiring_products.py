"""
Management command to check for expiring products and generate notifications.
Run this daily via cron/scheduler to alert users about products nearing expiration.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import StockLot
from django.conf import settings


class Command(BaseCommand):
    help = 'Check for expiring products and generate console notifications'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days ahead to check for expiration (default: 30)',
        )
        parser.add_argument(
            '--min-quantity',
            type=int,
            default=1,
            help='Minimum quantity remaining to notify (default: 1)',
        )

    def handle(self, *args, **options):
        days_ahead = options['days']
        min_quantity = options['min_quantity']
        
        today = timezone.now().date()
        future_date = today + timedelta(days=days_ahead)
        
        # Find lots expiring soon with remaining stock
        expiring_lots = StockLot.objects.filter(
            date_expiration__gt=today,
            date_expiration__lte=future_date,
            quantity_remaining__gte=min_quantity
        ).select_related('produit', 'fournisseur').order_by('date_expiration')
        
        if not expiring_lots.exists():
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Aucun lot en péremption dans les {days_ahead} prochains jours'
                )
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'\n⚠️  ALERTE: {expiring_lots.count()} lot(s) expirent dans les {days_ahead} prochains jours:\n'
            )
        )
        
        for lot in expiring_lots:
            days_until = (lot.date_expiration - today).days
            urgency_style = self.style.ERROR if days_until <= 7 else self.style.WARNING
            
            message = (
                f'  • {lot.produit.name} '
                f'(Lot: {lot.lot or "N/A"}) - '
                f'{lot.quantity_remaining} unités - '
                f'Expire le {lot.date_expiration.strftime("%d/%m/%Y")} '
                f'({days_until} jour{"s" if days_until > 1 else ""})'
            )
            
            self.stdout.write(urgency_style(message))
        
        # Summary
        critical_count = expiring_lots.filter(
            date_expiration__lte=today + timedelta(days=7)
        ).count()
        
        if critical_count > 0:
            self.stdout.write(
                self.style.ERROR(
                    f'\n🚨 {critical_count} lot(s) CRITIQUE(S) (≤ 7 jours)\n'
                )
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                '\n💡 Actions recommandées:'
            )
        )
        self.stdout.write('  1. Vérifier si retour fournisseur possible')
        self.stdout.write('  2. Appliquer des remises pour écouler le stock')
        self.stdout.write('  3. Créer un Avoir (type PERIME) si applicable')
        self.stdout.write('  4. Utiliser "Sortir Périmés" pour destruction\n')
