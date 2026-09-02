from datetime import date, timedelta

from django.db import transaction
from django.db.models import DecimalField, F, OuterRef, ProtectedError, Subquery, Sum
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..audit_helpers import log_audit
from ..models import (
    AuditLog,
    Commande,
    CommandeProduit,
    Fournisseur,
    PaiementFournisseur,
    Produit,
)
from ..pagination import StandardResultsSetPagination
from ..serializers import FournisseurSerializer
from ..services.supplier_finance import (
    annotate_supplier_debt,
    build_supplier_detailed_schedule,
    build_supplier_schedule,
    build_supplier_statement,
)
from ..sudo_utils import validate_sudo_mode


class FournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for fournisseurs."""
    queryset = Fournisseur.objects.all().order_by('name')
    serializer_class = FournisseurSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone']

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.query_params.get('include_inactive'):
            queryset = queryset.filter(is_active=True)
        return annotate_supplier_debt(queryset)

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

    def destroy(self, request, *args, **kwargs):
        from django.utils import timezone
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_delete_fournisseur')
        if error_response:
            return error_response
        instance = self.get_object()
        with transaction.atomic():
            instance.is_active = False
            instance.deleted_by = validation_user
            instance.deleted_at = timezone.now()
            instance.save(update_fields=['is_active', 'deleted_by', 'deleted_at'])
            log_audit(
                user=validation_user,
                action=AuditLog.Action.DELETE,
                model_name='Fournisseur',
                object_id=instance.id,
                description=f"Suppression fournisseur: {instance.name}",
                details={'name': instance.name},
                request=request
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

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
                selling_price = produit.selling_price or Decimal(0)
                dernier_prix = item['dernier_prix_achat'] or Decimal(0)
                marge = selling_price - dernier_prix
                
                if selling_price > 0:
                    marge_pourcent = (marge / selling_price) * 100
                else:
                    marge_pourcent = Decimal(0)
                
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
        fournisseur_id = request.query_params.get('fournisseur_id')
        fournisseurs = self.get_queryset().filter(is_active=True)
        if fournisseur_id:
            fournisseurs = fournisseurs.filter(id=int(fournisseur_id))
        return Response(build_supplier_schedule(fournisseurs))

    @action(detail=True, methods=['get'])
    def echeances_detaillees(self, request, pk=None):
        """
        Retourne les échéances détaillées d'un fournisseur spécifique avec
        montant_total, montant_paye et montant_reste pour chaque échéance.
        """
        f = self.get_object()
        return Response(build_supplier_detailed_schedule(f))

    @action(detail=True, methods=['get'])
    def releve_factures(self, request, pk=None):
        """
        Retourne les commandes (factures) clôturées d'un fournisseur sur une période donnée.
        """
        fournisseur = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        try:
            start_date_value = date.fromisoformat(start_date) if start_date else None
            end_date_value = date.fromisoformat(end_date) if end_date else None
        except ValueError:
            return Response({'error': 'Format de date invalide (YYYY-MM-DD)'}, status=400)

        factures, montant_total = build_supplier_statement(fournisseur, start_date_value, end_date_value)
        return Response({
            'fournisseur_id': fournisseur.id,
            'fournisseur_nom': fournisseur.name,
            'periode': {'start_date': start_date, 'end_date': end_date},
            'total_factures': len(factures),
            'montant_total_periode': float(montant_total),
            'factures': factures,
        })

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """
        Retourne des statistiques consolidées pour le tableau de bord fournisseurs.
        """
        import traceback
        from decimal import Decimal

        from django.db.models import F, Sum
        from django.utils import timezone
        
        try:
            today = timezone.localtime(timezone.now()).date()
            
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
                    commande__is_active=True,
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
            return Response({'error': str(e), 'trace': traceback.format_exc()}, status=500)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Supprime plusieurs fournisseurs par lot."""
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_delete_fournisseur')
        if error_response:
            return error_response

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
                    user=validation_user,
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
        except ProtectedError:
            return Response({
                'error': 'Impossible de supprimer certains fournisseurs',
                'detail': 'Certains fournisseurs sont liés à des produits ou d\'autres enregistrements et ne peuvent pas être supprimés.'
            }, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
