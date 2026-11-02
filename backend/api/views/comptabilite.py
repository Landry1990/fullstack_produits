from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.db.models import F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..audit_helpers import log_audit
from ..models import (
    AuditLog,
    CompteComptable,
    EcritureComptable,
    ExerciceComptable,
    JournalComptable,
    LigneEcriture,
)
from ..serializers import (
    CompteComptableSerializer,
    EcritureComptableSerializer,
    ExerciceComptableSerializer,
    JournalComptableSerializer,
)
from ..utils.validation import parse_date_param, parse_id


class IsComptaWriteAllowed(permissions.BasePermission):
    """Lecture pour tout utilisateur authentifié ; écriture réservée au
    staff/superuser ou aux profils de rôle COMPTABLE/PHARMACIEN."""
    message = "Vous n'avez pas les droits pour modifier la comptabilité."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if user.is_superuser or user.is_staff:
            return True
        return getattr(getattr(user, 'profile', None), 'role', None) in ('COMPTABLE', 'PHARMACIEN')


class CompteComptableViewSet(viewsets.ModelViewSet):
    queryset = CompteComptable.objects.all()
    serializer_class = CompteComptableSerializer
    permission_classes = [IsComptaWriteAllowed]

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='CompteComptable',
            object_id=instance.pk,
            description=f"Création compte comptable « {instance} » (#{instance.pk})",
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='CompteComptable',
            object_id=instance.pk,
            description=f"Modification compte comptable « {instance} » (#{instance.pk})",
            details={'fields': sorted(serializer.validated_data.keys())},
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='CompteComptable',
            object_id=instance.pk,
            description=f"Suppression compte comptable « {instance} » (#{instance.pk})",
            request=self.request,
        )
        instance.delete()

class JournalComptableViewSet(viewsets.ModelViewSet):
    queryset = JournalComptable.objects.all()
    serializer_class = JournalComptableSerializer
    permission_classes = [IsComptaWriteAllowed]

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='JournalComptable',
            object_id=instance.pk,
            description=f"Création journal comptable « {instance} » (#{instance.pk})",
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='JournalComptable',
            object_id=instance.pk,
            description=f"Modification journal comptable « {instance} » (#{instance.pk})",
            details={'fields': sorted(serializer.validated_data.keys())},
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='JournalComptable',
            object_id=instance.pk,
            description=f"Suppression journal comptable « {instance} » (#{instance.pk})",
            request=self.request,
        )
        instance.delete()

class ExerciceComptableViewSet(viewsets.ModelViewSet):
    queryset = ExerciceComptable.objects.all()
    serializer_class = ExerciceComptableSerializer
    permission_classes = [IsComptaWriteAllowed]

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='ExerciceComptable',
            object_id=instance.pk,
            description=f"Création exercice comptable « {instance.nom} » (#{instance.pk})",
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='ExerciceComptable',
            object_id=instance.pk,
            description=f"Modification exercice comptable « {instance.nom} » (#{instance.pk})",
            details={
                'fields': sorted(serializer.validated_data.keys()),
                'est_cloture': instance.est_cloture,
            },
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='ExerciceComptable',
            object_id=instance.pk,
            description=f"Suppression exercice comptable « {instance.nom} » (#{instance.pk})",
            request=self.request,
        )
        instance.delete()

from ..filters import EcritureComptableFilter


