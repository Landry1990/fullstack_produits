"""
API Models Package

All models are imported here for backward compatibility.
Usage: from api.models import Produit, Facture, etc.
"""

# Users
# Audit
from .audit import (
    ActivityLog,
    AuditLog,
    LigneOrdonnancier,
    MouvementCaisse,
    Ordonnancier,
)

# Billing
from .billing import (
    Caisse,
    ClotureCaisse,
    CouponMonnaie,
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    PosteCaisse,
    PosteVente,
    Promis,
    RelevePaiement,
    SessionCaisse,
)

# Clients
from .clients import AyantDroit, Client, Fournisseur

# Communication
from .communication import (
    InternalMessage,
    MessageTemplate,
    SmsLog,
    SmsTemplate,
    TelegramLog,
    WhatsAppLog,
)

# Comptabilité
from .comptabilite import (
    CompteComptable,
    EcritureComptable,
    ExerciceComptable,
    JournalComptable,
    Lettrage,
    LigneEcriture,
)
from .configuration_objectifs import ConfigurationObjectifs
from .depot import DepotClient

# Feedback
from .feedback import Feedback

# Inventory
from .inventory import (
    HistoriqueTransformation,
    Inventaire,
    LigneInventaire,
    RelationTransformation,
)

# Licence
from .licence import Licence
from .objectif import ObjectifCommercial

# Orders
from .orders import Avoir, Commande, CommandeProduit, LigneAvoir, OrderSchedule
from .paiements import PaiementFournisseur

# Planning
from .planning import LeaveRequest, ShiftAssignment, ShiftConfig, ShiftSchedule

# Products
from .products import (
    DrugInteraction,
    FamilleRisque,
    Forme,
    Groupe,
    MedicamentReference,
    Produit,
    Rayon,
    Substance,
)
from .promotions import Promotion, PromotionPackItem

# Settings
from .settings import (
    TVA,
    ConfigurationOption,
    InvoiceSettings,
    LoyaltySetting,
    PharmacySettings,
)

# Signals for soft delete (preserving names before deletion)
from .signals import (
    preserve_product_name_on_delete,
)

# Stock
from .stock import (
    LotSequence,
    MouvementStock,
    ReapproSession,
    RuptureFournisseur,
    StockAdjustment,
    StockLot,
    TicketSessionSequence,
    generate_lot_number,
    get_next_ticket_session,
)
from .user_sessions import UserDailySession
from .users import Profile, Team, create_user_profile, save_user_profile

__all__ = [
    # Audit
    'ActivityLog',
    'AuditLog',
    'Avoir',
    'AyantDroit',
    'Caisse',
    'Client',
    'ClotureCaisse',
    # Orders
    'Commande',
    'CommandeProduit',
    # Comptabilité
    'CompteComptable',
    'ConfigurationObjectifs',
    'ConfigurationOption',
    'CouponMonnaie',
    'DepotClient',
    'DrugInteraction',
    'EcritureComptable',
    'ExerciceComptable',
    # Billing
    'Facture',
    'FactureProduit',
    'FactureProduitAllocation',
    'FamilleRisque',
    # Feedback
    'Feedback',
    'Forme',
    # Clients
    'Fournisseur',
    'Groupe',
    'HistoriqueTransformation',
    'InternalMessage',
    # Inventory
    'Inventaire',
    'InvoiceSettings',
    'JournalComptable',
    'LeaveRequest',
    'Lettrage',
    # Licence
    'Licence',
    'LigneAvoir',
    'LigneEcriture',
    'LigneInventaire',
    'LigneOrdonnancier',
    'LotSequence',
    # Settings
    'LoyaltySetting',
    'MedicamentReference',
    'MessageTemplate',
    'MouvementCaisse',
    'MouvementStock',
    # Objectifs
    'ObjectifCommercial',
    'OrderSchedule',
    'Ordonnancier',
    'PaiementFournisseur',
    'PharmacySettings',
    'PosteCaisse',
    'PosteVente',
    'Produit',
    # Users
    'Profile',
    'Promis',
    # Promotions
    'Promotion',
    'PromotionPackItem',
    # Products
    'Rayon',
    'ReapproSession',
    'RelationTransformation',
    'RelevePaiement',
    'RuptureFournisseur',
    'SessionCaisse',
    'ShiftAssignment',
    # Planning
    'ShiftConfig',
    'ShiftSchedule',
    # Communication
    'SmsLog',
    'SmsTemplate',
    'StockAdjustment',
    # Stock
    'StockLot',
    'Substance',
    'Team',
    'TicketSessionSequence',
    # Sessions
    'UserDailySession',
    'WhatsAppLog',
    'generate_lot_number',
    'get_next_ticket_session',
]
