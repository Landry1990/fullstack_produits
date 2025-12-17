from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, F, DecimalField, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from api.models import Facture, FactureProduitAllocation, Caisse, FactureProduit


class RapportViewSet(viewsets.ViewSet):
    """
    API endpoint pour les rapports mensuels.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def rapport_mensuel(self, request):
        """
        Génère un rapport mensuel avec:
        - CA TTC/HT
        - Marge globale (montant + pourcentage)
        - Détails encaissements par mode de paiement
        - CA par taux de TVA
        - Top 10 produits
        
        Paramètre: mois (YYYY-MM)
        """
        mois = request.query_params.get('mois')
        
        if not mois:
            return Response({
                'detail': 'Le paramètre mois (YYYY-MM) est requis.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Parse le mois (YYYY-MM)
            date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
            # Dernier jour du mois
            if date_debut.month == 12:
                date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
            else:
                date_fin = date_debut.replace(month=date_debut.month + 1, day=1)
            
            date_debut = timezone.make_aware(date_debut)
            date_fin = timezone.make_aware(date_fin)
        except ValueError:
            return Response({
                'detail': 'Format de mois invalide. Utilisez YYYY-MM.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Récupérer les factures du mois (validées ou payées)
        factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=date_debut,
            date__lt=date_fin
        )
        
        # 2. Calculer CA TTC et HT
        ca_ttc = Decimal('0.00')
        ca_ht = Decimal('0.00')
        nb_ventes = factures.count()
        
        for facture in factures:
            ca_ttc += facture.total_ttc
            ca_ht += facture.total_ht
        
        # 3. Calculer marge via allocations FIFO
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=factures
        )
        
        cout_achat_total = Decimal('0.00')
        for alloc in allocations:
            cout_achat_total += alloc.cost_price * alloc.quantity
        
        marge_brute = ca_ht - cout_achat_total
        marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')
        
        # 4. Encaissements réels (hors 'en compte')
        encaissements = Caisse.objects.filter(
            facture__in=factures,
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('mode_paiement').annotate(
            total=Sum('montant')
        ).order_by('-total')
        
        encaissements_data = [
            {
                'mode': enc['mode_paiement'],
                'mode_label': dict(Caisse.MODES_PAIEMENT).get(enc['mode_paiement'], enc['mode_paiement']),
                'montant': enc['total']
            }
            for enc in encaissements
        ]
        
        # 5. Ventes à crédit (en compte)
        ventes_en_compte = Caisse.objects.filter(
            facture__in=factures,
            statut='completee',
            mode_paiement='en_compte'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        # 5. CA par taux de TVA
        # Grouper  par taux de TVA unique de chaque facture
        tva_groups = factures.values('tva').annotate(
            ca_ht_total=Sum(F('produits__quantity') * F('produits__selling_price'), output_field=DecimalField()),
            count=Sum(1)
        ).order_by('-ca_ht_total')
        
        ca_par_tva = []
        for group in tva_groups:
            taux = group['tva']
            ca_ht_tva = group['ca_ht_total'] or Decimal('0.00')
            montant_tva = ca_ht_tva * (taux / 100)
            ca_par_tva.append({
                'taux': float(taux),
                'ca_ht': ca_ht_tva,
                'montant_tva': montant_tva,
                'ca_ttc': ca_ht_tva + montant_tva
            })
        
        # Retourner le rapport complet
        return Response({
            'mois': mois,
            'periode': {
                'debut': date_debut.isoformat(),
                'fin': date_fin.isoformat()
            },
            'ca': {
                'ca_ttc': ca_ttc,
                'ca_ht': ca_ht,
                'nb_ventes': nb_ventes
            },
            'marge': {
                'cout_achat': cout_achat_total,
                'marge_brute': marge_brute,
                'marge_pct': round(marge_pct, 2)
            },
            'encaissements': encaissements_data,
            'ventes_en_compte': ventes_en_compte,
            'ca_par_tva': ca_par_tva
        })
