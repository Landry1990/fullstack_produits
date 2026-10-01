"""
Package serializers - Refactorisation par domaine
Tous les serializers sont exportés ici pour compatibilité ascendante.
"""

# Config & Settings
# Accounting
from .accounting import (
    CompteComptableSerializer,
    EcritureComptableSerializer,
    ExerciceComptableSerializer,
    JournalComptableSerializer,
    LigneEcritureSerializer,
)

# Audit & Logs
from .audit import (
    AuditLogSerializer,
    MouvementCaisseSerializer,
)

# Billing & Sales
from .billing import (
    CaisseSerializer,
    ClotureCaisseSerializer,
    CreanceSerializer,
    FacturePrintSerializer,
    FactureProduitAllocationSerializer,
    FactureProduitSerializer,
    FactureSerializer,
    FactureUpdateSerializer,
)

# Clients & Tiers
from .client_credit import (
    AvoirClientSerializer,
    AvoirClientUpdateSerializer,
    LigneAvoirClientSerializer,
)
from .clients import (
    AyantDroitSerializer,
    ClientSerializer,
    DepotClientSerializer,
)

# Communication
from .communication import (
    InternalMessageSerializer,
    MessageTemplateSerializer,
    RuptureFournisseurSerializer,
    SmsLogSerializer,
    SmsTemplateSerializer,
    TelegramLogSerializer,
    WhatsAppLogSerializer,
)
from .config import (
    ConfigurationOptionSerializer,
    InvoiceSettingsSerializer,
    LoyaltySettingSerializer,
    ObjectifCommercialSerializer,
    PharmacySettingsSerializer,
    TVASerializer,
)

# Inventory & Stock
from .inventory import (
    AvoirSerializer,
    HistoriqueTransformationSerializer,
    InventaireSerializer,
    LigneAvoirSerializer,
    LigneAvoirUpdateSerializer,
    LigneInventaireSerializer,
    LigneInventaireUpdateSerializer,
    MouvementStockSerializer,
    RelationTransformationSerializer,
    StockAdjustmentSerializer,
)

# Orders & Procurement
from .orders import (
    CommandeProduitSerializer,
    CommandeSerializer,
    FournisseurSerializer,
    OrderScheduleSerializer,
    PaiementFournisseurSerializer,
)

# Planning
from .planning import (
    LeaveRequestSerializer,
    ShiftAssignmentSerializer,
    ShiftConfigSerializer,
    ShiftScheduleSerializer,
)

# Products & Catalog
from .products import (
    DrugInteractionSerializer,
    FamilleRisqueSerializer,
    FormeSerializer,
    GroupeSerializer,
    MedicamentReferenceSerializer,
    ProduitSerializer,
    ProduitUpdateSerializer,
    RayonSerializer,
    StockLotSerializer,
    StockLotUpdateSerializer,
    SubstanceSerializer,
)

# Promis & Coupons
from .promis import (
    CouponMonnaieSerializer,
    LigneOrdonnancierSerializer,
    OrdonnancierCreateSerializer,
    OrdonnancierSerializer,
    PromisSerializer,
)

# Promotions
from .promotions import (
    ConfigurationObjectifsSerializer,
    PromotionPackItemSerializer,
    PromotionSerializer,
)

# Réapprovisionnement
from .reappro import (
    ReapproAdjustmentSerializer,
    ReapproSessionSerializer,
)

# Users & Permissions
from .users import (
    PosteCaisseSerializer,
    PosteVenteSerializer,
    ProfileSerializer,
    SessionCaisseSerializer,
    TeamSerializer,
    UserSerializer,
)

__all__ = [
    # Audit
    'AuditLogSerializer',
    'AvoirClientSerializer',
    'AvoirClientUpdateSerializer',
    'AvoirSerializer',
    'AyantDroitSerializer',
    'CaisseSerializer',
    'ClientSerializer',
    'ClotureCaisseSerializer',
    'CommandeProduitSerializer',
    'CommandeSerializer',
    # Accounting
    'CompteComptableSerializer',
    'ConfigurationObjectifsSerializer',
    'ConfigurationOptionSerializer',
    'CouponMonnaieSerializer',
    'CreanceSerializer',
    # Clients
    'DepotClientSerializer',
    'DrugInteractionSerializer',
    'EcritureComptableSerializer',
    'ExerciceComptableSerializer',
    'FacturePrintSerializer',
    # Billing
    'FactureProduitAllocationSerializer',
    'FactureProduitSerializer',
    'FactureSerializer',
    'FactureUpdateSerializer',
    'FamilleRisqueSerializer',
    'FormeSerializer',
    # Orders
    'FournisseurSerializer',
    'GroupeSerializer',
    'HistoriqueTransformationSerializer',
    'InternalMessageSerializer',
    'InventaireSerializer',
    'InvoiceSettingsSerializer',
    'JournalComptableSerializer',
    'LeaveRequestSerializer',
    'LigneAvoirSerializer',
    'LigneAvoirUpdateSerializer',
    'LigneAvoirClientSerializer',
    'LigneEcritureSerializer',
    # Inventory
    'LigneInventaireSerializer',
    'LigneInventaireUpdateSerializer',
    'LigneOrdonnancierSerializer',
    'LoyaltySettingSerializer',
    'MedicamentReferenceSerializer',
    'MessageTemplateSerializer',
    'MouvementCaisseSerializer',
    'MouvementStockSerializer',
    'ObjectifCommercialSerializer',
    'OrderScheduleSerializer',
    'OrdonnancierCreateSerializer',
    'OrdonnancierSerializer',
    'PaiementFournisseurSerializer',
    'PharmacySettingsSerializer',
    'PosteCaisseSerializer',
    'PosteVenteSerializer',
    'ProduitSerializer',
    'ProduitUpdateSerializer',
    # Users
    'ProfileSerializer',
    # Promis
    'PromisSerializer',
    # Promotions
    'PromotionPackItemSerializer',
    'PromotionSerializer',
    'RayonSerializer',
    # Reappro
    'ReapproAdjustmentSerializer',
    'ReapproSessionSerializer',
    'RelationTransformationSerializer',
    'RuptureFournisseurSerializer',
    'SessionCaisseSerializer',
    'ShiftAssignmentSerializer',
    # Planning
    'ShiftConfigSerializer',
    'ShiftScheduleSerializer',
    'SmsLogSerializer',
    # Communication
    'SmsTemplateSerializer',
    'StockAdjustmentSerializer',
    'StockLotSerializer',
    'StockLotUpdateSerializer',
    # Products
    'SubstanceSerializer',
    # Config
    'TVASerializer',
    'TelegramLogSerializer',
    'UserSerializer',
    'WhatsAppLogSerializer',
]