class EcritureComptableViewSet(viewsets.ModelViewSet):
    queryset = EcritureComptable.objects.all().select_related('journal', 'exercice').prefetch_related('lignes', 'lignes__compte', 'dotations_amortissement')
    serializer_class = EcritureComptableSerializer
    permission_classes = [IsComptaWriteAllowed]
    filterset_class = EcritureComptableFilter

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """
        Génère la balance des comptes sur une période (OHADA complète).
        Structure: Solde ouverture | Mouvements période | Solde clôture
        """
        # parse_date_param → None si absent, ValidationError (400) si invalide
        # (chaîne brute dans les filtres ORM → ValidationError Django → 500).
        date_debut = parse_date_param(request.query_params.get('date_debut'), field='date_debut')
        date_fin = parse_date_param(request.query_params.get('date_fin'), field='date_fin')

        # Cache: 5 min pour la balance
        cache_key = f"compta_balance:{date_debut}:{date_fin}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        
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
            
        response_data = {
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
        }
        cache.set(cache_key, response_data, 300)  # 5 min
        return Response(response_data)

    @action(detail=False, methods=['get'])
    def compte_resultat(self, request):
        """Génère un compte de résultat simplifié (Produits - Charges)."""
        date_debut = parse_date_param(request.query_params.get('date_debut'), field='date_debut')
        date_fin = parse_date_param(request.query_params.get('date_fin'), field='date_fin')

        # Cache: 5 min
        cache_key = f"compta_resultat:{date_debut}:{date_fin}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        
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
        from django.db.models import DecimalField
        from django.db.models.functions import Coalesce

        from ..models import Produit
        
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
        
        response_data = {
            'total_produits': total_produits,
            'valeur_stock': valeur_stock_actuel,
            'total_charges': total_charges,
            'resultat_net': resultat_net,
            'details_produits': details_produits,
            'details_charges': charges_qs.values('compte__numero', 'compte__libelle').annotate(montant=Sum('debit') - Sum('credit')),
        }
        cache.set(cache_key, response_data, 300)
        return Response(response_data)


    @action(detail=False, methods=['get'])
    def bilan(self, request):
        """Génère un bilan simplifié (Actif vs Passif)."""
        # Paramètre absent → date du jour ; invalide → 400.
        date_fin = parse_date_param(
            request.query_params.get('date_fin'), field='date_fin'
        ) or timezone.now().date()
        
        # Cache: 5 min
        cache_key = f"compta_bilan:{date_fin}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        
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
        from django.db.models import DecimalField
        from django.db.models.functions import Coalesce

        from ..models import Produit
        
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
        
        response_data = {
            'total_actif': total_actif,
            'total_passif': total_passif,
            'details_actif': details_actif,
            'details_passif': details_passif,
            'equilibre': total_actif - total_passif
        }
        cache.set(cache_key, response_data, 300)  # 5 min
        return Response(response_data)

    @action(detail=False, methods=['get'])
    def rapport_tva(self, request):
        """
        Récapitulatif TVA pour déclaration (DGI — Cameroun 19,25 %).
        Agrège les lignes d'écriture sur les comptes TVA (443* collectée,
        445* déductible) par mois sur la période demandée.
        """
        date_debut = parse_date_param(request.query_params.get('date_debut'), field='date_debut')
        date_fin = parse_date_param(request.query_params.get('date_fin'), field='date_fin')

        filters = Q(compte__numero__startswith='443') | Q(compte__numero__startswith='445')
        if date_debut:
            filters &= Q(ecriture__date__gte=date_debut)
        if date_fin:
            filters &= Q(ecriture__date__lte=date_fin)

        rows = (
            LigneEcriture.objects.filter(filters)
            .annotate(mois=TruncMonth('ecriture__date'))
            .values('mois', 'compte__numero')
            .annotate(total_debit=Sum('debit'), total_credit=Sum('credit'))
            .order_by('mois')
        )

        # Regroupement par mois : TVA collectée (crédit 443*) − TVA déductible (débit 445*)
        par_mois = {}
        for r in rows:
            key = r['mois'].strftime('%Y-%m') if r['mois'] else 'indetermine'
            m = par_mois.setdefault(key, {'tva_collectee': Decimal('0'), 'tva_deductible': Decimal('0')})
            if str(r['compte__numero']).startswith('443'):
                m['tva_collectee'] += (r['total_credit'] or 0) - (r['total_debit'] or 0)
            else:
                m['tva_deductible'] += (r['total_debit'] or 0) - (r['total_credit'] or 0)

        details = [
            {
                'mois': mois,
                'tva_collectee': float(m['tva_collectee']),
                'tva_deductible': float(m['tva_deductible']),
                'tva_nette': float(m['tva_collectee'] - m['tva_deductible']),
            }
            for mois, m in par_mois.items()
        ]
        total_collectee = sum(m['tva_collectee'] for m in par_mois.values())
        total_deductible = sum(m['tva_deductible'] for m in par_mois.values())

        return Response({
            'periode': {'debut': str(date_debut) if date_debut else None, 'fin': str(date_fin) if date_fin else None},
            'details': details,
            'total_tva_collectee': float(total_collectee),
            'total_tva_deductible': float(total_deductible),
            'tva_nette_a_payer': float(total_collectee - total_deductible),
            'note': 'Valeur positive = TVA à reverser au Trésor ; négative = crédit de TVA reportable.',
        })

    @action(detail=False, methods=['get'], url_path='export')
    def export_document(self, request):
        """
        Exporte un état comptable en Excel ou PDF.
        Params : type (balance|resultat|bilan|tva|ecritures|grand_livre|fec),
                 fmt (excel|pdf|txt — ignoré pour fec : format normé),
                 date_debut, date_fin, journal_code (types ecritures/fec).
                 ⚠️ le param s'appelle fmt : « format » est réservé par DRF
                 (négociation de contenu → 404 si le renderer n'existe pas).
        """
        from ..services.compta_exports import DOC_TYPES, FORMATS, build_compta_export

        doc_type = request.query_params.get('type')
        fmt = request.query_params.get('fmt', 'excel')
        if doc_type not in DOC_TYPES:
            return Response({'error': f"Type invalide — attendu : {', '.join(DOC_TYPES)}"}, status=400)
        if fmt not in FORMATS:
            return Response({'error': f"Format invalide — attendu : {', '.join(FORMATS)}"}, status=400)

        date_debut = parse_date_param(request.query_params.get('date_debut'), field='date_debut')
        date_fin = parse_date_param(request.query_params.get('date_fin'), field='date_fin')

        # Réutilise les calculs des actions existantes (Response.data = dict brut)
        if doc_type == 'balance':
            data = self.balance(request).data
        elif doc_type == 'resultat':
            data = self.compte_resultat(request).data
        elif doc_type == 'bilan':
            data = self.bilan(request).data
        elif doc_type == 'tva':
            data = self.rapport_tva(request).data
        elif doc_type == 'ecritures':
            data = self._ecritures_export_data(request, date_debut, date_fin)
        elif doc_type == 'grand_livre':
            data = self._grand_livre_export_data(request, date_debut, date_fin)
        elif doc_type == 'fec':
            data = self._fec_export_data(request, date_debut, date_fin)
        else:  # liasse
            from ..services.compta_liasse import compute_liasse
            data = compute_liasse(date_debut, date_fin)

        return build_compta_export(doc_type, fmt, data, date_debut, date_fin)

    @staticmethod
    def _lignes_filters(request, date_debut, date_fin):
        """Filtre commun des lignes/écritures pour les exports tabulaires."""
        filters = Q()
        if date_debut:
            filters &= Q(ecriture__date__gte=date_debut)
        if date_fin:
            filters &= Q(ecriture__date__lte=date_fin)
        journal_code = request.query_params.get('journal_code')
        if journal_code:
            filters &= Q(ecriture__journal__code=journal_code)
        return filters

    @classmethod
    def _ecritures_export_data(cls, request, date_debut, date_fin):
        """Lignes d'écritures à plat pour l'export journal (toutes, non paginées)."""
        lignes_qs = LigneEcriture.objects.filter(
            cls._lignes_filters(request, date_debut, date_fin)
        ).select_related('ecriture__journal', 'compte').order_by(
            'ecriture__date', 'ecriture__numero_piece')

        lignes = []
        total_debit = total_credit = Decimal('0.00')
        for l in lignes_qs:
            lignes.append({
                'date': l.ecriture.date,
                'numero_piece': l.ecriture.numero_piece,
                'journal': l.ecriture.journal.code if l.ecriture.journal else '',
                'compte': l.compte.numero if l.compte else '',
                'libelle': l.libelle_ligne or l.ecriture.libelle,
                'debit': l.debit,
                'credit': l.credit,
            })
            total_debit += l.debit
            total_credit += l.credit

        return {'lignes': lignes, 'total_debit': total_debit, 'total_credit': total_credit}

    @classmethod
    def _grand_livre_export_data(cls, request, date_debut, date_fin):
        """Grand livre général : toutes les lignes triées par compte puis date,
        avec solde progressif recalculé par compte."""
        lignes_qs = LigneEcriture.objects.filter(
            cls._lignes_filters(request, date_debut, date_fin)
        ).select_related('ecriture__journal', 'compte').order_by(
            'compte__numero', 'ecriture__date', 'ecriture__numero_piece')

        lignes = []
        soldes = {}
        total_debit = total_credit = Decimal('0.00')
        for l in lignes_qs:
            num = l.compte.numero if l.compte else ''
            soldes[num] = soldes.get(num, Decimal('0.00')) + (l.debit - l.credit)
            lignes.append({
                'compte': num,
                'date': l.ecriture.date,
                'numero_piece': l.ecriture.numero_piece,
                'journal': l.ecriture.journal.code if l.ecriture.journal else '',
                'libelle': l.libelle_ligne or l.ecriture.libelle,
                'debit': l.debit,
                'credit': l.credit,
                'solde_progressif': soldes[num],
            })
            total_debit += l.debit
            total_credit += l.credit

        return {'lignes': lignes, 'total_debit': total_debit, 'total_credit': total_credit}

    @classmethod
    def _fec_export_data(cls, request, date_debut, date_fin):
        """Lignes triées journal/pièce pour le FEC (format normalisé)."""
        lignes_qs = LigneEcriture.objects.filter(
            cls._lignes_filters(request, date_debut, date_fin)
        ).select_related('ecriture__journal', 'compte').prefetch_related(
            'lettrages').order_by(
            'ecriture__journal__code', 'ecriture__numero_piece', 'id')

        lignes = []
        for l in lignes_qs:
            e = l.ecriture
            lett = l.lettrages.first()
            lignes.append({
                'journal_code': e.journal.code if e.journal else '',
                'journal_lib': e.journal.nom if e.journal else '',
                'numero_piece': e.numero_piece,
                'date': e.date,
                'compte': l.compte.numero if l.compte else '',
                'compte_libelle': l.compte.libelle if l.compte else '',
                'reference': e.reference,
                'libelle': l.libelle_ligne or e.libelle,
                'debit': l.debit,
                'credit': l.credit,
                'lettrage': lett.code if lett else '',
                'date_lettrage': lett.date_lettrage if lett else None,
            })
        return {'lignes': lignes}

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def initialiser_historique(self, request):
        """
        Action pour générer les écritures manquantes pour les factures et paiements passés.
        """
        from ..models import Caisse, Commande, Facture
        from ..signals_comptabilite import (
            generer_ecriture_achat,
            generer_ecriture_paiement,
            generer_ecriture_vente,
        )
        
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

        log_audit(
            user=request.user,
            action=AuditLog.Action.OTHER,
            model_name='EcritureComptable',
            object_id='BULK',
            description=f"Initialisation de l'historique comptable : {count} pièce(s) regénérée(s)",
            details={'entries_processed': count},
            request=request,
        )

        return Response({'status': 'success', 'entries_processed': count})

    @action(detail=False, methods=['get'], url_path='grand_livre_tiers')
    def grand_livre_tiers(self, request):
        """
        Grand livre auxiliaire des comptes tiers (411 Clients, 401 Fournisseurs).
        Retourne le détail des mouvements avec lettrage.
        """
        compte_numero = request.query_params.get('compte')
        date_debut = parse_date_param(request.query_params.get('date_debut'), field='date_debut')
        date_fin = parse_date_param(request.query_params.get('date_fin'), field='date_fin')

        # Cache: 5 min
        cache_key = f"compta_grand_livre:{date_debut}:{date_fin}:{compte_numero}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        
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
        for num, s in comptes_summary.items():
            s['solde'] = s['total_debit'] - s['total_credit']
        
        response_data = {
            'lignes': results,
            'comptes': comptes_summary,
            'date_debut': date_debut,
            'date_fin': date_fin
        }
        cache.set(cache_key, response_data, 300)  # 5 min
        return Response(response_data)

    @action(detail=False, methods=['post'], url_path='creer_lettrage')
    @transaction.atomic
    def creer_lettrage(self, request):
        """
        Créer un lettrage entre plusieurs lignes d'écriture.
        Les lignes doivent appartenir au même compte tiers et avoir un solde = 0.
        """
        from ..models import Lettrage
        
        ligne_ids = request.data.get('ligne_ids', [])
        compte_id = request.data.get('compte_id')
        commentaire = request.data.get('commentaire', '')

        if not isinstance(ligne_ids, (list, tuple)) or len(ligne_ids) < 2:
            return Response(
                {'error': 'Au moins 2 lignes sont nécessaires pour un lettrage'},
                status=400
            )

        # Chaque id doit être un entier positif : 'abc' dans id__in lèverait
        # ValueError → 500. parse_id lève ValidationError (400).
        ligne_ids = [parse_id(lid, field='ligne_ids') for lid in ligne_ids]

        try:
            compte = CompteComptable.objects.get(id=int(compte_id), numero__startswith='4')
        except (CompteComptable.DoesNotExist, TypeError, ValueError):
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

        log_audit(
            user=request.user,
            action=AuditLog.Action.OTHER,
            model_name='Lettrage',
            object_id=lettrage.pk,
            description=f"Création lettrage {lettrage.code} sur compte {compte.numero} ({len(ligne_ids)} ligne(s))",
            details={
                'code': lettrage.code,
                'compte_id': compte.pk,
                'compte_numero': compte.numero,
                'ligne_ids': ligne_ids,
                'est_equilibre': lettrage.est_equilibre,
                'montant_total': str(lettrage.montant_total),
            },
            request=request,
        )

        return Response({
            'id': lettrage.pk,  # type: ignore[attr-defined]
            'code': lettrage.code,
            'est_equilibre': lettrage.est_equilibre,
            'montant_total': lettrage.montant_total,
            'lignes_count': len(ligne_ids)
        })

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            model_name='EcritureComptable',
            object_id=instance.pk,
            description=f"Création écriture comptable « {instance.numero_piece or instance.reference} » (#{instance.pk})",
            details={
                'numero_piece': instance.numero_piece,
                'journal_id': instance.journal_id,
                'reference': instance.reference,
            },
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save()
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='EcritureComptable',
            object_id=instance.pk,
            description=f"Modification écriture comptable « {instance.numero_piece or instance.reference} » (#{instance.pk})",
            details={'fields': sorted(serializer.validated_data.keys())},
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        # Une écriture liée à un document métier ne se supprime pas ici :
        # supprimer casserait la cohérence avec sa source (commande, caisse…).
        if instance.est_liee:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "Cette écriture est liée à un document (commande, facture, caisse, "
                "stock ou immobilisation). Modifiez le document d'origine."
            )
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            model_name='EcritureComptable',
            object_id=instance.pk,
            description=f"Suppression écriture comptable « {instance.numero_piece or instance.reference} » (#{instance.pk})",
            details={
                'numero_piece': instance.numero_piece,
                'journal_id': instance.journal_id,
                'reference': instance.reference,
            },
            request=self.request,
        )
        instance.delete()


