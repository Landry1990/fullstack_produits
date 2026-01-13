from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q, Avg
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from ..models import Facture, Caisse, FactureProduit

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
    
    @action(detail=False, methods=['get'])
    def ventes_par_tranche(self, request):
        """
        Returns products sold during a time range with aggregated data.
        Columns: nom, qte_vendu, prix_vente, stock_restant
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        if not date_debut or not date_fin:
            return Response({'error': 'date_debut and date_fin are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse datetime and make timezone-aware
        try:
            debut = datetime.fromisoformat(date_debut.replace('Z', '+00:00'))
            fin = datetime.fromisoformat(date_fin.replace('Z', '+00:00'))
            
            # If datetime is naive (no timezone info), assume local timezone
            if debut.tzinfo is None:
                debut = timezone.make_aware(debut, timezone.get_current_timezone())
            if fin.tzinfo is None:
                fin = timezone.make_aware(fin, timezone.get_current_timezone())
                
        except ValueError:
            return Response({'error': 'Invalid datetime format'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Debug logging
        print(f"[VENTES PAR TRANCHE] Recherche de {debut} à {fin}")
        
        # First, check all validated/paid invoices to debug
        all_factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).order_by('-date')[:10]
        
        print(f"[DEBUG] Dernières 10 factures VAL/PAY:")
        for f in all_factures:
            print(f"  - Facture #{f.id} ({f.numero_facture}): {f.date} - Status: {f.status}")
        
        # Get FactureProduit for validated/paid invoices in the time range
        factures_in_range = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=debut,
            date__lte=fin
        )
        
        print(f"[DEBUG] Factures dans la tranche horaire: {factures_in_range.count()}")
        for f in factures_in_range:
            print(f"  - Facture #{f.id}: {f.date}")
        
        facture_produits = FactureProduit.objects.filter(
            facture__in=factures_in_range
        ).select_related('produit').values('produit__id', 'produit__name', 'produit__stock').annotate(
            qte_vendu=Sum('quantity'),
            prix_vente=Avg('selling_price')
        ).order_by('-qte_vendu')
        
        print(f"[VENTES PAR TRANCHE] Trouvé {facture_produits.count()} produits distincts")
        
        # Format results with montant calculation
        results = []
        total_montant = 0
        
        for fp in facture_produits:
            montant = fp['qte_vendu'] * float(fp['prix_vente'])
            total_montant += montant
            results.append({
                'nom': fp['produit__name'],
                'qte_vendu': fp['qte_vendu'],
                'prix_vente': round(float(fp['prix_vente']), 0),
                'montant': round(montant, 0),
                'stock_restant': fp['produit__stock']
            })
        
        # Add total row at the end
        results.append({
            'nom': 'TOTAL',
            'qte_vendu': sum(r['qte_vendu'] for r in results),
            'prix_vente': '-',
            'montant': round(total_montant, 0),
            'stock_restant': '-'
        })
        
        return Response(results)


