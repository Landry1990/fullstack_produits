# -*- coding: utf-8 -*-
"""
API Models Package

All models are imported here for backward compatibility.
Usage: from api.models import Produit, Facture, etc.
"""

# Users
from .users import Profile, create_user_profile, save_user_profile
from .user_sessions import UserDailySession

# Settings
from .settings import (
    LoyaltySetting, PharmacySettings, InvoiceSettings, ConfigurationOption, TVA
)
# Products
from .products import (
    Rayon, Forme, Groupe, FamilleRisque, 
    Substance, DrugInteraction, Produit, MedicamentReference
)

# Stock
from .stock import (
    StockLot, LotSequence, StockAdjustment, MouvementStock,
    TicketSessionSequence, RuptureFournisseur, ReapproSession,
    generate_lot_number, get_next_ticket_session
)

# Clients
from .clients import Fournisseur, Client, AyantDroit
from .depot import DepotClient

# Orders
from .orders import Commande, CommandeProduit, Avoir, LigneAvoir, OrderSchedule
from .paiements import PaiementFournisseur

# Billing
from .billing import (
    Facture, FactureProduit, FactureProduitAllocation,
    Caisse, RelevePaiement, ClotureCaisse, CouponMonnaie, Promis, PosteCaisse
)

# Comptabilité
from .comptabilite import (
    CompteComptable, JournalComptable, EcritureComptable, LigneEcriture, ExerciceComptable,
    Lettrage
)

# Inventory
from .inventory import (
    Inventaire, LigneInventaire, 
    RelationTransformation, HistoriqueTransformation
)

# Audit
from .audit import (
    ActivityLog, AuditLog, MouvementCaisse, 
    Ordonnancier, LigneOrdonnancier
)

# Communication
from .communication import SmsLog, SmsTemplate, WhatsAppLog, TelegramLog, InternalMessage, MessageTemplate

# Feedback
from .feedback import Feedback

# Signals for soft delete (preserving names before deletion)
from .signals import (
    preserve_product_name_on_delete,
)
from .promotions import Promotion, PromotionPackItem
from .objectif import ObjectifCommercial
from .configuration_objectifs import ConfigurationObjectifs

# Licence
from .licence import Licence

__all__ = [
    # Users
    'Profile',
    # Settings
    'LoyaltySetting', 'PharmacySettings', 'InvoiceSettings', 'ConfigurationOption',
    # Products
    'Rayon', 'Forme', 'Groupe', 'FamilleRisque', 
    'Substance', 'DrugInteraction', 'Produit', 'MedicamentReference',
    # Stock
    'StockLot', 'LotSequence', 'StockAdjustment', 'MouvementStock',
    'TicketSessionSequence', 'RuptureFournisseur', 'ReapproSession',
    'generate_lot_number', 'get_next_ticket_session',
    # Clients
    'Fournisseur', 'Client', 'AyantDroit', 'DepotClient',
    # Orders
    'Commande', 'CommandeProduit', 'Avoir', 'LigneAvoir', 'PaiementFournisseur', 'OrderSchedule',
    # Billing
    'Facture', 'FactureProduit', 'FactureProduitAllocation',
    'Caisse', 'RelevePaiement', 'ClotureCaisse', 'CouponMonnaie', 'Promis', 'PosteCaisse',
    # Inventory
    'Inventaire', 'LigneInventaire', 
    'RelationTransformation', 'HistoriqueTransformation',
    # Audit
    'ActivityLog', 'AuditLog', 'MouvementCaisse', 
    'Ordonnancier', 'LigneOrdonnancier',
    # Communication
    'SmsLog', 'SmsTemplate', 'WhatsAppLog', 'InternalMessage', 'MessageTemplate',
    # Feedback
    'Feedback',
    # Promotions
    'Promotion', 'PromotionPackItem',
    # Objectifs
    'ObjectifCommercial', 'ConfigurationObjectifs',
    # Sessions
    'UserDailySession',
    # Licence
    'Licence',
    # Comptabilité
    'CompteComptable', 'JournalComptable', 'EcritureComptable', 'LigneEcriture', 'ExerciceComptable', 'Lettrage',
]
