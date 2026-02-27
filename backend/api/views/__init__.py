from .produits import (
    ProduitViewSet, CategorieViewSet, FournisseurViewSet, 
    CategoriesListView, CategoriesDetailView
)
from .groupes import GroupeViewSet
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
    StockAnalysisUnsoldView, StockAnalysisOverstockView, StockAnalysisShortageView
)
from .users import CustomAuthToken, UserViewSet
from .auth import verify_password
from .settings import LoyaltySettingViewSet, InvoiceConfigurationView, PharmacySettingsView, ConfigurationOptionViewSet, TVAViewSet
from .dashboard import DashboardViewSet, StatistiquesViewSet
from .audit import AuditLogViewSet
from .historique_ventes import HistoriqueVentesViewSet
from .historique_achats import HistoriqueAchatsViewSet
from .import_views import ProductImportView
from .formes import FormeViewSet
from .communication import SmsViewSet, SmsTemplateViewSet
from .finance_stats import FinanceStatsViewSet
from .objectifs import ObjectifViewSet
from .paiements import PaiementFournisseurViewSet
from .coupons import CouponMonnaieViewSet
from .promotions import PromotionViewSet
from .configuration_objectifs import ConfigurationObjectifsViewSet
from .temporal_analysis import TemporalAnalysisViewSet

# Import from parent api module (not yet migrated to views package)
from ..rapport_view import RapportViewSet
from ..ordonnancier_view import OrdonnancierViewSet

# Expose all for import from api.views
__all__ = [
    'ProduitViewSet', 'CategorieViewSet', 'FournisseurViewSet',
    'CategoriesListView', 'CategoriesDetailView', 'GroupeViewSet',
    'ClientViewSet', 'AyantDroitViewSet',
    'PaiementFournisseurViewSet',
    'CommandeViewSet', 'CommandeProduitViewSet', 'AvoirViewSet', 'LigneAvoirViewSet',
    'PromisViewSet', 'generer_suggestions_commande',
    'FactureViewSet', 'FactureProduitViewSet', 'CaisseViewSet', 'ClotureCaisseViewSet',
    'CreanceViewSet', 'MouvementCaisseViewSet',
    'StockLotViewSet', 'InventaireViewSet', 'LigneInventaireViewSet', 'StockAdjustmentViewSet',
    'StatsUGViewSet', 'RelationTransformationViewSet', 'HistoriqueTransformationViewSet',
    'StockAnalysisUnsoldView', 'StockAnalysisOverstockView', 'StockAnalysisShortageView',
    'CustomAuthToken', 'UserViewSet', 'verify_password',
    'LoyaltySettingViewSet', 'InvoiceConfigurationView', 'PharmacySettingsView', 'ConfigurationOptionViewSet',
    'DashboardViewSet', 'StatistiquesViewSet',
    'AuditLogViewSet',
    'HistoriqueVentesViewSet', 'HistoriqueAchatsViewSet', 'ProductImportView',
    'RapportViewSet', 'OrdonnancierViewSet', 'FormeViewSet', 'CouponMonnaieViewSet',
    'PromotionViewSet', 'TemporalAnalysisViewSet', 'TVAViewSet'
]
