from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from api.pagination import StandardResultsSetPagination

from .base import RapportBaseMixin
from .inventory import RapportInventoryMixin
from .sales import RapportSalesMixin
from .finance import RapportFinanceMixin

class RapportViewSet(
    viewsets.ViewSet,
    RapportBaseMixin,
    RapportInventoryMixin,
    RapportSalesMixin,
    RapportFinanceMixin
):
    """
    ViewSet modulaire pour les rapports ZENITH.
    Regroupe les calculs de base, les inventaires, les ventes et la finance.
    """
    permission_classes = [IsAuthenticated]
    
    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            self._paginator = StandardResultsSetPagination()
        return self._paginator

    def _get_rapport_data(self, date_debut, date_fin, mois_str):
        """
        Méthode principale de calcul (Orchestration).
        """
        factures = self._get_factures_periode(date_debut, date_fin)
        ca_stats = self._calculate_ca_stats(factures)
        marge = self._calculate_margin(factures)
        encaissements = self._calculate_encaissements(date_debut, date_fin, factures)
        creances = self._calculate_creances()
        ca_par_tva = self._calculate_ca_par_tva(factures)
        achats = self._calculate_achats_fournisseurs(date_debut, date_fin)
        clients_pro = self._calculate_clients_pro(factures)
        ug = self._calculate_unites_gratuites(date_debut, date_fin)
        mouvements = self._calculate_mouvements_caisse(date_debut, date_fin)
        
        if ca_stats['ca_ttc'] > 0:
            ug['pct_du_ca'] = round((ug['valeur_totale'] / ca_stats['ca_ttc'] * 100), 2)
        
        return {
            'mois': mois_str,
            'periode': {'debut': date_debut.isoformat(), 'fin': date_fin.isoformat()},
            'ca': ca_stats, 'marge': marge,
            'encaissements': encaissements['encaissements'],
            'recouvrements_total': encaissements['recouvrements_total'],
            'ventes_credit': encaissements['ventes_credit'],
            'coupons_total': encaissements['coupons_total'],
            'creances_a_percevoir': creances['total'],
            'creances': {'total': creances['total'], 'nb_factures': creances['nb_factures']},
            'depots_total': encaissements['depots_total'],
            'ca_par_tva': ca_par_tva,
            'achats_par_fournisseur': achats,
            'clients_professionnels': clients_pro,
            'unites_gratuites': ug,
            'mouvements_caisse': mouvements
        }
