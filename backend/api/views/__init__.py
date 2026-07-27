from ..ordonnancier_view import OrdonnancierViewSet
from .audit import AuditLogViewSet
from .auth import verify_password
from .categories import CategoriesDetailView, CategoriesListView, CategorieViewSet
from .clients import AyantDroitViewSet, ClientViewSet, DepotClientViewSet
from .commandes import (
    AvoirViewSet,
    CommandeProduitViewSet,
    CommandeViewSet,
    LigneAvoirViewSet,
    OrderScheduleViewSet,
    PromisViewSet,
    generer_suggestions_commande,
)
from .communication import SmsTemplateViewSet, SmsViewSet
from .configuration_objectifs import ConfigurationObjectifsViewSet
from .coupons import CouponMonnaieViewSet
from .dashboard import DashboardViewSet, StatistiquesViewSet
from .finance_stats import FinanceStatsViewSet
from .formes import FormeViewSet
from .fournisseurs import FournisseurViewSet
from .groupes import GroupeViewSet
from .historique_achats import HistoriqueAchatsViewSet
from .historique_ventes import HistoriqueVentesViewSet
from .import_views import ProductImportView
from .objectifs import ObjectifViewSet
from .paiements import PaiementFournisseurViewSet
from .planning import LeaveRequestViewSet, ShiftConfigViewSet, ShiftScheduleViewSet
from .produits import ProduitViewSet
from .promotions import PromotionViewSet
from .purge import PurgeViewSet

# Import from modular rapports
from .rapports import RapportViewSet
from .settings import (
    ConfigurationOptionViewSet,
    InvoiceConfigurationView,
    LoyaltySettingViewSet,
    PharmacySettingsView,
    TelegramGetChatIdView,
    TelegramRapportFlashDateView,
    TelegramRapportFlashView,
    TelegramRapportInventaireView,
    TelegramRapportMensuelView,
    TelegramTestView,
    TVAViewSet,
    WhatsAppTestView,
)
from .stocks import (
    CadencierViewSet,
    HistoriqueTransformationViewSet,
    InventaireViewSet,
    LigneInventaireViewSet,
    RelationTransformationViewSet,
    StatsUGViewSet,
    StockAdjustmentViewSet,
    StockAnalysisOverstockView,
    StockAnalysisShortageView,
    StockAnalysisUnsoldView,
    StockLotViewSet,
)
from .system_admin import SystemAdminViewSet
from .temporal_analysis import TemporalAnalysisViewSet
from .users import CustomAuthToken, TeamViewSet, UserDailySessionViewSet, UserViewSet
from .ventes import (
    CaisseViewSet,
    ClotureCaisseViewSet,
    CreanceViewSet,
    FactureProduitViewSet,
    FactureViewSet,
    MouvementCaisseViewSet,
    PosteCaisseViewSet,
    PosteVenteViewSet,
    SessionCaisseViewSet,
)

# Expose all for import from api.views
__all__ = [
    'AuditLogViewSet',
    'AvoirViewSet',
    'AyantDroitViewSet',
    'CadencierViewSet',
    'CaisseViewSet',
    'CategorieViewSet',
    'CategoriesDetailView',
    'CategoriesListView',
    'ClientViewSet',
    'ClotureCaisseViewSet',
    'CommandeProduitViewSet',
    'CommandeViewSet',
    'ConfigurationOptionViewSet',
    'CouponMonnaieViewSet',
    'CreanceViewSet',
    'CustomAuthToken',
    'DashboardViewSet',
    'DepotClientViewSet',
    'FactureProduitViewSet',
    'FactureViewSet',
    'FormeViewSet',
    'FournisseurViewSet',
    'GroupeViewSet',
    'HistoriqueAchatsViewSet',
    'HistoriqueTransformationViewSet',
    'HistoriqueVentesViewSet',
    'InventaireViewSet',
    'InvoiceConfigurationView',
    'LeaveRequestViewSet',
    'LigneAvoirViewSet',
    'LigneInventaireViewSet',
    'LoyaltySettingViewSet',
    'MouvementCaisseViewSet',
    'OrderScheduleViewSet',
    'OrdonnancierViewSet',
    'PaiementFournisseurViewSet',
    'PharmacySettingsView',
    'PosteCaisseViewSet',
    'PosteVenteViewSet',
    'ProductImportView',
    'ProduitViewSet',
    'PromisViewSet',
    'PromotionViewSet',
    'PurgeViewSet',
    'RapportViewSet',
    'RelationTransformationViewSet',
    'SessionCaisseViewSet',
    'ShiftConfigViewSet',
    'ShiftScheduleViewSet',
    'StatistiquesViewSet',
    'StatsUGViewSet',
    'StockAdjustmentViewSet',
    'StockAnalysisOverstockView',
    'StockAnalysisShortageView',
    'StockAnalysisUnsoldView',
    'StockLotViewSet',
    'SystemAdminViewSet',
    'TVAViewSet',
    'TeamViewSet',
    'TelegramGetChatIdView',
    'TelegramRapportFlashDateView',
    'TelegramRapportFlashView',
    'TelegramRapportInventaireView',
    'TelegramRapportMensuelView',
    'TelegramTestView',
    'TemporalAnalysisViewSet',
    'UserDailySessionViewSet',
    'UserViewSet',
    'WhatsAppTestView',
    'generer_suggestions_commande',
    'verify_password',
]
