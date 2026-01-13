from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate
from datetime import datetime
from decimal import Decimal
from .models import Facture, Caisse

class HistoriqueVentesViewSet(viewsets.ViewSet):
    """API endpoint for daily sales history."""
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        # Get query parameters
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        # Base queryset: only validated or paid invoices (exclude cancelled, brouillon, and proforma)
        factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )
        
        # Apply date filters
        if date_debut:
            factures = factures.filter(date__date__gte=date_debut)
        if date_fin:
            factures = factures.filter(date__date__lte=date_fin)
        
        # Group by date and aggregate
        daily_stats = factures.annotate(
            jour=TruncDate('date')
        ).values('jour').annotate(
            nb_ventes=Count('id'),
            ca_ht=Sum('total_ht'),
            ca_ttc=Sum('total_ttc'),
            tva=Sum('total_tva')
        ).order_by('-jour')
        
        # Get payment modes for each day
        results = []
        for day in daily_stats:
            jour = day['jour']
            nb_ventes = day['nb_ventes'] or 0
            ca_ttc = float(day['ca_ttc'] or 0)
            
            # Calculate average basket
            panier_moyen = ca_ttc / nb_ventes if nb_ventes > 0 else 0
            
            # Get payment modes for this day
            paiements = Caisse.objects.filter(
                facture__date__date=jour,
                statut='completee'
            ).exclude(mode_paiement='en_compte').values('mode_paiement').annotate(
                total=Sum('montant')
            )
            
            # Build payment modes dict
            modes = {
                'especes': 0,
                'carte': 0,
                'cheque': 0,
                'virement': 0,
                'om': 0,
                'momo': 0
            }
            
            for p in paiements:
                mode = p['mode_paiement']
                if mode in modes:
                    modes[mode] = float(p['total'] or 0)
            
            results.append({
                'date': jour.strftime('%Y-%m-%d'),
                'nb_ventes': nb_ventes,
                'panier_moyen': round(panier_moyen, 2),
                'ca_ht': float(day['ca_ht'] or 0),
                'tva': float(day['tva'] or 0),
                'ca_ttc': ca_ttc,
                **modes
            })
        
        return Response(results)
