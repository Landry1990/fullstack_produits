import logging
from datetime import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.models import Facture
from api.serializers_optimized import FactureDetailSerializer
from api.services.sales_statistics import build_sales_statistics

logger = logging.getLogger(__name__)


class FactureStatsMixin:
    """Actions de statistiques et rapports : stats_jour, caisse_par_tranche_horaire, recap_multi."""

    @action(detail=False, methods=['get'])
    def stats_jour(self, request):
        result = build_sales_statistics(
            self.get_queryset(),
            request.query_params.get('date__gte'),
            request.query_params.get('date__lte'),
        )
        return Response(result)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def caisse_par_tranche_horaire(self, request):
        """
        Calcule la caisse pour une tranche horaire spécifique.
        """
        date_debut_str = request.query_params.get('date_debut', None)
        date_fin_str = request.query_params.get('date_fin', None)

        try:
            if date_debut_str:
                try:
                    start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': 'Format invalide pour date_debut'}, status=status.HTTP_400_BAD_REQUEST)
                start_datetime = timezone.make_aware(start_datetime)
            else:
                return Response({'detail': 'date_debut requis.'}, status=status.HTTP_400_BAD_REQUEST)

            if date_fin_str:
                try:
                    end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': 'Format invalide pour date_fin'}, status=status.HTTP_400_BAD_REQUEST)
                end_datetime = timezone.make_aware(end_datetime)
            else:
                return Response({'detail': 'date_fin requis.'}, status=status.HTTP_400_BAD_REQUEST)

            if start_datetime >= end_datetime:
                return Response({'detail': "La date de début doit être antérieure à la date de fin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'detail': f'Erreur date: {e!s}'}, status=status.HTTP_400_BAD_REQUEST)

        factures = self.get_queryset().filter(
            date__gte=start_datetime,
            date__lte=end_datetime,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )

        total_ttc = Decimal('0.00')
        total_ht = Decimal('0.00')
        total_ht_apres_remise = Decimal('0.00')
        total_tva = Decimal('0.00')
        total_remise = Decimal('0.00')
        total_regle = Decimal('0.00')
        total_en_compte = Decimal('0.00')
        nombre_factures = factures.count()

        for facture in factures:
            try:
                facture_sous_total_ht = Decimal(str(facture.total_ht))
                facture_remise = Decimal(str(facture.remise))
                facture_total_tva = Decimal(str(facture.total_tva))
                facture_total_ttc = Decimal(str(facture.total_ttc))
                facture_regle = Decimal(str(getattr(facture, 'montant_regle', 0)))
                facture_en_compte = Decimal(str(getattr(facture, 'montant_en_compte', 0)))

                logger.debug(f"Tranche Stats: Facture #{facture.id} - TTC: {facture_total_ttc}, Regle: {facture_regle}, EnCompte: {facture_en_compte}, Status: {facture.status}")

                facture_total_ht_apres_remise = facture_sous_total_ht - facture_remise

                total_ht += facture_sous_total_ht
                total_remise += facture_remise
                total_ht_apres_remise += facture_total_ht_apres_remise
                total_tva += facture_total_tva
                total_ttc += facture_total_ttc
                total_regle += facture_regle
                total_en_compte += facture_en_compte

            except (ValueError, TypeError, AttributeError):
                pass

        total_ht_final = total_ht_apres_remise

        response_data = {
            'date_debut': start_datetime.strftime('%Y-%m-%d %H:%M'),
            'date_fin': end_datetime.strftime('%Y-%m-%d %H:%M'),
            'tranche': f"{start_datetime.strftime('%d-%m-%Y %Hh%M')} - {end_datetime.strftime('%d-%m-%Y %Hh%M')}",
            'nombre_factures': nombre_factures,
            'total_ht': str(total_ht_final.quantize(Decimal('0.01'))),
            'total_tva': str(total_tva.quantize(Decimal('0.01'))),
            'total_ttc': str(total_ttc.quantize(Decimal('0.01'))),
            'total_regle': str(total_regle.quantize(Decimal('0.01'))),
            'total_en_compte': str(total_en_compte.quantize(Decimal('0.01'))),
            'sous_total_ht': str(total_ht.quantize(Decimal('0.01'))),
            'total_remise': str(total_remise.quantize(Decimal('0.01')))
        }
        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='recap-multi')
    def recap_multi(self, request):
        """
        Récapitulatif multi-tickets : retourne les détails de plusieurs factures
        à partir de leurs numéros de ticket.
        Body: {"numeros": ["FAC-001", "FAC-002", ...], "client_name": "Nom client (optionnel)"}
        """
        numeros = request.data.get('numeros', [])
        if not numeros:
            return Response(
                {'detail': 'Veuillez fournir au moins un numéro de ticket.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Nettoyer les numéros (trim, enlever les vides)
        numeros = [n.strip() for n in numeros if n and n.strip()]
        if not numeros:
            return Response(
                {'detail': 'Aucun numéro valide fourni.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Rechercher les factures par numero_facture
        factures = Facture.objects.filter(
            numero_facture__in=numeros,
            is_active=True
        ).select_related(
            'client', 'created_by', 'validated_by'
        ).prefetch_related(
            'produits__produit', 'paiements'
        ).order_by('date')

        found_numeros = set(factures.values_list('numero_facture', flat=True))
        not_found = [n for n in numeros if n not in found_numeros]

        serializer = FactureDetailSerializer(factures, many=True)

        # Calculer les totaux récapitulatifs (exclure les factures annulées)
        factures_valides = [f for f in factures if f.status != Facture.Status.ANNULEE]
        factures_annulees = [f for f in factures if f.status == Facture.Status.ANNULEE]
        total_ht = sum(float(f.total_ht or 0) for f in factures_valides)
        total_tva = sum(float(f.total_tva or 0) for f in factures_valides)
        total_ttc = sum(float(f.total_ttc or 0) for f in factures_valides)
        total_remise = sum(float(f.remise or 0) for f in factures_valides)

        return Response({
            'factures': serializer.data,
            'cancelled_count': len(factures_annulees),
            'recap': {
                'nombre_factures': len(factures_valides),
                'total_ht': round(total_ht, 2),
                'total_tva': round(total_tva, 2),
                'total_ttc': round(total_ttc, 2),
                'total_remise': round(total_remise, 2),
                'periode': {
                    'debut': first_facture.date.isoformat() if (first_facture := factures.first()) else None,
                    'fin': last_facture.date.isoformat() if (last_facture := factures.last()) else None,
                }
            },
            'not_found': not_found,
            'client_name': request.data.get('client_name', ''),
        })
