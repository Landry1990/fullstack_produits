from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import ProtectedError, Sum, F, DecimalField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from datetime import timedelta, date

from ..models import Fournisseur, Commande, PaiementFournisseur, CommandeProduit, Produit, AuditLog
from ..serializers import FournisseurSerializer
from ..pagination import StandardResultsSetPagination
from ..audit_helpers import log_audit

class FournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for fournisseurs."""
    queryset = Fournisseur.objects.all().order_by('name')
    serializer_class = FournisseurSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone']

    def get_queryset(self):
        commandes_total = CommandeProduit.objects.filter(
            commande__fournisseur=OuterRef('pk'),
            commande__status=Commande.Status.CLOTUREE
        ).values('commande__fournisseur').annotate(
            total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
        ).values('total')
        
        paiements_total = PaiementFournisseur.objects.filter(
            fournisseur=OuterRef('pk')
        ).values('fournisseur').annotate(
            total=Sum('montant', output_field=DecimalField())
        ).values('total')

        qs = super().get_queryset()
        
        # Par défaut, ne montrer que les fournisseurs actifs
        if not self.request.query_params.get('include_inactive'):
            qs = qs.filter(is_active=True)
            
        qs = qs.annotate(
            total_du_annotated=Coalesce(Subquery(commandes_total[:1]), Value(0, output_field=DecimalField())),
            total_paye_annotated=Coalesce(Subquery(paiements_total[:1]), Value(0, output_field=DecimalField()))
        ).annotate(
            solde_dette_annotated=F('total_du_annotated') - F('total_paye_annotated')
        )
        return qs

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Bascule le statut actif/inactif d'un fournisseur."""
        fournisseur = self.get_object()
        fournisseur.is_active = not fournisseur.is_active
        fournisseur.save(update_fields=['is_active'])
        return Response({
            'status': 'success',
            'is_active': fournisseur.is_active,
            'message': f'Statut changé en {"actif" if fournisseur.is_active else "inactif"}.'
        })

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=True, methods=['get'])
    def catalogue(self, request, pk=None):
        """
        Retourne le catalogue des produits commandés chez ce fournisseur.
        """
        from decimal import Decimal
        
        fournisseur = self.get_object()
        
        latest_order_subquery = CommandeProduit.objects.filter(
            produit=OuterRef('produit'),
            commande__fournisseur=fournisseur,
            commande__status='CLOT'
        ).order_by('-commande__date_cloture').values('price_cost')[:1]
        
        latest_date_subquery = CommandeProduit.objects.filter(
            produit=OuterRef('produit'),
            commande__fournisseur=fournisseur,
            commande__status='CLOT'
        ).order_by('-commande__date_cloture').values('commande__date_cloture')[:1]
        
        catalogue_data = list(
            CommandeProduit.objects.filter(
                commande__fournisseur=fournisseur,
                commande__status='CLOT'
            ).values(
                'produit'
            ).annotate(
                qte_totale=Sum(F('quantity') + F('unites_gratuites')),
                dernier_prix_achat=Subquery(latest_order_subquery),
                derniere_commande=Subquery(latest_date_subquery)
            )
        )
        
        product_ids = [item['produit'] for item in catalogue_data]
        products_map = {
            p.id: p for p in Produit.objects.filter(id__in=product_ids).only(
                'id', 'name', 'cip1', 'cip2', 'cip3', 'selling_price', 'stock'
            )
        }
        
        result = []
        for item in catalogue_data:
            produit = products_map.get(item['produit'])
            if not produit:
                continue
            
            try:
                selling_price = produit.selling_price or Decimal('0')
                dernier_prix = item['dernier_prix_achat'] or Decimal('0')
                marge = selling_price - dernier_prix
                
                if selling_price > 0:
                    marge_pourcent = (marge / selling_price) * 100
                else:
                    marge_pourcent = Decimal('0')
                
                result.append({
                    'produit_id': produit.id,
                    'produit_nom': produit.name,
                    'cip': produit.cip1 or produit.cip2 or produit.cip3 or '-',
                    'dernier_prix_achat': float(dernier_prix),
                    'derniere_commande': item['derniere_commande'],
                    'prix_vente': float(selling_price),
                    'marge': float(marge),
                    'marge_pourcent': round(float(marge_pourcent), 1),
                    'qte_totale': item['qte_totale'] or 0,
                    'stock_actuel': produit.stock
                })
            except (ValueError, TypeError):
                continue
        
        result.sort(key=lambda x: x['produit_nom'].lower())
        
        return Response({
            'fournisseur_id': fournisseur.id,
            'fournisseur_nom': fournisseur.name,
            'total_produits': len(result),
            'produits': result
        })

    @action(detail=False, methods=['get'])
    def echeancier(self, request):
        """
        Retourne les échéances de paiement fournisseurs.

        Mode RELEVE :
          - Les commandes clôturées sont regroupées en tranches de `periode_releve_jours`
            jours démarrant le 1er du mois (ex: 10j → 1-10, 11-20, 21-fin).
          - Date d'échéance = dernier jour de la tranche + delai_paiement_jours.
          - Les paiements sont imputés tranche par tranche (du plus ancien au plus récent).
          - Seules les tranches avec un solde impayé > 0 sont retournées.

        Mode FACTURE :
          - Une échéance par commande clôturée non entièrement payée.
          - Date d'échéance = date_cloture + delai_paiement_jours.
          - Les paiements sont imputés commande par commande (du plus ancien au plus récent).
        """
        from decimal import Decimal
        import calendar

        def _statut(jours):
            if jours < 0:
                return "EN RETARD"
            if jours == 0:
                return "AUJOURD'HUI"
            return "À VENIR"

        def _tranches_releve(annee, mois, periode_jours):
            """
            Génère les tranches (date_debut, date_fin) pour un mois donné
            selon la périodicité du relevé (départ le 1er du mois).
            """
            _, dernier_jour = calendar.monthrange(annee, mois)
            tranches = []
            debut = 1
            while debut <= dernier_jour:
                fin = min(debut + periode_jours - 1, dernier_jour)
                tranches.append((
                    date(annee, mois, debut),
                    date(annee, mois, fin),
                ))
                debut = fin + 1
            return tranches

        today = date.today()
        fournisseurs = self.get_queryset().filter(is_active=True)
        echeances = []

        for f in fournisseurs:
            # Toutes les commandes clôturées, triées chronologiquement
            commandes_qs = (
                Commande.objects
                .filter(fournisseur=f, status=Commande.Status.CLOTUREE)
                .annotate(
                    total_value=Coalesce(
                        Subquery(
                            CommandeProduit.objects
                            .filter(commande=OuterRef('pk'))
                            .values('commande')
                            .annotate(s=Sum(F('quantity') * F('price'), output_field=DecimalField()))
                            .values('s')[:1]
                        ),
                        Value(Decimal('0.00'), output_field=DecimalField())
                    )
                )
                .order_by('date_cloture')
            )
            commandes = list(commandes_qs)
            if not commandes:
                continue

            # Total payé à ce fournisseur (tous paiements confondus)
            total_paye = PaiementFournisseur.objects.filter(fournisseur=f).aggregate(
                t=Coalesce(Sum('montant', output_field=DecimalField()), Value(Decimal('0.00'), output_field=DecimalField()))
            )['t']

            if f.type_reglement == 'RELEVE':
                periode = max(f.periode_releve_jours, 1)

                # Grouper les commandes par tranche calendaire
                tranches_map: dict[tuple, Decimal] = {}
                mois_concernes: set[tuple] = set()
                for c in commandes:
                    cmd_date = c.date_cloture.date() if c.date_cloture else today
                    mois_concernes.add((cmd_date.year, cmd_date.month))

                # Construire toutes les tranches pour les mois concernés
                all_tranches: list[tuple] = []
                for (annee, mois) in sorted(mois_concernes):
                    all_tranches.extend(_tranches_releve(annee, mois, periode))

                # Additionner le montant des commandes dans chaque tranche
                for tranche in all_tranches:
                    tranches_map[tranche] = Decimal('0.00')
                for c in commandes:
                    cmd_date = c.date_cloture.date() if c.date_cloture else today
                    for tranche in all_tranches:
                        if tranche[0] <= cmd_date <= tranche[1]:
                            tranches_map[tranche] += c.total_value
                            break

                # Imputer les paiements tranche par tranche (chronologique)
                reste_paye = total_paye
                for tranche in sorted(all_tranches):
                    montant_tranche = tranches_map.get(tranche, Decimal('0.00'))
                    if montant_tranche <= Decimal('0.00'):
                        continue
                    if reste_paye >= montant_tranche:
                        reste_paye -= montant_tranche
                        continue
                    montant_du = montant_tranche - reste_paye
                    reste_paye = Decimal('0.00')

                    date_fin_tranche = tranche[1]
                    echeance_date = date_fin_tranche + timedelta(days=f.delai_paiement_jours)
                    jours_restants = (echeance_date - today).days
                    label = f"Relevé {tranche[0].strftime('%d/%m')}→{tranche[1].strftime('%d/%m/%Y')}"

                    echeances.append({
                        'fournisseur_id': f.id,
                        'fournisseur_nom': f.name,
                        'type_reglement': 'RELEVE',
                        'commande_id': None,
                        'numero_facture': label,
                        'montant_du': float(montant_du),
                        'date_echeance': echeance_date.isoformat(),
                        'jours_restants': jours_restants,
                        'status': _statut(jours_restants),
                        'periode_jours': periode,
                        'date_fin_tranche': date_fin_tranche.isoformat(),
                    })

            else:
                # Mode FACTURE : une échéance par commande
                reste_paye = total_paye
                for c in commandes:
                    cmd_total = c.total_value
                    if reste_paye >= cmd_total:
                        reste_paye -= cmd_total
                        continue
                    cmd_due = cmd_total - reste_paye
                    reste_paye = Decimal('0.00')

                    base_date = c.date_cloture.date() if c.date_cloture else today
                    echeance_date = base_date + timedelta(days=f.delai_paiement_jours)
                    jours_restants = (echeance_date - today).days

                    echeances.append({
                        'fournisseur_id': f.id,
                        'fournisseur_nom': f.name,
                        'type_reglement': 'FACTURE',
                        'commande_id': c.id,
                        'numero_facture': c.numero_facture or f"CMD-{c.id}",
                        'montant_du': float(cmd_due),
                        'date_echeance': echeance_date.isoformat(),
                        'jours_restants': jours_restants,
                        'status': _statut(jours_restants),
                    })

        echeances.sort(key=lambda x: x['jours_restants'])
        return Response(echeances)

    @action(detail=True, methods=['get'])
    def releve_factures(self, request, pk=None):
        """
        Retourne les commandes (factures) clôturées d'un fournisseur sur une période donnée.
        """
        from decimal import Decimal

        fournisseur = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        commandes_qs = Commande.objects.filter(
            fournisseur=fournisseur,
            status=Commande.Status.CLOTUREE
        )

        if start_date:
            try:
                commandes_qs = commandes_qs.filter(date_cloture__date__gte=start_date)
            except ValueError:
                return Response({'error': 'Format start_date invalide (YYYY-MM-DD)'}, status=400)

        if end_date:
            try:
                commandes_qs = commandes_qs.filter(date_cloture__date__lte=end_date)
            except ValueError:
                return Response({'error': 'Format end_date invalide (YYYY-MM-DD)'}, status=400)

        commandes_qs = commandes_qs.annotate(
            total_value=Coalesce(
                Sum(F('produits__quantity') * F('produits__price'), output_field=DecimalField()), 
                Decimal('0.00')
            )
        ).order_by('date_cloture')

        factures = []
        montant_total = Decimal('0.00')

        for c in commandes_qs:
            total_cmd = float(c.total_value)
            montant_total += Decimal(str(total_cmd))
            factures.append({
                'id': c.id,
                'numero_facture': c.numero_facture or f"CMD-{c.id}",
                'date_cloture': c.date_cloture.isoformat() if c.date_cloture else None,
                'montant': total_cmd
            })

        return Response({
            'fournisseur_id': fournisseur.id,
            'fournisseur_nom': fournisseur.name,
            'periode': {
                'start_date': start_date,
                'end_date': end_date
            },
            'total_factures': len(factures),
            'montant_total_periode': float(montant_total),
            'factures': factures
        })

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """
        Retourne des statistiques consolidées pour le tableau de bord fournisseurs.
        """
        from decimal import Decimal
        from django.db.models import Count, Sum, F, DecimalField
        from django.utils import timezone
        import traceback
        
        try:
            today = timezone.now().date()
            
            # 1. Statistiques Globales
            fournisseurs = self.get_queryset()
            total_dette = sum(((f.solde_dette_annotated or Decimal('0.00')) for f in fournisseurs), Decimal('0.00'))
            
            # 2. Répartition par fournisseur (Top 5)
            repartition = []
            fournisseurs_tries = sorted(fournisseurs, key=lambda x: x.solde_dette_annotated or Decimal('0.00'), reverse=True)
            for f in fournisseurs_tries[:5]:
                val = f.solde_dette_annotated or Decimal('0.00')
                if val > 0:
                    repartition.append({
                        'name': f.name,
                        'value': float(val)
                    })
            
            # Ajouter "Autres" si nécessaire
            if len(fournisseurs_tries) > 5:
                autres_dette = sum(((f.solde_dette_annotated or Decimal('0.00')) for f in fournisseurs_tries[5:]), Decimal('0.00'))
                if autres_dette > 0:
                    repartition.append({
                        'name': 'Autres',
                        'value': float(autres_dette)
                    })

            # 3. Échéancier consolidé
            echeances_resp = self.echeancier(request)
            echeances_data = echeances_resp.data
            
            if not isinstance(echeances_data, list):
                echeances_data = []
            
            stats_echeances = {
                'en_retard': 0.0,
                'aujourdhui': 0.0,
                'a_venir': 0.0,
                'count_retard': 0,
            }
            
            prochaines_echeances = []
            
            for ech in echeances_data:
                montant = ech['montant_du']
                if ech['status'] == 'EN RETARD':
                    stats_echeances['en_retard'] += montant
                    stats_echeances['count_retard'] += 1
                elif ech['status'] == "AUJOURD'HUI":
                    stats_echeances['aujourdhui'] += montant
                else:
                    stats_echeances['a_venir'] += montant
                
                # Garder les 5 plus urgentes
                if len(prochaines_echeances) < 5:
                    prochaines_echeances.append(ech)

            # 4. Évolution de la dette (6 derniers mois)
            evolution = []
            for i in range(5, -1, -1):
                # Approximation des mois
                # Premier jour du mois i mois en arrière
                _first_of_today: date = today.replace(day=1)
                _shifted: date = _first_of_today - timedelta(days=i * 31)
                first_day: date = _shifted.replace(day=1)
                # Dernier jour de ce mois
                if first_day.month == 12:
                    last_day = date(first_day.year, 12, 31)
                else:
                    last_day = date(first_day.year, first_day.month + 1, 1) - timedelta(days=1)
                
                # Dette à last_day = Commandes (clôturées avant last_day) - Paiements réels (avant last_day)
                # On exclut les avoirs (mode AVOIR) qui représentent des crédits entrants, pas des paiements sortants
                total_commandes = CommandeProduit.objects.filter(
                    commande__status=Commande.Status.CLOTUREE,
                    commande__date_cloture__date__lte=last_day
                ).aggregate(
                    total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
                )['total'] or Decimal('0.00')
                
                total_paiements = PaiementFournisseur.objects.filter(
                    date_paiement__lte=last_day
                ).exclude(
                    mode_paiement='AVOIR'
                ).aggregate(
                    total=Sum('montant', output_field=DecimalField())
                )['total'] or Decimal('0.00')

                total_avoirs = PaiementFournisseur.objects.filter(
                    date_paiement__lte=last_day,
                    mode_paiement='AVOIR'
                ).aggregate(
                    total=Sum('montant', output_field=DecimalField())
                )['total'] or Decimal('0.00')

                dette_brute = total_commandes - total_paiements - total_avoirs
                evolution.append({
                    'month': last_day.strftime('%b %Y'),
                    'dette': float(max(dette_brute, Decimal('0.00')))
                })

            return Response({
                'total_dette': float(total_dette),
                'nb_fournisseurs_actifs': fournisseurs.count(),
                'stats_echeances': stats_echeances,
                'repartition_dette': repartition,
                'prochaines_echeances': prochaines_echeances,
                'evolution_dette': evolution
            })
        except Exception as e:
            print(traceback.format_exc())
            return Response({'error': str(e), 'trace': traceback.format_exc()}, status=500)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Supprime plusieurs fournisseurs par lot."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=400)
            
        try:
            with transaction.atomic():
                fournisseurs = Fournisseur.objects.filter(id__in=ids)
                names = list(fournisseurs.values_list('name', flat=True))
                count = fournisseurs.count()
                fournisseurs.update(is_active=False)
                
                log_audit(
                    user=request.user,
                    action=AuditLog.Action.DELETE,
                    model_name='Fournisseur',
                    object_id=0,
                    description=f"Suppression groupée de {count} fournisseurs: {', '.join(names)}",
                    details={'ids': ids, 'names': names},
                    request=request
                )
                
                return Response({
                    'status': 'success',
                    'message': f'{count} fournisseurs supprimés avec succès.'
                })
        except ProtectedError as e:
            return Response({
                'error': 'Impossible de supprimer certains fournisseurs',
                'detail': 'Certains fournisseurs sont liés à des produits ou d\'autres enregistrements et ne peuvent pas être supprimés.'
            }, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
