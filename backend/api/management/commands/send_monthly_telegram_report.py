# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime
from dateutil.relativedelta import relativedelta
from django.db.models import Sum, F
from ...models import Facture, Caisse, MouvementCaisse, PharmacySettings, CommandeProduit
from ...telegram_service import TelegramService
from ...services.finance_marges import calculate_margin_for_invoices
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Sends automated monthly activity reports via Telegram.'

    def add_arguments(self, parser):
        parser.add_argument('--month', type=int, help='Month number (1-12)')
        parser.add_argument('--year', type=int, help='Year (e.g. 2026)')

    def handle(self, *args, **options):
        # Determine the target month and year
        now = timezone.now()
        month = options.get('month')
        year = options.get('year')

        if not month or not year:
            # If not specified, default to previous month of current time
            target_date = now - relativedelta(months=1)
            month = target_date.month
            year = target_date.year

        # Start and end of target month
        start_date = datetime(year, month, 1, 0, 0, 0)
        # End date of target month: 1st of next month minus 1 second
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0) - relativedelta(seconds=1)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0) - relativedelta(seconds=1)

        # Make dates timezone aware if settings demand it
        if timezone.is_naive(start_date):
            start_date = timezone.make_aware(start_date)
        if timezone.is_naive(end_date):
            end_date = timezone.make_aware(end_date)

        self.stdout.write(f"Generating monthly report for {month}/{year} (from {start_date} to {end_date})...")

        # Fetch PharmacySettings
        ps = PharmacySettings.objects.first()
        if not ps:
            self.stdout.write(self.style.WARNING("PharmacySettings not configured. Skipping."))
            return
        
        # Vérifier si le rapport mensuel est activé
        if not ps.monthly_report_enabled:
            self.stdout.write(self.style.WARNING("Monthly report is disabled. Skipping."))
            return
        
        # Vérifier si l'envoi Telegram est activé pour les rapports
        if not ps.report_send_telegram:
            self.stdout.write(self.style.WARNING("Telegram report sending is disabled. Skipping."))
            return
        
        if not ps.telegram_enabled or not ps.telegram_chat_id:
            self.stdout.write(self.style.WARNING("Telegram is not properly configured. Skipping."))
            return

        # Fetch all validated or paid invoices
        invoices = Facture.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )

        nb_ventes = invoices.count()
        if nb_ventes == 0:
            self.stdout.write(self.style.WARNING("No sales found for the period. Skipping report."))
            return

        # Aggregates for invoices
        agg = invoices.aggregate(
            ca_ttc=Sum('total_ttc'),
            ca_ht=Sum('total_ht'),
            remise_globale=Sum('remise'),
        )
        ca_ttc = int(agg['ca_ttc'] or 0)
        ca_ht = int(agg['ca_ht'] or 0)
        remise_globale = int(agg['remise_globale'] or 0)

        # Calculate line item discounts
        from ...models import FactureProduit
        line_discounts = FactureProduit.objects.filter(
            facture__in=invoices
        ).aggregate(
            total=Sum(F('discount') * F('quantity'))
        )['total'] or 0
        remises = int(line_discounts + remise_globale)

        # Calculate margins
        ca_ht_calc, marge_brute_val = calculate_margin_for_invoices(invoices)
        marge_brute = int(marge_brute_val)
        marge_pct = (marge_brute_val / ca_ht_calc * 100) if ca_ht_calc > 0 else 0

        panier_moyen = ca_ttc // nb_ventes if nb_ventes > 0 else 0

        # Payments & collections
        # Encaiss total: complete payments, mode != en_compte
        encaiss_total = Caisse.objects.filter(
            date_paiement__gte=start_date,
            date_paiement__lte=end_date,
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(
            total=Sum('montant')
        )['total'] or 0
        encaiss_total = int(encaiss_total)

        # Receivables (ventes_credit): payments with mode == en_compte
        creances = Caisse.objects.filter(
            date_paiement__gte=start_date,
            date_paiement__lte=end_date,
            statut='completee',
            mode_paiement='en_compte'
        ).aggregate(
            total=Sum('montant')
        )['total'] or 0
        creances = int(creances)

        # Cash movements (MouvementCaisse)
        mvts = MouvementCaisse.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        )
        mvts_e = mvts.filter(type='ENTREE').aggregate(total=Sum('montant'))['total'] or 0
        mvts_s = mvts.filter(type='SORTIE').aggregate(total=Sum('montant'))['total'] or 0
        mvts_e = int(mvts_e)
        mvts_s = int(mvts_s)

        # Top suppliers (achats) from Commande
        achats = CommandeProduit.objects.filter(
            commande__date_cloture__gte=start_date,
            commande__date_cloture__lte=end_date,
            commande__status='CLOTUREE'
        ).values(
            'commande__fournisseur__name'
        ).annotate(
            montant_total=Sum(F('quantity') * F('price'))
        ).order_by('-montant_total')[:3]

        # Format message
        lang = ps.locale or 'fr-FR'
        pharmacy_name = (ps.pharmacy_name or 'Pharmacie').upper()
        date_str = now.strftime("%d/%m/%Y à %H:%M")
        periode_label = f"{month:02d}/{year}"

        text = (
            f"📊 <b>{TelegramService.t('report_title', lang)} — {pharmacy_name}</b>\n"
            f"<i>{TelegramService.t('period', lang)} : {periode_label}</i>\n"
            f"<i>{TelegramService.t('generated_on', lang)} {date_str}</i>\n\n"
            f"💰 <b>{TelegramService.t('sales_ttc', lang)} :</b> {ca_ttc:,} FCFA\n"
            f"📋 <b>{TelegramService.t('sales_ht', lang)} :</b> {ca_ht:,} FCFA\n"
            f"🧾 <b>{TelegramService.t('orders', lang)} :</b> {nb_ventes} • {TelegramService.t('avg_basket', lang)} {panier_moyen:,} F\n"
            f"📈 <b>{TelegramService.t('gross_margin', lang)} :</b> {marge_brute:,} FCFA ({marge_pct:.1f}%)\n"
            f"🎁 <b>{TelegramService.t('discounts', lang)} :</b> {remises:,} FCFA\n\n"
            f"💵 <b>{TelegramService.t('collections', lang)} :</b> {encaiss_total:,} FCFA\n"
            f"💳 <b>{TelegramService.t('on_account', lang)} :</b> {creances:,} FCFA\n\n"
        )

        if mvts_e > 0 or mvts_s > 0:
            text += (
                f"🏦 <b>{TelegramService.t('cash_movements', lang)} :</b>\n"
                f"  ↗️ {TelegramService.t('inflow', lang)} : {mvts_e:,} F\n"
                f"  ↘️ {TelegramService.t('outflow', lang)} : {mvts_s:,} F\n"
                f"  📊 {TelegramService.t('balance', lang)} : {mvts_e - mvts_s:+,} F\n\n"
            )

        if achats:
            text += f"🏪 <b>{TelegramService.t('top_suppliers', lang)} :</b>\n"
            for f in achats:
                nom = str(f.get('commande__fournisseur__name') or 'Fournisseur inconnu')[:20]
                montant = int(f.get('montant_total' or 0))
                text += f"  • {nom} : {montant:,} F\n"
            text += "\n"

        text += f"<i>{TelegramService.t('footer', lang)}</i>"

        success, message = TelegramService.send_message(text)
        if success:
            self.stdout.write(self.style.SUCCESS("Monthly telegram report sent successfully!"))
        else:
            self.stdout.write(self.style.ERROR(f"Failed to send telegram report: {message}"))
