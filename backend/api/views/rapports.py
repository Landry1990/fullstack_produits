from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, F, DecimalField, Q
from django.db.models.functions import TruncDate, Coalesce
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from ..models import Facture, FactureProduit, CommandeProduit, Produit

class RapportViewSet(viewsets.ViewSet):
    """
    ViewSet pour les rapports avancés et statistiques historiques.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def valeur_stock_journalier(self, request):
        """
        Reconstruit la valeur du stock jour par jour (Back-casting).
        Retourne : Date, Stock (Coût), Stock (TTC), Achats (Coût), Ventes (TTC), Coût Ventes.
        """
        date_debut_str = request.query_params.get('date_debut')
        date_fin_str = request.query_params.get('date_fin')

        if not date_debut_str or not date_fin_str:
            return Response(
                {'error': 'Les paramètres date_debut et date_fin sont requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            date_debut = datetime.fromisoformat(date_debut_str.replace('Z', '+00:00')).date()
            date_fin = datetime.fromisoformat(date_fin_str.replace('Z', '+00:00')).date()
        except ValueError:
            return Response({'error': 'Format de date invalide (ISO attendu).'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. État Initial (Aujourd'hui / Maintenant)
        # On calcule le stock actuel global
        produits = Produit.objects.all().only('stock', 'pmp', 'selling_price')
        
        current_stock_cost = Decimal('0')
        current_stock_ttc = Decimal('0')
        
        for p in produits:
            # PMP peut être null, default 0
            cost = p.pmp or Decimal('0')
            price = p.selling_price or Decimal('0')
            stock = p.stock or 0
            
            current_stock_cost += (Decimal(str(stock)) * cost)
            current_stock_ttc += (Decimal(str(stock)) * price)

        # 2. Récupérer les mouvements (Ventes et Achats) sur la période étendue
        # On a besoin des mouvements de (Now) jusqu'à (Date Debut) pour remonter le temps
        # Mais pour l'affichage, on s'arrête à Date Fin.
        # Donc Back-cast de Now jusqu'à Date Debut.
        
        today = timezone.now().date()
        # Si date_fin est dans le futur ou aujourd'hui, on part d'aujourd'hui.
        # Si date_fin est dans le passé, on doit quand même partir d'aujourd'hui pour reconstruire l'état passé correctement.
        
        # Mouvements : Ventes (FactureProduit)
        ventes = FactureProduit.objects.filter(
            facture__date__date__gte=date_debut,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            jour=TruncDate('facture__date')
        ).values('jour').annotate(
            ventes_ttc=Sum(F('quantity') * F('selling_price'), output_field=DecimalField()),
            cout_ventes=Sum(F('quantity') * F('produit__pmp'), output_field=DecimalField())
        ).order_by('-jour')
        
        # Mouvements : Achats (CommandeProduit Cloturée)
        achats = CommandeProduit.objects.filter(
            commande__date_cloture__date__gte=date_debut,
            commande__status='CLOT'
        ).annotate(
            jour=TruncDate('commande__date_cloture')
        ).values('jour').annotate(
            achats_cout=Sum((F('quantity') + F('unites_gratuites')) * F('price_cost'), output_field=DecimalField()),
            achats_ttc_virtuel=Sum((F('quantity') + F('unites_gratuites')) * F('produit__selling_price'), output_field=DecimalField())
        ).order_by('-jour')
        
        # Indexer par date
        mouvements_map = {}
        
        # Fusionner les dates pour itérer
        all_dates = set()
        for v in ventes:
            d = v['jour']
            all_dates.add(d)
            if d not in mouvements_map: mouvements_map[d] = {'ventes_ttc': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0}
            mouvements_map[d]['ventes_ttc'] = v['ventes_ttc'] or 0
            mouvements_map[d]['cout_ventes'] = v['cout_ventes'] or 0
            
        for a in achats:
            d = a['jour']
            all_dates.add(d)
            if d not in mouvements_map: mouvements_map[d] = {'ventes_ttc': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0}
            mouvements_map[d]['achats_cout'] = a['achats_cout'] or 0
            mouvements_map[d]['achats_ttc'] = a['achats_ttc_virtuel'] or 0
            
        # 3. Back-casting
        resultats = []
        
        # Itérer de Aujourd'hui jusqu'à Date Début (Reculons)
        cursor_date = today
        running_cost = float(current_stock_cost)
        running_ttc = float(current_stock_ttc)
        
        # On inclut tous les jours entre today et date_debut pour la continuité
        delta = (today - date_debut).days
        
        for i in range(delta + 1): # +1 pour inclure date_debut
            current_day = today - timedelta(days=i)
            
            # Récupérer les mouvements de CE jour
            mops = mouvements_map.get(current_day, {'ventes_ttc': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0})
            
            ventes_ttc = float(mops['ventes_ttc'] or 0)
            cout_ventes = float(mops['cout_ventes'] or 0)
            achats_cout = float(mops['achats_cout'] or 0)
            achats_ttc = float(mops['achats_ttc'] or 0)
            
            # État Fin de Journée = running_values
            end_day_cost = running_cost
            end_day_ttc = running_ttc
            
            # Calculer Start of Day (qui sera le End of Day de la veille)
            # Stock Fin = Stock Début + Achats - Ventes
            # => Stock Début = Stock Fin - Achats + Ventes
            
            start_day_cost = end_day_cost - achats_cout + cout_ventes
            start_day_ttc = end_day_ttc - achats_ttc + ventes_ttc
            
            # Si le jour est dans la plage demandée, on l'ajoute aux résultats
            if date_debut <= current_day <= date_fin:
                marge = ventes_ttc - cout_ventes
                marge_pourcent = 0
                if ventes_ttc > 0:
                    marge_pourcent = (marge / ventes_ttc) * 100
                
                resultats.append({
                    'date': current_day.strftime('%Y-%m-%d'),
                    'valeur_stock_cout': round(end_day_cost, 0), # On affiche la valeur en Fin de journée généralement
                    'valeur_stock_ttc': round(end_day_ttc, 0),
                    'achats_cout': round(achats_cout, 0),
                    'ventes_ttc': round(ventes_ttc, 0),
                    'cout_ventes': round(cout_ventes, 0),
                    'marge': round(marge, 0),
                    'marge_pourcent': round(marge_pourcent, 1)
                })
            
            # Mise à jour pour l'itération suivante (jour précédent)
            running_cost = start_day_cost
            running_ttc = start_day_ttc

        return Response(resultats)
