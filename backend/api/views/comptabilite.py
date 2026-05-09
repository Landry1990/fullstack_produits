# -*- coding: utf-8 -*-
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q, F
from django.utils import timezone
from decimal import Decimal
from ..models import CompteComptable, JournalComptable, EcritureComptable, LigneEcriture, ExerciceComptable
from ..serializers import (
    CompteComptableSerializer, JournalComptableSerializer, 
    EcritureComptableSerializer, LigneEcritureSerializer,
    ExerciceComptableSerializer
)

class CompteComptableViewSet(viewsets.ModelViewSet):
    queryset = CompteComptable.objects.all()
    serializer_class = CompteComptableSerializer
    permission_classes = [permissions.IsAuthenticated]

class JournalComptableViewSet(viewsets.ModelViewSet):
    queryset = JournalComptable.objects.all()
    serializer_class = JournalComptableSerializer
    permission_classes = [permissions.IsAuthenticated]

class ExerciceComptableViewSet(viewsets.ModelViewSet):
    queryset = ExerciceComptable.objects.all()
    serializer_class = ExerciceComptableSerializer
    permission_classes = [permissions.IsAuthenticated]

class EcritureComptableViewSet(viewsets.ModelViewSet):
    queryset = EcritureComptable.objects.all()
    serializer_class = EcritureComptableSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """Génère la balance des comptes sur une période."""
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        # 1. Calculer les mouvements par compte
        filters = Q()
        if date_debut: filters &= Q(ecriture__date__gte=date_debut)
        if date_fin: filters &= Q(ecriture__date__lte=date_fin)
        
        mouvements = LigneEcriture.objects.filter(filters).values('compte__numero').annotate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit')
        )
        mouvements_dict = {m['compte__numero']: m for m in mouvements}
        
        # 2. Fusionner avec tous les comptes actifs
        comptes = CompteComptable.objects.filter(is_active=True)
        results = []
        for c in comptes:
            mov = mouvements_dict.get(c.numero, {})
            debit = mov.get('total_debit') or Decimal('0.00')
            credit = mov.get('total_credit') or Decimal('0.00')
            
            solde_debit = Decimal('0.00')
            solde_credit = Decimal('0.00')
            if debit > credit:
                solde_debit = debit - credit
            else:
                solde_credit = credit - debit
                
            results.append({
                'numero': c.numero,
                'libelle': c.libelle,
                'type': c.type,
                'debit': debit,
                'credit': credit,
                'solde_debit': solde_debit,
                'solde_credit': solde_credit
            })
            
        return Response(results)

    @action(detail=False, methods=['get'])
    def compte_resultat(self, request):
        """Génère un compte de résultat simplifié (Produits - Charges)."""
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        filters = Q()
        if date_debut: filters &= Q(ecriture__date__gte=date_debut)
        if date_fin: filters &= Q(ecriture__date__lte=date_fin)
        
        # 1. Produits (Classe 7)
        produits_qs = LigneEcriture.objects.filter(filters, compte__numero__startswith='7')
        total_produits = produits_qs.aggregate(total=Sum('credit') - Sum('debit'))['total'] or Decimal('0.00')
        
        # 2. Charges (Classe 6)
        charges_qs = LigneEcriture.objects.filter(filters, compte__numero__startswith='6')
        total_charges = charges_qs.aggregate(total=Sum('debit') - Sum('credit'))['total'] or Decimal('0.00')
        
        # 3. Variation de stock (603100) calculée dynamiquement (Inventaire Intermittent continu)
        # Valeur actuelle du stock physique
        from ..models import Produit
        from django.db.models import DecimalField
        from django.db.models.functions import Coalesce
        
        valeur_stock_actuel = Produit.objects.filter(is_active=True).aggregate(
            total=Coalesce(Sum(F('stock') * Coalesce(F('pmp'), F('cost_price'))), Decimal('0.00'), output_field=DecimalField())
        )['total']
        
        # Le stock final vient diminuer les charges (ou augmenter les produits)
        # En OHADA, le 603100 est une charge. Si Stock Final > Stock Initial, le solde est créditeur (vient en déduction des charges)
        # Pour simplifier, on l'ajoute virtuellement aux produits pour le calcul du résultat net
        resultat_net = (total_produits + valeur_stock_actuel) - total_charges
        
        details_produits = list(produits_qs.values('compte__numero', 'compte__libelle').annotate(montant=Sum('credit') - Sum('debit')))
        details_produits.append({
            'compte__numero': '603100',
            'compte__libelle': 'Variation des stocks de marchandises (Valeur estimée)',
            'montant': valeur_stock_actuel
        })
        
        return Response({
            'total_produits': total_produits,
            'valeur_stock': valeur_stock_actuel,
            'total_charges': total_charges,
            'resultat_net': resultat_net,
            'details_produits': details_produits,
            'details_charges': charges_qs.values('compte__numero', 'compte__libelle').annotate(montant=Sum('debit') - Sum('credit')),
        })


    @action(detail=False, methods=['get'])
    def bilan(self, request):
        """Génère un bilan simplifié (Actif vs Passif)."""
        date_fin = request.query_params.get('date_fin', timezone.now().date())
        
        # Filtre cumulatif jusqu'à la date de fin
        filters = Q(ecriture__date__lte=date_fin)
        
        # 1. Calculer les soldes de tous les comptes jusqu'à date_fin
        soldes = LigneEcriture.objects.filter(filters).values('compte__numero', 'compte__libelle').annotate(
            solde_actif=Sum('debit') - Sum('credit'),
            solde_passif=Sum('credit') - Sum('debit')
        )
        
        details_actif = []
        details_passif = []
        total_actif = Decimal('0.00')
        total_passif = Decimal('0.00')
        
        # Variables pour calculer le résultat de l'exercice
        total_produits = Decimal('0.00')
        total_charges = Decimal('0.00')
        
        # --- Injection dynamique du stock physique (Inventaire Intermittent continu) ---
        from ..models import Produit
        from django.db.models import DecimalField
        from django.db.models.functions import Coalesce
        
        valeur_stock_actuel = Produit.objects.filter(is_active=True).aggregate(
            total=Coalesce(Sum(F('stock') * Coalesce(F('pmp'), F('cost_price'))), Decimal('0.00'), output_field=DecimalField())
        )['total']
        
        # Le stock va à l'Actif (311000) et vient "augmenter" les produits (ou diminuer les charges, via 603100)
        details_actif.append({
            'numero': '311000',
            'libelle': 'Stocks de Marchandises (Valeur estimée)',
            'solde': valeur_stock_actuel
        })
        total_actif += valeur_stock_actuel
        total_produits += valeur_stock_actuel
        # -------------------------------------------------------------------------------
        
        for s in soldes:
            num = s['compte__numero']
            
            # Calcul du résultat (Classes 6 et 7)
            if num.startswith('7'):
                total_produits += s['solde_passif']  # Produits sont créditeurs
            elif num.startswith('6'):
                total_charges += s['solde_actif']    # Charges sont débiteurs
                
            # Actif (Classes 2, 3, 4, 5 à solde débiteur)
            elif num[0] in ['2', '3', '4', '5'] and s['solde_actif'] > 0:
                details_actif.append({'numero': num, 'libelle': s['compte__libelle'], 'solde': s['solde_actif']})
                total_actif += s['solde_actif']
            
            # Passif (Classes 1, 4, 5 à solde créditeur)
            elif num[0] in ['1', '4', '5'] and s['solde_passif'] > 0:
                details_passif.append({'numero': num, 'libelle': s['compte__libelle'], 'solde': s['solde_passif']})
                total_passif += s['solde_passif']
                
        # Injection du Résultat de l'exercice (Compte 13)
        resultat_net = total_produits - total_charges
        details_passif.append({
            'numero': '13',
            'libelle': 'Résultat de l\'exercice',
            'solde': resultat_net
        })
        total_passif += resultat_net
        
        return Response({
            'total_actif': total_actif,
            'total_passif': total_passif,
            'details_actif': details_actif,
            'details_passif': details_passif,
            'equilibre': total_actif - total_passif
        })

    @action(detail=False, methods=['post'])
    def initialiser_historique(self, request):
        """
        Action pour générer les écritures manquantes pour les factures et paiements passés.
        """
        from ..models import Facture, Caisse, Commande
        from ..signals_comptabilite import generer_ecriture_vente, generer_ecriture_paiement, generer_ecriture_achat
        
        # Cette action peut être longue, à utiliser avec précaution
        count = 0
        for f in Facture.objects.filter(status__in=['VAL', 'PAY'], is_active=True):
            generer_ecriture_vente(None, f, False)
            count += 1
            
        for p in Caisse.objects.filter(statut='completee'):
            generer_ecriture_paiement(None, p, False)
            count += 1
            
        for c in Commande.objects.filter(status='CLOT'):
            generer_ecriture_achat(None, c, False)
            count += 1
            
        return Response({'status': 'success', 'entries_processed': count})
