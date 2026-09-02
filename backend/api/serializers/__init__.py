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
)

# Clients & Tiers
from .client_credit import AvoirClientSerializer, LigneAvoirClientSerializer
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
    LigneInventaireSerializer,
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
    RayonSerializer,
    StockLotSerializer,
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
    'LigneAvoirClientSerializer',
    'LigneEcritureSerializer',
    # Inventory
    'LigneInventaireSerializer',
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
    # Products
    'SubstanceSerializer',
    # Config
    'TVASerializer',
    'TelegramLogSerializer',
    'UserSerializer',
    'WhatsAppLogSerializer',
]
