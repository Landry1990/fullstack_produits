from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import LoyaltySetting, InvoiceSettings, PharmacySettings, AuditLog, ConfigurationOption
from ..serializers import LoyaltySettingSerializer, InvoiceSettingsSerializer, PharmacySettingsSerializer, ConfigurationOptionSerializer
from ..audit_helpers import log_audit
from ..pagination import StandardResultsSetPagination

# ... (existing classes)

class ConfigurationOptionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for dynamic configuration options.
    """
    queryset = ConfigurationOption.objects.all()
    serializer_class = ConfigurationOptionSerializer
    permission_classes = [permissions.IsAuthenticated] # Read allowed for all, Write restricted if needed elsewhere
    pagination_class = StandardResultsSetPagination
    filterset_fields = ['type', 'code', 'is_active']
    ordering_fields = ['order', 'label']

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='ConfigurationOption',
            object_id=obj.pk,
            description=f"Création option {obj.type}: {obj.label}",
            details=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='ConfigurationOption',
            object_id=obj.pk,
            description=f"Mise à jour option {obj.type}: {obj.label}",
            details=serializer.data,
            request=self.request
        )


class LoyaltySettingViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing loyalty settings.
    Singleton pattern - only one settings object should exist.
    """
    queryset = LoyaltySetting.objects.all()
    serializer_class = LoyaltySettingSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        # Ensure at least one setting exists
        if not LoyaltySetting.objects.exists():
            LoyaltySetting.objects.create()
        # Refresh queryset to include the newly created object if necessary
        self.queryset = LoyaltySetting.objects.all()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # For singleton pattern, always update existing or create if doesn't exist
        obj, created = LoyaltySetting.objects.get_or_create(pk=1)
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        # This should not be called for singleton, but kept for compatibility
        obj, created = LoyaltySetting.objects.update_or_create(
            pk=1,
            defaults=serializer.validated_data
        )
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE if not created else AuditLog.Action.CREATE,
            model_name='LoyaltySetting',
            object_id=obj.pk,
            description="Mise à jour des paramètres de fidélité",
            details=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='LoyaltySetting',
            object_id=obj.pk,
            description="Mise à jour des paramètres de fidélité",
            details=serializer.data,
            request=self.request
        )

    def get_object(self):
        # Always return the first object (singleton pattern)
        obj, created = LoyaltySetting.objects.get_or_create(pk=1)
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
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='InvoiceSettings',
                object_id=config.pk,
                description="Mise à jour de la configuration des factures",
                details=serializer.data,
                request=request
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PharmacySettingsView(APIView):
    """
    API View pour gérer les paramètres de la pharmacie.
    Singleton: récupère ou crée l'unique configuration.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        settings, created = PharmacySettings.objects.get_or_create(pk=1)
        serializer = PharmacySettingsSerializer(settings)
        data = serializer.data
        data['server_time'] = timezone.now().isoformat()
        return Response(data)

    def put(self, request):
        settings, created = PharmacySettings.objects.get_or_create(pk=1)
        serializer = PharmacySettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            from django.utils import timezone
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='PharmacySettings',
                object_id=settings.pk,
                description=f"Mise à jour des paramètres de la pharmacie: {settings.pharmacy_name}",
                details=serializer.data,
                request=request
            )
            data = serializer.data
            data['server_time'] = timezone.now().isoformat()
            return Response(data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WhatsAppTestView(APIView):
    """Endpoint pour tester l'envoi d'un message WhatsApp."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import requests as req_lib
        import logging
        logger = logging.getLogger(__name__)
        from ..models import PharmacySettings
        ps = PharmacySettings.objects.first()
        phone_id = (ps.whatsapp_phone_id or '').strip() if ps else ''
        token = (ps.whatsapp_access_token or '').strip() if ps else ''
        recipient = request.data.get('numero', '')

        if not recipient:
            return Response({'error': 'Champ "numero" requis'}, status=status.HTTP_400_BAD_REQUEST)

        clean_number = ''.join(filter(str.isdigit, recipient))

        if not phone_id:
            return Response(
                {'status': 'error', 'message': 'Phone Number ID manquant — renseignez-le dans les paramètres WhatsApp'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not token:
            return Response(
                {'status': 'error', 'message': 'Access Token manquant — renseignez-le dans les paramètres WhatsApp'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(clean_number) < 8:
            return Response(
                {'status': 'error', 'message': f'Numéro invalide : "{recipient}" → "{clean_number}" (trop court)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_number,
            "type": "template",
            "template": {
                "name": "hello_world",
                "language": {"code": "en_US"}
            }
        }
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        logger.info(f"[WhatsApp Test] → {url} | destinataire: {clean_number} | phone_id: {phone_id[:6]}...")

        try:
            resp = req_lib.post(url, headers=headers, json=payload, timeout=15)
            try:
                data = resp.json()
            except Exception:
                data = {'raw': resp.text}

            logger.info(f"[WhatsApp Test] ← HTTP {resp.status_code} | {data}")

            if resp.status_code == 200:
                return Response({'status': 'ok', 'message': 'Message envoyé avec succès ✅', 'detail': data})

            meta_error = data.get('error', {})
            meta_msg = meta_error.get('message', 'Erreur inconnue de Meta')
            meta_code = meta_error.get('code', resp.status_code)
            meta_sub = meta_error.get('error_subcode', '')
            meta_user = meta_error.get('error_user_msg', '')
            meta_fbtrace = meta_error.get('fbtrace_id', '')

            detail_msg = meta_msg
            if meta_user:
                detail_msg += f" — {meta_user}"

            hint = ''
            if meta_code == 190:
                hint = "Token expiré ou invalide. Générez un nouveau token dans Meta for Developers."
            elif meta_code == 100:
                hint = "Phone Number ID incorrect ou numéro destinataire mal formaté (doit être international sans +)."
            elif meta_code == 131030:
                hint = "Numéro destinataire non enregistré sur WhatsApp."
            elif meta_code == 132000:
                hint = "Template 'hello_world' introuvable sur ce compte. Vérifiez dans Meta Business Suite."

            return Response(
                {
                    'status': 'error',
                    'message': detail_msg,
                    'hint': hint,
                    'meta_code': meta_code,
                    'meta_subcode': meta_sub,
                    'fbtrace_id': meta_fbtrace,
                    'http_status': resp.status_code,
                    'detail': data,
                },
                status=status.HTTP_502_BAD_GATEWAY
            )
        except req_lib.exceptions.Timeout:
            return Response(
                {'status': 'error', 'message': 'Timeout — impossible de joindre l\'API Meta (>15s). Vérifiez la connectivité réseau du serveur.'},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            logger.error(f"[WhatsApp Test] Exception: {e}")
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class TelegramTestView(APIView):
    """Envoie un message test via le bot Telegram."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..models import PharmacySettings
        from ..telegram_service import TelegramService

        ps = PharmacySettings.objects.first()
        bot_token = (ps.telegram_bot_token or '').strip() if ps else ''
        chat_id = (ps.telegram_chat_id or '').strip() if ps else ''

        # Override depuis le body uniquement si la valeur n'est pas vide
        bot_token = request.data.get('bot_token', '').strip() or bot_token
        chat_id = request.data.get('chat_id', '').strip() or chat_id

        if not bot_token:
            return Response({'status': 'error', 'message': 'Token bot Telegram manquant — renseignez-le dans les paramètres'}, status=status.HTTP_400_BAD_REQUEST)
        if not chat_id:
            return Response({'status': 'error', 'message': 'Chat ID manquant — démarrez une conversation avec votre bot et récupérez votre chat_id'}, status=status.HTTP_400_BAD_REQUEST)

        pharmacy_name = (ps.pharmacy_name if ps else '') or 'Zenith Pharma'
        success, message = TelegramService.send_message(
            text=f"✅ <b>Test {pharmacy_name}</b>\n\nLa connexion Telegram fonctionne correctement !",
            bot_token=bot_token,
            chat_id=chat_id
        )

        if success:
            return Response({'status': 'ok', 'message': message})
        return Response({'status': 'error', 'message': message}, status=status.HTTP_502_BAD_GATEWAY)


class TelegramGetChatIdView(APIView):
    """Récupère automatiquement le chat_id depuis les mises à jour du bot."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import requests as req_lib
        from ..models import PharmacySettings

        ps = PharmacySettings.objects.first()
        bot_token = request.data.get('bot_token') or ((ps.telegram_bot_token or '').strip() if ps else '')

        if not bot_token:
            return Response({'status': 'error', 'message': 'Token bot requis'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = req_lib.get(f"https://api.telegram.org/bot{bot_token}/getUpdates", timeout=10)
            data = resp.json()
            if not data.get('ok'):
                return Response({'status': 'error', 'message': data.get('description', 'Erreur bot')}, status=status.HTTP_400_BAD_REQUEST)

            updates = data.get('result', [])
            if not updates:
                return Response({
                    'status': 'waiting',
                    'message': 'Aucun message reçu — envoyez /start à votre bot Telegram d\'abord, puis réessayez.'
                })

            # Prendre le chat_id du dernier message reçu
            last = updates[-1]
            chat = last.get('message', {}).get('chat', {}) or last.get('my_chat_member', {}).get('chat', {})
            chat_id = str(chat.get('id', ''))
            chat_name = chat.get('first_name', '') or chat.get('title', '')

            return Response({'status': 'ok', 'chat_id': chat_id, 'chat_name': chat_name})

        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class TelegramRapportFlashView(APIView):
    """Envoie le rapport flash du jour via Telegram."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..telegram_service import TelegramService
        from ..models import PharmacySettings
        from decimal import Decimal
        from django.utils import timezone

        try:
            ps = PharmacySettings.objects.first()
            if not ps or not ps.telegram_enabled:
                return Response({'status': 'error', 'message': 'Telegram non activé dans les paramètres'}, status=status.HTTP_400_BAD_REQUEST)

            # Stats envoyées depuis le frontend (useDashboardStats)
            stats = request.data.get('stats', {})

            # Extraire les valeurs — le hook useDashboardStats retourne { revenue, sales, receivables, low_stock, ... }
            revenue = stats.get('revenue', {})
            sales = stats.get('sales', {})
            receivables = stats.get('receivables', {})
            low_stock = stats.get('low_stock', {})

            ca = revenue.get('value', 0) or 0
            change = revenue.get('change', 0) or 0
            nb_ventes = sales.get('value', 0) or 0
            creances = receivables.get('value', 0) or 0
            ruptures = low_stock.get('value', 0) or 0

            # Si les stats ne sont pas passées, on les calcule côté backend
            if not stats:
                from django.utils.timezone import localdate
                from ..models import Facture, Produit
                today = localdate()
                factures_today = Facture.objects.filter(date__date=today, statut='VALIDEE')
                ca = sum(f.total_ttc for f in factures_today) or 0
                nb_ventes = factures_today.count()
                ruptures = Produit.objects.filter(stock_quantity__lte=0, est_actif=True).count()
                creances = 0

            arrow = "📈" if float(change) >= 0 else "📉"
            sign = "+" if float(change) >= 0 else ""
            pharmacy_name = (ps.pharmacy_name or 'Pharmacie').upper()
            now = timezone.now()
            date_str = now.strftime("%d/%m/%Y à %H:%M")

            text = (
                f"📊 <b>Rapport Flash — {pharmacy_name}</b>\n"
                f"<i>{date_str}</i>\n\n"
                f"💰 <b>CA du jour :</b> {int(float(ca)):,} FCFA {arrow} {sign}{int(float(change))}%\n"
                f"🧾 <b>Ventes :</b> {int(float(nb_ventes))}\n"
                f"💳 <b>Créances :</b> {int(float(creances)):,} FCFA\n"
                f"⚠️ <b>Ruptures :</b> {int(float(ruptures))} produit(s)\n\n"
                f"<i>Généré par Zenith Pharma</i>"
            )

            success, message = TelegramService.send_message(text)

            if success:
                return Response({'status': 'ok', 'message': message})
            return Response({'status': 'error', 'message': message}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TelegramRapportFlashDateView(APIView):
    """Envoie le rapport flash d'une date précise via Telegram."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..telegram_service import TelegramService
        from ..models import PharmacySettings, Facture, FactureProduit
        from django.db.models import Sum, Count, F, ExpressionWrapper, DecimalField
        from django.utils import timezone
        from datetime import date as date_type

        try:
            ps = PharmacySettings.objects.first()
            if not ps or not ps.telegram_enabled:
                return Response({'status': 'error', 'message': 'Telegram non activé dans les paramètres'}, status=status.HTTP_400_BAD_REQUEST)

            date_str = request.data.get('date')
            if not date_str:
                return Response({'status': 'error', 'message': 'Paramètre date manquant (format YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)

            from datetime import datetime
            try:
                jour = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'status': 'error', 'message': 'Format de date invalide (attendu: YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)

            factures = Facture.objects.filter(
                date__date=jour,
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            )
            agg = factures.aggregate(
                ca_ttc=Sum('total_ttc'),
                ca_ht=Sum('total_ht'),
                nb_ventes=Count('id'),
                total_remise=Sum('remise'),
            )
            ca = float(agg['ca_ttc'] or 0)
            nb_ventes = int(agg['nb_ventes'] or 0)
            remise_globale = float(agg['total_remise'] or 0)

            # Remises lignes
            remises_lignes = FactureProduit.objects.filter(
                facture__date__date=jour,
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            ).aggregate(total=Sum(ExpressionWrapper(F('discount') * F('quantity'), output_field=DecimalField())))
            remise = float(remises_lignes['total'] or 0) + remise_globale

            # Marge brute : coût = stock_lot.price_cost si dispo, sinon produit.pmp, sinon cost_price
            fps = FactureProduit.objects.filter(
                facture__date__date=jour,
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            ).select_related('stock_lot', 'produit')
            marge = 0.0
            for fp in fps:
                if fp.stock_lot_id:
                    cout = float(fp.stock_lot.price_cost or 0)
                elif fp.produit_id and fp.produit.pmp:
                    cout = float(fp.produit.pmp)
                elif fp.produit_id:
                    cout = float(fp.produit.cost_price or 0)
                else:
                    cout = 0.0
                marge += (float(fp.selling_price) - cout) * fp.quantity
            taux_marge = (marge / ca * 100) if ca > 0 else 0

            # Créances du jour (en_compte)
            from ..models import Caisse
            en_compte_agg = Caisse.objects.filter(
                facture__date__date=jour,
                mode_paiement='en_compte',
                statut='completee'
            ).aggregate(total=Sum('montant'))
            creances = float(en_compte_agg['total'] or 0)

            pharmacy_name = (ps.pharmacy_name or 'Pharmacie').upper()
            date_affichee = jour.strftime('%d/%m/%Y')
            panier_moyen = ca / nb_ventes if nb_ventes > 0 else 0

            text = (
                f"📊 <b>Rapport Flash — {pharmacy_name}</b>\n"
                f"<i>{date_affichee}</i>\n\n"
                f"💰 <b>CA TTC :</b> {int(ca):,} FCFA\n"
                f"🧾 <b>Ventes :</b> {nb_ventes} • panier moy. {int(panier_moyen):,} FCFA\n"
                f"📈 <b>Marge brute :</b> {int(marge):,} FCFA ({taux_marge:.1f}%)\n"
                f"🎁 <b>Remises :</b> {int(remise):,} FCFA\n"
                f"💳 <b>En compte :</b> {int(creances):,} FCFA\n\n"
                f"<i>Généré par Zenith Pharma</i>"
            )

            success, message = TelegramService.send_message(text)
            if success:
                return Response({'status': 'ok', 'message': message})
            return Response({'status': 'error', 'message': message}, status=status.HTTP_502_BAD_GATEWAY)

        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TelegramRapportInventaireView(APIView):
    """Envoie un résumé d'inventaire via Telegram : valeur stock, écarts, top + et top -."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..telegram_service import TelegramService
        from ..models import PharmacySettings, Inventaire, LigneInventaire, Produit, StockLot
        from django.db.models import Sum, F, ExpressionWrapper, DecimalField
        from django.utils import timezone

        try:
            ps = PharmacySettings.objects.first()
            if not ps or not ps.telegram_enabled:
                return Response({'status': 'error', 'message': 'Telegram non activé dans les paramètres'}, status=status.HTTP_400_BAD_REQUEST)

            pharmacy_name = (ps.pharmacy_name or 'Pharmacie').upper()
            now = timezone.now()
            date_str = now.strftime("%d/%m/%Y à %H:%M")


            # Inventaire ciblé : par id si fourni, sinon dernier validé
            inventaire_id = request.data.get('inventaire_id')
            if inventaire_id:
                last_inv = Inventaire.objects.filter(id=inventaire_id).first()
            else:
                last_inv = Inventaire.objects.filter(status='VALIDEE').order_by('-date').first()

            ecart_text = "<i>Aucun inventaire trouvé</i>"
            top_plus_text = ""
            top_moins_text = ""

            if last_inv:
                lignes = list(LigneInventaire.objects.filter(inventaire=last_inv).select_related('produit'))
                total_ecart = sum(l.ecart for l in lignes)
                nb_ecarts_pos = sum(1 for l in lignes if l.ecart > 0)
                nb_ecarts_neg = sum(1 for l in lignes if l.ecart < 0)

                valeur_ecart = sum(
                    float(l.ecart) * float(l.pmp_snapshot or 0)
                    for l in lignes
                )

                inv_date = last_inv.date.strftime('%d/%m/%Y') if last_inv.date else '?'
                inv_label = f"#{last_inv.id} — {last_inv.description or inv_date}"
                statut_label = "✅ Validé" if last_inv.status == 'VALIDEE' else "📝 En cours"

                valeur_theo = sum(
                    float(l.stock_theorique or 0) * float(l.pmp_snapshot or 0)
                    for l in lignes
                )
                valeur_phys = sum(
                    float(l.quantite_physique or 0) * float(l.pmp_snapshot or 0)
                    for l in lignes
                )

                ecart_text = (
                    f"📋 <b>Inventaire {inv_label}</b> ({statut_label})\n\n"
                    f"� <b>Valeur théorique :</b> {int(valeur_theo):,} FCFA\n"
                    f"🔍 <b>Valeur physique :</b> {int(valeur_phys):,} FCFA\n"
                    f"💸 <b>Valeur écart :</b> {int(valeur_ecart):+,} FCFA\n\n"
                    f"📊 Écart total : {total_ecart:+d} unités\n"
                    f"✅ Excédents : {nb_ecarts_pos} lignes\n"
                    f"❌ Manquants : {nb_ecarts_neg} lignes"
                )

                top_plus = sorted([l for l in lignes if l.ecart > 0], key=lambda x: float(x.ecart) * float(x.pmp_snapshot or 0), reverse=True)[:5]
                if top_plus:
                    top_plus_text = "\n\n📈 <b>Top excédents :</b>\n"
                    for l in top_plus:
                        nom = (l.produit.name if l.produit else l.produit_nom) or '?'
                        valeur = int(float(l.ecart) * float(l.pmp_snapshot or 0))
                        top_plus_text += f"  • {nom[:25]} : +{l.ecart} uté (+{valeur:,} F)\n"

                top_moins = sorted([l for l in lignes if l.ecart < 0], key=lambda x: float(x.ecart) * float(x.pmp_snapshot or 0))[:5]
                if top_moins:
                    top_moins_text = "\n📉 <b>Top manquants :</b>\n"
                    for l in top_moins:
                        nom = (l.produit.name if l.produit else l.produit_nom) or '?'
                        valeur = int(float(l.ecart) * float(l.pmp_snapshot or 0))
                        top_moins_text += f"  • {nom[:25]} : {l.ecart} uté ({valeur:,} F)\n"

            text = (
                f"🏪 <b>Rapport Inventaire — {pharmacy_name}</b>\n"
                f"<i>{date_str}</i>\n\n"
                f"{ecart_text}"
                f"{top_plus_text}"
                f"{top_moins_text}\n"
                f"\n<i>Généré par Zenith Pharma</i>"
            )

            success, message = TelegramService.send_message(text)
            if success:
                return Response({'status': 'ok', 'message': message})
            return Response({'status': 'error', 'message': message}, status=status.HTTP_502_BAD_GATEWAY)

        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TelegramRapportMensuelView(APIView):
    """Envoie un résumé du rapport mensuel/période via Telegram. Reçoit les données déjà calculées du frontend."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..telegram_service import TelegramService
        from ..models import PharmacySettings
        from django.utils import timezone

        try:
            ps = PharmacySettings.objects.first()
            if not ps or not ps.telegram_enabled:
                return Response({'status': 'error', 'message': 'Telegram non activé dans les paramètres'}, status=status.HTTP_400_BAD_REQUEST)

            pharmacy_name = (ps.pharmacy_name or 'Pharmacie').upper()
            now = timezone.now()
            date_str = now.strftime("%d/%m/%Y à %H:%M")

            # Données déjà calculées envoyées par le frontend
            data = request.data.get('rapport')
            periode_label = request.data.get('periode', '?')

            if not data:
                return Response({'status': 'error', 'message': 'Données du rapport manquantes'}, status=status.HTTP_400_BAD_REQUEST)

            ca = data.get('ca', {})
            marge = data.get('marge', {})
            encaissements = data.get('encaissements', [])
            mvts = data.get('mouvements_caisse', {})
            achats = data.get('achats_par_fournisseur', [])

            ca_ttc = int(float(ca.get('ca_ttc', 0)))
            ca_ht = int(float(ca.get('ca_ht', 0)))
            nb_ventes = int(ca.get('nb_ventes', 0))
            remises = int(float(ca.get('total_remises', 0)))
            marge_brute = int(float(marge.get('marge_brute', 0)))
            marge_pct = float(marge.get('marge_pct', 0))
            panier_moyen = ca_ttc // nb_ventes if nb_ventes > 0 else 0

            encaiss_total = sum(int(float(e.get('montant', 0))) for e in encaissements)
            creances = int(float(data.get('ventes_credit', 0)))

            mvts_e = int(float(mvts.get('total_entrees', 0)))
            mvts_s = int(float(mvts.get('total_sorties', 0)))

            text = (
                f"📊 <b>Rapport d'Activité — {pharmacy_name}</b>\n"
                f"<i>Période : {periode_label}</i>\n"
                f"<i>Généré le {date_str}</i>\n\n"
                f"💰 <b>CA TTC :</b> {ca_ttc:,} FCFA\n"
                f"📋 <b>CA HT :</b> {ca_ht:,} FCFA\n"
                f"🧾 <b>Ventes :</b> {nb_ventes} • panier moy. {panier_moyen:,} F\n"
                f"📈 <b>Marge brute :</b> {marge_brute:,} FCFA ({marge_pct:.1f}%)\n"
                f"🎁 <b>Remises :</b> {remises:,} FCFA\n\n"
                f"💵 <b>Encaissements :</b> {encaiss_total:,} FCFA\n"
                f"💳 <b>En compte :</b> {creances:,} FCFA\n\n"
            )

            if mvts_e > 0 or mvts_s > 0:
                text += (
                    f"🏦 <b>Mouvements caisse :</b>\n"
                    f"  ↗️ Entrées : {mvts_e:,} F\n"
                    f"  ↘️ Sorties : {mvts_s:,} F\n"
                    f"  📊 Solde : {mvts_e - mvts_s:+,} F\n\n"
                )

            if achats:
                text += "🏪 <b>Top Fournisseurs :</b>\n"
                for f in achats[:3]:
                    nom = str(f.get('fournisseur_nom', '?'))[:20]
                    montant = int(float(f.get('montant_total', 0)))
                    text += f"  • {nom} : {montant:,} F\n"
                text += "\n"

            text += f"<i>Généré par Zenith Pharma</i>"

            success, message = TelegramService.send_message(text)
            if success:
                return Response({'status': 'ok', 'message': message})
            return Response({'status': 'error', 'message': message}, status=status.HTTP_502_BAD_GATEWAY)

        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TVAViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing VAT rates.
    """
    from ..models import TVA
    from ..serializers import TVASerializer
    
    queryset = TVA.objects.all()
    serializer_class = TVASerializer
    permission_classes = [permissions.IsAuthenticated] # Read/Write for authenticated users (manage in settings)
    pagination_class = StandardResultsSetPagination
    
    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='TVA',
            object_id=obj.pk,
            description=f"Création taux TVA: {obj.taux}%",
            details=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='TVA',
            object_id=obj.pk,
            description=f"Modification taux TVA: {obj.taux}%",
            details=serializer.data,
            request=self.request
        )

    def perform_destroy(self, instance):
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='TVA',
            object_id=instance.pk,
            description=f"Suppression taux TVA: {instance.taux}%",
            request=self.request
        )
        instance.delete()
