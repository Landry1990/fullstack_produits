from .produits import (
    ProduitViewSet, CategorieViewSet, FournisseurViewSet, 
    CategoriesListView, CategoriesDetailView
)
from .clients import ClientViewSet, AyantDroitViewSet
from .commandes import (
    CommandeViewSet, CommandeProduitViewSet, AvoirViewSet, LigneAvoirViewSet, 
    PromisViewSet, generer_suggestions_commande
)
from .ventes import (
    FactureViewSet, FactureProduitViewSet, CaisseViewSet, ClotureCaisseViewSet,
    CreanceViewSet, MouvementCaisseViewSet
)
from .stocks import (
    StockLotViewSet, InventaireViewSet, LigneInventaireViewSet, StockAdjustmentViewSet,
    StatsUGViewSet, RelationTransformationViewSet, HistoriqueTransformationViewSet,
    StockAnalysisUnsoldView, StockAnalysisOverstockView
)
from .users import CustomAuthToken, UserViewSet
from .settings import LoyaltySettingViewSet, InvoiceConfigurationView
from .dashboard import DashboardViewSet, StatistiquesViewSet
from .audit import AuditLogViewSet
from .historique_ventes import HistoriqueVentesViewSet
from .historique_achats import HistoriqueAchatsViewSet
from .produit_import import ProduitImportViewSet

# Expose all for import from api.views
__all__ = [
    'ProduitViewSet', 'CategorieViewSet', 'FournisseurViewSet',
    'CategoriesListView', 'CategoriesDetailView',
    'ClientViewSet', 'AyantDroitViewSet',
    'CommandeViewSet', 'CommandeProduitViewSet', 'AvoirViewSet', 'LigneAvoirViewSet', 
    'PromisViewSet', 'generer_suggestions_commande',
    'FactureViewSet', 'FactureProduitViewSet', 'CaisseViewSet', 'ClotureCaisseViewSet',
    'CreanceViewSet', 'MouvementCaisseViewSet',
    'StockLotViewSet', 'InventaireViewSet', 'LigneInventaireViewSet', 'StockAdjustmentViewSet',
    'StatsUGViewSet', 'RelationTransformationViewSet', 'HistoriqueTransformationViewSet',
    'StockAnalysisUnsoldView', 'StockAnalysisOverstockView',
    'CustomAuthToken', 'UserViewSet',
    'LoyaltySettingViewSet', 'InvoiceConfigurationView',
    'DashboardViewSet', 'StatistiquesViewSet',
    'AuditLogViewSet',
    'HistoriqueVentesViewSet', 'HistoriqueAchatsViewSet', 'ProduitImportViewSet'
]
