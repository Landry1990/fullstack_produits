from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, Count, Avg, F, Q, DecimalField, Value, ExpressionWrapper, Case, When, Exists, OuterRef
from django.db.models.functions import TruncDay, TruncMonth, Coalesce, TruncDate
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from ...models import Facture, Commande, Produit, Client, StockLot, Caisse, ObjectifCommercial, FactureProduit, FactureProduitAllocation


class DashboardClientsMixin(viewsets.ViewSet):
    
    @action(detail=False, methods=['get'])
    def clients_depassement(self, request):
        """
        Retourne la liste des clients professionnels ayant dépassé leur plafond de crédit.
        Utilisé pour les alertes du tableau de bord.
        """
        from django.db.models import Sum, F, Q, Value, DecimalField, Subquery
        from django.db.models.functions import Coalesce
    
        # Sous-requête 1: Total facturé par client (factures VAL/PAY)
        billed_sub = Facture.objects.filter(
            client=OuterRef('pk'),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).exclude(~Q(id__in=Caisse.objects.values('facture_id')), status='VAL').values('client').annotate(
            s=Sum('total_ttc')
        ).values('s')[:1]
    
        # Sous-requête 2: Total payé par client (hors en_compte)
        paid_sub = Caisse.objects.filter(
            facture__client=OuterRef('pk'),
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture__client').annotate(
            s=Sum('montant')
        ).values('s')[:1]
    
        # Optimisation : On génère le "current_debt_annotated" directement en SQL sans jointure cartésienne
        clients = Client.objects.filter(
            client_type='PROFESSIONNEL',
            plafond__gt=0
        ).exclude(name__icontains='DIVERS').annotate(
            total_billed=Coalesce(Subquery(billed_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
            paid_amount=Coalesce(Subquery(paid_sub, output_field=DecimalField()), Value(0, output_field=DecimalField())),
        ).annotate(
            current_debt_annotated=F('total_billed') - F('paid_amount')
        )
    
        alert_clients = []
        for client in clients:
            debt = client.current_debt_annotated
            if debt > client.plafond:
                alert_clients.append({
                    'id': client.id,
                    'name': client.name,
                    'current_debt': debt,
                    'plafond': client.plafond,
                    'percent': (debt / client.plafond) * 100
                })
    
        # Sort by highest percentage/severity
        alert_clients.sort(key=lambda x: x['percent'], reverse=True)
    
        return Response(alert_clients)
    