class ImmobilisationViewSet(viewsets.ModelViewSet):
    """CRUD immobilisations + génération des dotations annuelles."""
    from api.models import Immobilisation
    from api.serializers.accounting import ImmobilisationSerializer
    queryset = Immobilisation.objects.select_related(
        'compte_immo', 'compte_amortissement').prefetch_related('dotations')
    serializer_class = ImmobilisationSerializer
    permission_classes = [IsComptaWriteAllowed]

    @action(detail=True, methods=['post'], url_path='generer_dotation')
    @transaction.atomic
    def generer_dotation(self, request, pk=None):
        """Génère l'écriture de dotation (D 681100 / C compte_amortissement)
        pour l'année fournie (body: {"annee": 2026})."""
        from api.models import DotationAmortissement
        annee = int(request.data.get('annee', timezone.now().year))
        immo = self.get_object()

        if annee < immo.date_acquisition.year or annee > immo.date_acquisition.year + immo.duree_annees:
            return Response({'error': 'Année hors période d\'amortissement'}, status=400)
        if DotationAmortissement.objects.filter(immobilisation=immo, annee=annee).exists():
            return Response({'error': f'Dotation {annee} déjà générée'}, status=400)

        montant = immo.montant_dotation(annee)
        journal, _ = JournalComptable.objects.get_or_create(
            code='IM', defaults={'nom': 'Immobilisations'})
        from ..signals_comptabilite import get_exercice_courant
        compte_dotation = CompteComptable.objects.get_or_create(
            numero='681100', defaults={'libelle': 'Dotations aux amortissements',
                                       'type': 'CHARGE'})[0]
        ecriture = EcritureComptable.objects.create(
            date=timezone.now().date(), journal=journal,
            exercice=get_exercice_courant(), reference=f"DOT-{immo.id}-{annee}",
            libelle=f"Dotation amortissement {immo.nom} {annee}")
        LigneEcriture.objects.create(
            ecriture=ecriture, compte=compte_dotation, debit=montant)
        LigneEcriture.objects.create(
            ecriture=ecriture, compte=immo.compte_amortissement, credit=montant)
        DotationAmortissement.objects.create(
            immobilisation=immo, annee=annee, montant=montant, ecriture=ecriture)
        log_audit(
            user=request.user, action=AuditLog.Action.OTHER,
            model_name='Immobilisation', object_id=immo.pk,
            description=f"Dotation {annee} {immo.nom} : {montant}",
            request=request)
        return Response({'annee': annee, 'montant': str(montant),
                         'ecriture': ecriture.numero_piece})

    @action(detail=False, methods=['post'], url_path='generer_dotations_annee')
    def generer_dotations_annee(self, request):
        """Génère les dotations de l'année pour toutes les immobilisations
        actives (skip celles déjà dotées ou hors période)."""
        from api.models import Immobilisation
        annee = int(request.data.get('annee', timezone.now().year))
        done, skipped = [], []
        for immo in Immobilisation.objects.filter(is_active=True):
            res = self.generer_dotation(request, pk=immo.pk)
            (done if res.status_code == 200 else skipped).append(
                {'id': immo.id, 'status': res.status_code})
        return Response({'annee': annee, 'generees': done, 'ignorees': skipped})
