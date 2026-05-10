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

from ..filters import EcritureComptableFilter

class EcritureComptableViewSet(viewsets.ModelViewSet):
    queryset = EcritureComptable.objects.all().select_related('journal', 'exercice').prefetch_related('lignes', 'lignes__compte')
    serializer_class = EcritureComptableSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = EcritureComptableFilter

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """
        Génère la balance des comptes sur une période (OHADA complète).
        Structure: Solde ouverture | Mouvements période | Solde clôture
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        # 1. Calculer les soldes d'ouverture (cumul avant date_debut)
        solde_ouverture = {}
        if date_debut:
            ouverture_filters = Q(ecriture__date__lt=date_debut)
            ouverture_qs = LigneEcriture.objects.filter(ouverture_filters).values('compte__numero').annotate(
                debit_ouv=Sum('debit'),
                credit_ouv=Sum('credit')
            )
            for item in ouverture_qs:
                solde_ouverture[item['compte__numero']] = {
                    'debit': item['debit_ouv'] or Decimal('0.00'),
                    'credit': item['credit_ouv'] or Decimal('0.00')
                }
        
        # 2. Calculer les mouvements de la période
        mouvements_filters = Q()
        if date_debut: mouvements_filters &= Q(ecriture__date__gte=date_debut)
        if date_fin: mouvements_filters &= Q(ecriture__date__lte=date_fin)
        
        mouvements_qs = LigneEcriture.objects.filter(mouvements_filters).values('compte__numero').annotate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit')
        )
        mouvements_dict = {m['compte__numero']: m for m in mouvements_qs}
        
        # 3. Construire la balance complète OHADA
        comptes = CompteComptable.objects.filter(is_active=True)
        results = []
        total_ouv_debit = total_ouv_credit = Decimal('0.00')
        total_mvt_debit = total_mvt_credit = Decimal('0.00')
        total_clo_debit = total_clo_credit = Decimal('0.00')
        
        for c in comptes:
            # Solde d'ouverture
            ouv = solde_ouverture.get(c.numero, {'debit': Decimal('0.00'), 'credit': Decimal('0.00')})
            ouv_solde = ouv['debit'] - ouv['credit']
            ouv_debit = ouv_solde if ouv_solde > 0 else Decimal('0.00')
            ouv_credit = abs(ouv_solde) if ouv_solde < 0 else Decimal('0.00')
            
            # Mouvements période
            mov = mouvements_dict.get(c.numero, {})
            mvt_debit = mov.get('total_debit') or Decimal('0.00')
            mvt_credit = mov.get('total_credit') or Decimal('0.00')
            
            # Solde de clôture (ouverture + mouvements)
            solde_cloture = (ouv['debit'] + mvt_debit) - (ouv['credit'] + mvt_credit)
            clo_debit = solde_cloture if solde_cloture > 0 else Decimal('0.00')
            clo_credit = abs(solde_cloture) if solde_cloture < 0 else Decimal('0.00')
            
            # Totaux
            total_ouv_debit += ouv_debit
            total_ouv_credit += ouv_credit
            total_mvt_debit += mvt_debit
            total_mvt_credit += mvt_credit
            total_clo_debit += clo_debit
            total_clo_credit += clo_credit
            
            results.append({
                'numero': c.numero,
                'libelle': c.libelle,
                'type': c.type,
                'ouverture_debit': ouv_debit,
                'ouverture_credit': ouv_credit,
                'mouvement_debit': mvt_debit,
                'mouvement_credit': mvt_credit,
                'cloture_debit': clo_debit,
                'cloture_credit': clo_credit
            })
            
        return Response({
            'comptes': results,
            'totaux': {
                'ouverture_debit': total_ouv_debit,
                'ouverture_credit': total_ouv_credit,
                'mouvement_debit': total_mvt_debit,
                'mouvement_credit': total_mvt_credit,
                'cloture_debit': total_clo_debit,
                'cloture_credit': total_clo_credit
            },
            'equilibre': {
                'ouverture': total_ouv_debit == total_ouv_credit,
                'mouvements': total_mvt_debit == total_mvt_credit,
                'cloture': total_clo_debit == total_clo_credit
            }
        })

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

    @action(detail=False, methods=['get'], url_path='grand_livre_tiers')
    def grand_livre_tiers(self, request):
        """
        Grand livre auxiliaire des comptes tiers (411 Clients, 401 Fournisseurs).
        Retourne le détail des mouvements avec lettrage.
        """
        compte_numero = request.query_params.get('compte')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        filters = Q(compte__numero__startswith='4')  # Comptes tiers seulement
        
        if compte_numero:
            filters &= Q(compte__numero=compte_numero)
        if date_debut:
            filters &= Q(ecriture__date__gte=date_debut)
        if date_fin:
            filters &= Q(ecriture__date__lte=date_fin)
        
        lignes = LigneEcriture.objects.filter(filters).select_related(
            'ecriture', 'ecriture__journal', 'compte'
        ).prefetch_related('lettrages').order_by('ecriture__date', 'ecriture__numero_piece')
        
        # Calculer le solde progressif
        solde = Decimal('0.00')
        results = []
        
        for ligne in lignes:
            solde += (ligne.debit - ligne.credit)
            
            # Déterminer si lettre (check si lié à un lettrage équilibré)
            lettrage_info = None
            lettrages = list(ligne.lettrages.all())  # type: ignore[attr-defined]
            if lettrages:
                lett = lettrages[0]  # Prendre le premier lettrage
                lettrage_info = {
                    'code': lett.code,
                    'date': lett.date_lettrage,
                    'est_equilibre': lett.est_equilibre
                }
            
            results.append({
                'date': ligne.ecriture.date,
                'numero_piece': ligne.ecriture.numero_piece,
                'reference': ligne.ecriture.reference,
                'libelle': ligne.libelle_ligne or ligne.ecriture.libelle,
                'debit': ligne.debit,
                'credit': ligne.credit,
                'solde_progressif': solde,
                'lettrage': lettrage_info,
                'compte': ligne.compte.numero,
                'compte_libelle': ligne.compte.libelle,
                'journal': ligne.ecriture.journal.code
            })
        
        # Résumé par compte
        comptes_summary = {}
        for ligne in lignes:
            num = ligne.compte.numero
            if num not in comptes_summary:
                comptes_summary[num] = {
                    'libelle': ligne.compte.libelle,
                    'total_debit': Decimal('0.00'),
                    'total_credit': Decimal('0.00')
                }
            comptes_summary[num]['total_debit'] += ligne.debit
            comptes_summary[num]['total_credit'] += ligne.credit
        
        # Calculer les soldes
        for num in comptes_summary:
            s = comptes_summary[num]
            s['solde'] = s['total_debit'] - s['total_credit']
        
        return Response({
            'lignes': results,
            'comptes': comptes_summary,
            'date_debut': date_debut,
            'date_fin': date_fin
        })

    @action(detail=False, methods=['post'], url_path='creer_lettrage')
    def creer_lettrage(self, request):
        """
        Créer un lettrage entre plusieurs lignes d'écriture.
        Les lignes doivent appartenir au même compte tiers et avoir un solde = 0.
        """
        from ..models import Lettrage
        
        ligne_ids = request.data.get('ligne_ids', [])
        compte_id = request.data.get('compte_id')
        commentaire = request.data.get('commentaire', '')
        
        if not ligne_ids or len(ligne_ids) < 2:
            return Response(
                {'error': 'Au moins 2 lignes sont nécessaires pour un lettrage'},
                status=400
            )
        
        try:
            compte = CompteComptable.objects.get(id=compte_id, numero__startswith='4')
        except CompteComptable.DoesNotExist:
            return Response({'error': 'Compte tiers invalide'}, status=400)
        
        # Vérifier que toutes les lignes existent et appartiennent au même compte
        lignes = LigneEcriture.objects.filter(id__in=ligne_ids, compte=compte)
        if lignes.count() != len(ligne_ids):
            return Response(
                {'error': 'Certaines lignes sont introuvables ou ne correspondent pas au compte'},
                status=400
            )
        
        # Calculer le solde
        total_debit = sum(l.debit for l in lignes)
        total_credit = sum(l.credit for l in lignes)
        
        # Créer le lettrage
        lettrage = Lettrage.objects.create(
            compte_tiers=compte,
            montant_total=total_debit - total_credit,
            est_equilibre=(total_debit == total_credit),
            commentaire=commentaire,
            created_by=request.user if request.user.is_authenticated else None
        )
        
        # Associer les lignes
        lettrage.lignes.set(lignes)
        lettrage.save()
        
        return Response({
            'id': lettrage.pk,  # type: ignore[attr-defined]
            'code': lettrage.code,
            'est_equilibre': lettrage.est_equilibre,
            'montant_total': lettrage.montant_total,
            'lignes_count': len(ligne_ids)
        })
