# -*- coding: utf-8 -*-
"""
Package serializers - Refactorisation par domaine
Tous les serializers sont exportés ici pour compatibilité ascendante.
"""

# Config & Settings
from .config import (
    TVASerializer,
    InvoiceSettingsSerializer,
    LoyaltySettingSerializer,
    PharmacySettingsSerializer,
    ConfigurationOptionSerializer,
    ObjectifCommercialSerializer,
)

# Users & Permissions
from .users import (
    ProfileSerializer,
    UserSerializer,
    PosteCaisseSerializer,
    SessionCaisseSerializer,
)

# Clients & Tiers
from .clients import (
    DepotClientSerializer,
    AyantDroitSerializer,
    ClientSerializer,
)

# Products & Catalog
from .products import (
    SubstanceSerializer,
    MedicamentReferenceSerializer,
    RayonSerializer,
    FormeSerializer,
    FamilleRisqueSerializer,
    GroupeSerializer,
    ProduitSerializer,
    StockLotSerializer,
)

# Orders & Procurement
from .orders import (
    FournisseurSerializer,
    CommandeProduitSerializer,
    CommandeSerializer,
    PaiementFournisseurSerializer,
    OrderScheduleSerializer,
)

# Billing & Sales
from .billing import (
    FactureProduitAllocationSerializer,
    FactureProduitSerializer,
    CaisseSerializer,
    ClotureCaisseSerializer,
    FactureSerializer,
    FacturePrintSerializer,
    CreanceSerializer,
)

# Inventory & Stock
from .inventory import (
    LigneInventaireSerializer,
    InventaireSerializer,
    LigneAvoirSerializer,
    AvoirSerializer,
    MouvementStockSerializer,
    StockAdjustmentSerializer,
    RelationTransformationSerializer,
    HistoriqueTransformationSerializer,
)

# Promotions
from .promotions import (
    PromotionPackItemSerializer,
    ConfigurationObjectifsSerializer,
    PromotionSerializer,
)

# Promis & Coupons
from .promis import (
    PromisSerializer,
    LigneOrdonnancierSerializer,
    OrdonnancierSerializer,
    OrdonnancierCreateSerializer,
    CouponMonnaieSerializer,
)

# Communication
from .communication import (
    SmsTemplateSerializer,
    SmsLogSerializer,
    WhatsAppLogSerializer,
    TelegramLogSerializer,
    InternalMessageSerializer,
    MessageTemplateSerializer,
    RuptureFournisseurSerializer,
)

# Accounting
from .accounting import (
    CompteComptableSerializer,
    JournalComptableSerializer,
    ExerciceComptableSerializer,
    LigneEcritureSerializer,
    EcritureComptableSerializer,
)

# Audit & Logs
from .audit import (
    AuditLogSerializer,
    MouvementCaisseSerializer,
)

# Réapprovisionnement
from .reappro import (
    ReapproAdjustmentSerializer,
    ReapproSessionSerializer,
)

__all__ = [
    # Config
    'TVASerializer',
    'InvoiceSettingsSerializer',
    'LoyaltySettingSerializer',
    'PharmacySettingsSerializer',
    'ConfigurationOptionSerializer',
    'ObjectifCommercialSerializer',
    # Users
    'ProfileSerializer',
    'UserSerializer',
    'PosteCaisseSerializer',
    'SessionCaisseSerializer',
    # Clients
    'DepotClientSerializer',
    'AyantDroitSerializer',
    'ClientSerializer',
    # Products
    'SubstanceSerializer',
    'MedicamentReferenceSerializer',
    'RayonSerializer',
    'FormeSerializer',
    'FamilleRisqueSerializer',
    'GroupeSerializer',
    'ProduitSerializer',
    'StockLotSerializer',
    # Orders
    'FournisseurSerializer',
    'CommandeProduitSerializer',
    'CommandeSerializer',
    'PaiementFournisseurSerializer',
    'OrderScheduleSerializer',
    # Billing
    'FactureProduitAllocationSerializer',
    'FactureProduitSerializer',
    'CaisseSerializer',
    'ClotureCaisseSerializer',
    'FactureSerializer',
    'FacturePrintSerializer',
    'CreanceSerializer',
    # Inventory
    'LigneInventaireSerializer',
    'InventaireSerializer',
    'LigneAvoirSerializer',
    'AvoirSerializer',
    'MouvementStockSerializer',
    'StockAdjustmentSerializer',
    'RelationTransformationSerializer',
    'HistoriqueTransformationSerializer',
    # Promotions
    'PromotionPackItemSerializer',
    'ConfigurationObjectifsSerializer',
    'PromotionSerializer',
    # Promis
    'PromisSerializer',
    'LigneOrdonnancierSerializer',
    'OrdonnancierSerializer',
    'OrdonnancierCreateSerializer',
    'CouponMonnaieSerializer',
    # Communication
    'SmsTemplateSerializer',
    'SmsLogSerializer',
    'WhatsAppLogSerializer',
    'TelegramLogSerializer',
    'InternalMessageSerializer',
    'MessageTemplateSerializer',
    'RuptureFournisseurSerializer',
    # Accounting
    'CompteComptableSerializer',
    'JournalComptableSerializer',
    'ExerciceComptableSerializer',
    'LigneEcritureSerializer',
    'EcritureComptableSerializer',
    # Audit
    'AuditLogSerializer',
    'MouvementCaisseSerializer',
    # Reappro
    'ReapproAdjustmentSerializer',
    'ReapproSessionSerializer',
]
