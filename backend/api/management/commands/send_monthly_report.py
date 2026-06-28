# -*- coding: utf-8 -*-
"""
Commande d'envoi du rapport mensuel automatisé
Respecte la configuration des cases à cocher dans PharmacySettings
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from django.db.models import Sum, Count, F, Q, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal

from api.models import Facture, Caisse, MouvementCaisse, PharmacySettings, Produit, Client
from api.models import FactureProduit, CommandeProduit
from api.telegram_service import TelegramService
from api.services.finance_marges import calculate_margin_for_invoices
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Envoie le rapport mensuel automatisé selon la configuration (Telegram, Email, etc.)'

    def add_arguments(self, parser):
        parser.add_argument('--month', type=int, help='Mois (1-12)')
        parser.add_argument('--year', type=int, help='Année (ex: 2026)')
        parser.add_argument('--force', action='store_true', help='Forcer l\'envoi même hors du jour configuré')

    def handle(self, *args, **options):
        now = timezone.now()
        month = options.get('month')
        year = options.get('year')
        force = options.get('force', False)

        if not month or not year:
            # Par défaut: mois précédent
            target_date = now - relativedelta(months=1)
            month = target_date.month
            year = target_date.year

        # Calcul des dates
        start_date = datetime(year, month, 1, 0, 0, 0)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0) - relativedelta(seconds=1)
        else:
            end_date = datetime(year, month + 1, 1, 0, 0, 0) - relativedelta(seconds=1)

        if timezone.is_naive(start_date):
            start_date = timezone.make_aware(start_date)
        if timezone.is_naive(end_date):
            end_date = timezone.make_aware(end_date)

        self.stdout.write(f"Génération du rapport pour {month}/{year}...")

        # Récupérer la configuration
        ps = PharmacySettings.objects.first()
        if not ps:
            self.stdout.write(self.style.WARNING("PharmacySettings non configuré"))
            return

        # Vérifier si le rapport mensuel est activé
        if not ps.monthly_report_enabled:
            self.stdout.write(self.style.WARNING("Rapport mensuel désactivé"))
            return

        # Vérifier si c'est le bon jour (sauf si --force)
        if not force and now.day != ps.monthly_report_day:
            self.stdout.write(self.style.WARNING(
                f"Aujourd'hui est le {now.day}, le rapport est configuré pour le {ps.monthly_report_day}. "
                f"Utilisez --force pour forcer l'envoi."
            ))
            return

        self.stdout.write("Configuration trouvée, génération du rapport...")

        # Générer le rapport selon les options cochées
        report_data = self.generate_report_data(ps, start_date, end_date, month, year)
        
        # Formater le message
        message = self.format_telegram_message(report_data, ps)

        # Envoyer via Telegram si activé
        if ps.report_send_telegram and ps.telegram_enabled and ps.telegram_chat_id:
            self.stdout.write("Envoi via Telegram...")
            success, msg = TelegramService.send_message(
                text=message,
                chat_id=ps.telegram_chat_id,
                parse_mode='HTML'
            )
            if success:
                self.stdout.write(self.style.SUCCESS("✅ Rapport Telegram envoyé !"))
            else:
                self.stdout.write(self.style.ERROR(f"❌ Échec Telegram: {msg}"))
        else:
            self.stdout.write(self.style.WARNING("Envoi Telegram désactivé ou non configuré"))

        # TODO: Envoi Email si activé
        if ps.report_recipients_email:
            self.stdout.write("Envoi Email (à implémenter)...")
            # TODO: Implémenter l'envoi d'email

    def generate_report_data(self, ps, start_date, end_date, month, year):
        """Génère les données du rapport selon les options cochées"""
        data = {
            'period': f"{month:02d}/{year}",
            'pharmacy_name': ps.pharmacy_name or 'Pharmacie',
            'generated_at': timezone.now(),
        }

        # 1. Ventes du mois
        if ps.report_include_sales:
            invoices = Facture.objects.filter(
                date__gte=start_date,
                date__lte=end_date,
                is_active=True
            ).exclude(status='BROUILLON')
            
            agg = invoices.aggregate(
                ca_ttc=Sum('total_ttc'),
                ca_ht=Sum('total_ht'),
                remise=Sum('remise')
            )
            
            nb_ventes = invoices.count()
            ca_ttc = int(agg['ca_ttc'] or 0)
            
            data['sales'] = {
                'ca_ttc': ca_ttc,
                'ca_ht': int(agg['ca_ht'] or 0),
                'nb_ventes': nb_ventes,
                'panier_moyen': ca_ttc // nb_ventes if nb_ventes > 0 else 0,
                'remises': int(agg['remise'] or 0)
            }

        # 2. Marges
        if ps.report_include_margin and 'sales' in data:
            invoices = Facture.objects.filter(
                date__gte=start_date,
                date__lte=end_date,
                is_active=True
            ).exclude(status='BROUILLON')
            ca_ht, marge_brute = calculate_margin_for_invoices(invoices)
            data['margin'] = {
                'marge_brute': int(marge_brute),
                'taux': (marge_brute / ca_ht * 100) if ca_ht > 0 else 0
            }

        # 3. Santé du stock
        if ps.report_include_stock_health:
            total = Produit.objects.filter(is_active=True).count() or 1
            ruptures = Produit.objects.filter(is_active=True, stock__lte=0).count()
            score = (1 - (ruptures / total)) * 100
            data['stock_health'] = {
                'score': round(score, 1),
                'ruptures': ruptures,
                'total': total
            }

        # 4. Ruptures détaillées
        if ps.report_include_ruptures:
            ruptures_qs = Produit.objects.filter(
                is_active=True, 
                stock__lte=0,
                rotation_moyenne__gt=0
            )
            perte = ruptures_qs.aggregate(
                total=Coalesce(
                    Sum(F('rotation_moyenne') * F('selling_price')),
                    Decimal('0'),
                    output_field=DecimalField()
                )
            )['total']
            data['ruptures'] = {
                'count': ruptures_qs.count(),
                'perte_estimee': float(perte)
            }

        # 5. Top produits
        if ps.report_include_top_products:
            top = FactureProduit.objects.filter(
                facture__date__gte=start_date,
                facture__date__lte=end_date,
                facture__is_active=True
            ).values('produit__name').annotate(
                qty=Sum('quantity'),
                revenue=Sum(F('quantity') * F('selling_price'))
            ).order_by('-qty')[:5]
            data['top_products'] = [
                {'name': t['produit__name'][:25], 'qty': t['qty'], 'revenue': float(t['revenue'])}
                for t in top
            ]

        # 6. Rotation lente
        if ps.report_include_slow_moving:
            limit = timezone.now().date() - timedelta(days=ps.dormant_stock_days or 90)
            slow = Produit.objects.filter(
                stock__gt=0,
                is_active=True,
                dernier_vente__lte=limit
            )
            val = slow.aggregate(
                total=Coalesce(Sum(F('stock') * F('pmp')), Decimal('0'))
            )['total']
            data['slow_moving'] = {
                'count': slow.count(),
                'value': float(val)
            }

        # 7. Dettes
        if ps.report_include_debt:
            creances = Client.objects.filter(solde_factures__gt=0).aggregate(
                total=Coalesce(Sum('solde_factures'), Decimal('0'))
            )['total']
            data['debt'] = {
                'creances': float(creances),
                'dettes_fournisseurs': 0
            }

        # 8. Résumé financier
        if ps.report_include_financial_summary:
            encaiss = Caisse.objects.filter(
                date_paiement__gte=start_date,
                date_paiement__lte=end_date,
                statut='completee'
            ).exclude(mode_paiement='en_compte').aggregate(
                total=Coalesce(Sum('montant'), Decimal('0'))
            )['total']
            
            en_compte = Caisse.objects.filter(
                date_paiement__gte=start_date,
                date_paiement__lte=end_date,
                statut='completee',
                mode_paiement='en_compte'
            ).aggregate(
                total=Coalesce(Sum('montant'), Decimal('0'))
            )['total']
            
            data['financial'] = {
                'encaissements': float(encaiss),
                'en_compte': float(en_compte)
            }

        # 9. Comparaison mois précédent
        if ps.report_include_comparison and 'sales' in data:
            prev_month = (start_date - relativedelta(months=1)).month
            prev_year = (start_date - relativedelta(months=1)).year
            prev_start = datetime(prev_year, prev_month, 1)
            if prev_month == 12:
                prev_end = datetime(prev_year + 1, 1, 1) - relativedelta(seconds=1)
            else:
                prev_end = datetime(prev_year, prev_month + 1, 1) - relativedelta(seconds=1)
            
            if timezone.is_naive(prev_start):
                prev_start = timezone.make_aware(prev_start)
            if timezone.is_naive(prev_end):
                prev_end = timezone.make_aware(prev_end)
            
            prev_ca = Facture.objects.filter(
                date__gte=prev_start,
                date__lte=prev_end,
                is_active=True
            ).exclude(status='BROUILLON').aggregate(
                total=Coalesce(Sum('total_ttc'), Decimal('0'))
            )['total']
            
            current = data['sales']['ca_ttc']
            prev = float(prev_ca)
            if prev > 0:
                evol = ((current - prev) / prev) * 100
            else:
                evol = 0
            data['comparison'] = {
                'evolution': round(evol, 1),
                'prev_month': prev
            }

        return data

    def format_telegram_message(self, data, ps):
        """Formate le message Telegram selon les options activées"""
        lang = ps.locale or 'fr-FR'
        pharmacy = data['pharmacy_name'].upper()
        period = data['period']
        
        msg = f"📊 <b>Rapport Mensuel — {pharmacy}</b>\n"
        msg += f"📅 <i>Période: {period}</i>\n"
        msg += "━" * 20 + "\n\n"

        # Ventes
        if 'sales' in data:
            s = data['sales']
            msg += f"💰 <b>VENTES</b>\n"
            msg += f"• CA: <code>{s['ca_ttc']:,} FCFA</code>\n"
            msg += f"• Transactions: <code>{s['nb_ventes']}</code>\n"
            msg += f"• Panier moyen: <code>{s['panier_moyen']:,} F</code>\n\n"

        # Marge
        if 'margin' in data:
            m = data['margin']
            msg += f"📈 <b>MARGES</b>\n"
            msg += f"• Marge brute: <code>{m['marge_brute']:,} FCFA</code>\n"
            msg += f"• Taux: <code>{m['taux']:.1f}%</code>\n\n"

        # Santé stock
        if 'stock_health' in data:
            h = data['stock_health']
            emoji = "🟢" if h['score'] > 80 else "🟡" if h['score'] > 60 else "🔴"
            msg += f"📦 <b>SANTÉ STOCK</b> {emoji}\n"
            msg += f"• Score: <code>{h['score']}%</code>\n"
            msg += f"• Ruptures: <code>{h['ruptures']}/{h['total']}</code>\n\n"

        # Ruptures détaillées
        if 'ruptures' in data and data['ruptures']['count'] > 0:
            r = data['ruptures']
            msg += f"⚠️ <b>RUPTURES</b>\n"
            msg += f"• Produits: <code>{r['count']}</code>\n"
            msg += f"• Perte estimée: <code>{r['perte_estimee']:,.0f} F/mois</code>\n\n"

        # Top produits
        if 'top_products' in data and data['top_products']:
            msg += f"🏆 <b>TOP 5 PRODUITS</b>\n"
            for i, p in enumerate(data['top_products'], 1):
                msg += f"{i}. {p['name'][:20]}: <code>{p['qty']}</code> ventes\n"
            msg += "\n"

        # Rotation lente
        if 'slow_moving' in data and data['slow_moving']['count'] > 0:
            s = data['slow_moving']
            msg += f"🐌 <b>ROTATION LENTE</b>\n"
            msg += f"• Produits: <code>{s['count']}</code>\n"
            msg += f"• Valeur bloquée: <code>{s['value']:,.0f} FCFA</code>\n\n"

        # Dettes
        if 'debt' in data:
            d = data['debt']
            msg += f"💳 <b>FINANCES</b>\n"
            msg += f"• Créances: <code>{d['creances']:,.0f} FCFA</code>\n"
            msg += f"• Dettes FS: <code>{d['dettes_fournisseurs']:,.0f} FCFA</code>\n\n"

        # Résumé financier
        if 'financial' in data:
            f = data['financial']
            msg += f"💵 <b>TRÉSORERIE</b>\n"
            msg += f"• Encaissements: <code>{f['encaissements']:,.0f} FCFA</code>\n"
            msg += f"• En compte: <code>{f['en_compte']:,.0f} FCFA</code>\n\n"

        # Comparaison
        if 'comparison' in data:
            c = data['comparison']
            emoji = "📈" if c['evolution'] > 0 else "📉" if c['evolution'] < 0 else "➡️"
            msg += f"{emoji} <b>VS MOIS PRÉCÉDENT</b>\n"
            msg += f"• Évolution: <code>{c['evolution']:+.1f}%</code>\n\n"

        msg += "<i>Généré automatiquement 🤖</i>"
        return msg
